"""Backblaze B2 uploads via the image-upload Cloudflare Worker."""

from __future__ import annotations

from urllib.parse import urlparse

import requests
from flask import current_app


class ImageUploadError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def worker_base_url() -> str:
    base = (current_app.config.get("IMAGE_UPLOAD_WORKER_URL") or "").strip().rstrip("/")
    if base:
        return base
    full = (current_app.config.get("IMAGE_UPLOAD_URL") or "").strip().rstrip("/")
    if full.endswith("/upload-url"):
        return full[: -len("/upload-url")]
    return full


def worker_api_key() -> str:
    return (
        current_app.config.get("IMAGE_UPLOAD_API_KEY")
        or current_app.config.get("IMAGE_API_KEY")
        or ""
    )


def is_image_upload_configured() -> bool:
    return bool(worker_base_url() and worker_api_key())


def key_from_public_url(public_url: str) -> str:
    return urlparse(public_url).path.lstrip("/")


def resolve_stored_url(stored: str | None) -> str | None:
    """Return a browser-loadable URL for a stored object key or full URL."""
    if not stored:
        return None
    if stored.startswith(("http://", "https://")):
        return stored
    from app.services.r2_service import get_public_url

    return get_public_url(stored)


def is_storage_configured() -> bool:
    from app.services.r2_service import is_r2_configured

    return is_image_upload_configured() or is_r2_configured()


def create_upload_presign(
    *,
    content_type: str,
    content_length: int,
    prefix: str,
    r2_object_key: str | None = None,
) -> dict:
    """Worker-first presign; falls back to Cloudflare R2 when configured."""
    if is_image_upload_configured():
        return create_presigned_upload(
            content_type=content_type,
            content_length=content_length,
            prefix=prefix,
        )

    from app.services.r2_service import generate_presigned_upload, get_public_url, is_r2_configured

    if is_r2_configured() and r2_object_key:
        upload_url = generate_presigned_upload(r2_object_key, content_type)
        return {
            "upload_url": upload_url,
            "upload_headers": {"Content-Type": content_type},
            "object_key": r2_object_key,
            "public_url": get_public_url(r2_object_key),
        }

    raise ImageUploadError("File storage is not configured")


def create_presigned_upload(
    *,
    content_type: str,
    content_length: int,
    prefix: str = "packages",
) -> dict:
    """
    Step A of the upload flow — presigned PUT URL from the Worker.

    Returns upload_url, upload_headers, public_url, object_key.
    """
    base = worker_base_url()
    api_key = worker_api_key()
    if not base or not api_key:
        raise ImageUploadError("Image upload worker is not configured")

    if content_length <= 0:
        raise ImageUploadError("content_length must be positive")

    try:
        response = requests.post(
            f"{base}/upload-url",
            json={
                "contentType": content_type,
                "contentLength": content_length,
                "prefix": prefix,
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        raise ImageUploadError(f"Presign request failed: {exc}") from exc

    try:
        data = response.json()
    except ValueError:
        raise ImageUploadError(
            response.text or "Invalid presign response",
            status_code=response.status_code,
        )

    if not response.ok:
        raise ImageUploadError(
            data.get("error", "Presign failed"),
            status_code=response.status_code,
        )

    public_url = data.get("publicUrl") or data.get("public_url")
    upload_url = data.get("uploadUrl") or data.get("upload_url")
    if not public_url or not upload_url:
        raise ImageUploadError("Presign response missing uploadUrl or publicUrl")

    return {
        "upload_url": upload_url,
        "upload_headers": data.get("headers") or {},
        "public_url": public_url,
        "object_key": key_from_public_url(public_url),
    }


def upload_bytes(file_bytes: bytes, content_type: str, *, prefix: str = "packages") -> str:
    """Server-side upload (Step A + B). Returns publicUrl."""
    presign = create_presigned_upload(
        content_type=content_type,
        content_length=len(file_bytes),
        prefix=prefix,
    )
    upload_headers = {**presign["upload_headers"], "Content-Type": content_type}
    try:
        upload = requests.put(
            presign["upload_url"],
            data=file_bytes,
            headers=upload_headers,
            timeout=60,
        )
        upload.raise_for_status()
    except requests.RequestException as exc:
        raise ImageUploadError(f"Upload failed: {exc}") from exc
    return presign["public_url"]


def is_valid_photo_reference(key: str, *, unidentified: bool = False, shipping_id: str | None = None) -> bool:
    if not key:
        return False
    if key.startswith(("http://", "https://")):
        return True
    if unidentified:
        return key.startswith("packages/unidentified/") or key.startswith("packages/")
    if shipping_id and key.startswith(f"packages/{shipping_id}/"):
        return True
    return key.startswith("packages/")


def is_valid_invoice_reference(key: str, shipping_id: str | None = None) -> bool:
    if not key:
        return False
    if key.startswith(("http://", "https://")):
        return True
    if shipping_id and key.startswith(f"invoices/{shipping_id}/"):
        return True
    return key.startswith("invoices/")

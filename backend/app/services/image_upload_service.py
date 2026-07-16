"""Backblaze B2 uploads via the image-upload Cloudflare Worker."""

from __future__ import annotations

import uuid
from pathlib import Path
from urllib.parse import urlparse

import requests
from flask import current_app


class ImageUploadError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


_MIME_BY_EXT = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
}

_EXT_BY_MIME = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

_ALLOWED_LOCAL_PREFIXES = ("packages/", "invoices/", "transfer-proofs/")


def guess_content_type(filename: str, default: str = "application/octet-stream") -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return _MIME_BY_EXT.get(ext, default)


def parse_content_length(data: dict) -> int:
    raw = data.get("content_length")
    if raw is None:
        raw = data.get("contentLength")
    if raw is None:
        raw = data.get("size")
    if raw is None:
        raise ValueError("content_length is required")
    try:
        length = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError("content_length is required") from exc
    if length <= 0:
        raise ValueError("content_length must be greater than 0")
    return length


def parse_presign_fields(
    data: dict,
    *,
    default_filename: str,
    default_content_type: str,
) -> tuple[str, str, int]:
    filename = (data.get("filename") or default_filename).strip()
    content_type = (
        data.get("content_type") or data.get("contentType") or ""
    ).strip().lower()
    if not content_type:
        content_type = guess_content_type(filename, default_content_type)
    content_length = parse_content_length(data)
    return filename, content_type, content_length


def worker_base_url() -> str:
    base = (current_app.config.get("IMAGE_UPLOAD_WORKER_URL") or "").strip().rstrip("/")
    if base.endswith("/upload-worker"):
        base = base[: -len("/upload-worker")]
    if base:
        return base
    full = (current_app.config.get("IMAGE_UPLOAD_URL") or "").strip().rstrip("/")
    if full.endswith("/upload-url"):
        return full[: -len("/upload-url")]
    if full.endswith("/upload-worker"):
        return full[: -len("/upload-worker")]
    return full


def worker_api_key() -> str:
    return (
        current_app.config.get("IMAGE_UPLOAD_API_KEY")
        or current_app.config.get("IMAGE_API_KEY")
        or ""
    )


def is_image_upload_configured() -> bool:
    return bool(worker_base_url() and worker_api_key())


def is_local_upload_enabled() -> bool:
    if is_image_upload_configured():
        return False
    return bool(current_app.config.get("LOCAL_UPLOADS_ENABLED", True))


def local_upload_root() -> Path:
    configured = (current_app.config.get("LOCAL_UPLOAD_ROOT") or "").strip()
    if configured:
        return Path(configured)
    return Path(current_app.root_path).parent / "var" / "uploads"


def is_storage_configured() -> bool:
    return is_image_upload_configured() or is_local_upload_enabled()


def is_allowed_local_object_key(object_key: str) -> bool:
    normalized = object_key.replace("\\", "/").lstrip("/")
    if not normalized or ".." in normalized.split("/"):
        return False
    return any(normalized.startswith(prefix) for prefix in _ALLOWED_LOCAL_PREFIXES)


def local_public_url(object_key: str) -> str:
    return f"/api/uploads/files/{object_key.lstrip('/')}"


def local_file_path(object_key: str) -> Path:
    if not is_allowed_local_object_key(object_key):
        raise ValueError("Invalid upload object key")
    return local_upload_root() / object_key.replace("\\", "/").lstrip("/")


def save_local_upload(object_key: str, file_bytes: bytes) -> None:
    path = local_file_path(object_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(file_bytes)


def create_local_presigned_upload(
    *,
    content_type: str,
    content_length: int,
    prefix: str,
) -> dict:
    if content_length <= 0:
        raise ImageUploadError("content_length must be positive")

    ext = _EXT_BY_MIME.get(content_type, "bin")
    object_key = f"{prefix.strip('/')}/{uuid.uuid4()}.{ext}"
    if not is_allowed_local_object_key(object_key):
        raise ImageUploadError("Invalid upload prefix")

    return {
        "upload_url": "local",
        "upload_headers": {},
        "public_url": local_public_url(object_key),
        "object_key": object_key,
    }


def key_from_public_url(public_url: str) -> str:
    return urlparse(public_url).path.lstrip("/")


def resolve_stored_url(stored: str | None) -> str | None:
    """Return a browser-loadable URL for a stored object key or full URL."""
    if not stored:
        return None
    if stored.startswith(("http://", "https://")):
        return stored
    public_base = (current_app.config.get("STORAGE_PUBLIC_URL") or "").strip().rstrip("/")
    if public_base:
        return f"{public_base}/{stored.lstrip('/')}"
    if is_local_upload_enabled() and is_allowed_local_object_key(stored):
        try:
            if local_file_path(stored).is_file():
                return local_public_url(stored)
        except ValueError:
            return None
    return None


def create_upload_presign(
    *,
    content_type: str,
    content_length: int,
    prefix: str,
) -> dict:
    """Presigned PUT URL from the image upload worker."""
    return create_presigned_upload(
        content_type=content_type,
        content_length=content_length,
        prefix=prefix,
    )


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
        if is_local_upload_enabled():
            return create_local_presigned_upload(
                content_type=content_type,
                content_length=content_length,
                prefix=prefix,
            )
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

    object_key = (data.get("key") or data.get("object_key") or "").strip()
    if not object_key:
        object_key = key_from_public_url(public_url)

    return {
        "upload_url": upload_url,
        "upload_headers": data.get("headers") or data.get("upload_headers") or {},
        "public_url": public_url,
        "object_key": object_key,
    }


def complete_presigned_upload(
    *,
    upload_url: str,
    file_bytes: bytes,
    content_type: str,
    upload_headers: dict | None = None,
) -> None:
    headers = {**(upload_headers or {}), "Content-Type": content_type}
    try:
        upload = requests.put(
            upload_url,
            data=file_bytes,
            headers=headers,
            timeout=120,
        )
        upload.raise_for_status()
    except requests.RequestException as exc:
        raise ImageUploadError(f"Upload failed: {exc}") from exc


def upload_bytes(file_bytes: bytes, content_type: str, *, prefix: str = "packages") -> str:
    """Server-side upload (Step A + B). Returns publicUrl."""
    presign = create_presigned_upload(
        content_type=content_type,
        content_length=len(file_bytes),
        prefix=prefix,
    )
    complete_presigned_upload(
        upload_url=presign["upload_url"],
        file_bytes=file_bytes,
        content_type=content_type,
        upload_headers=presign["upload_headers"],
    )
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


def is_valid_transfer_proof_reference(key: str) -> bool:
    if not key:
        return False
    if key.startswith(("http://", "https://")):
        return True
    return key.startswith("transfer-proofs/")

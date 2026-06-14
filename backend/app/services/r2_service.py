import re
import uuid

import boto3
from botocore.config import Config
from flask import current_app

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
INVOICE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "pdf"}


def is_r2_configured() -> bool:
    return bool(
        current_app.config.get("R2_ACCOUNT_ID")
        and current_app.config.get("R2_ACCESS_KEY_ID")
        and current_app.config.get("R2_SECRET_ACCESS_KEY")
        and current_app.config.get("R2_BUCKET")
    )


def _get_client():
    account_id = current_app.config["R2_ACCOUNT_ID"]
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=current_app.config["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=current_app.config["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _sanitize_filename(filename: str) -> str:
    name = filename.rsplit("/", 1)[-1]
    name = re.sub(r"[^a-zA-Z0-9._-]", "", name)
    return name[:100] or "upload.jpg"


def build_object_key(shipping_id: str, filename: str) -> str:
    safe_name = _sanitize_filename(filename)
    ext = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else "jpg"
    if ext not in ALLOWED_EXTENSIONS:
        ext = "jpg"
    return f"packages/{shipping_id}/{uuid.uuid4()}.{ext}"


def build_invoice_object_key(shipping_id: str, filename: str) -> str:
    safe_name = _sanitize_filename(filename)
    ext = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else "pdf"
    if ext not in INVOICE_EXTENSIONS:
        ext = "pdf"
    return f"invoices/{shipping_id}/{uuid.uuid4()}.{ext}"


def generate_presigned_upload(object_key: str, content_type: str, expires: int = 300) -> str:
    client = _get_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": current_app.config["R2_BUCKET"],
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )


def get_public_url(object_key: str) -> str | None:
    base = current_app.config.get("R2_PUBLIC_URL", "").rstrip("/")
    if not base:
        return None
    return f"{base}/{object_key}"

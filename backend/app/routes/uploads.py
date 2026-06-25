import json
from urllib.parse import urlparse

from flask import Blueprint, jsonify, request

from app.constants import ALLOWED_IMAGE_TYPES, MAX_INVOICE_SIZE_BYTES
from app.models.user import User
from app.services.image_upload_service import (
    ImageUploadError,
    complete_presigned_upload,
    create_presigned_upload,
    create_upload_presign,
    is_image_upload_configured,
    is_storage_configured,
    key_from_public_url,
    parse_content_length,
    parse_presign_fields,
)
from app.services.r2_service import build_object_key, build_unidentified_object_key
from app.utils.auth_decorators import jwt_required, staff_required

uploads_bp = Blueprint("uploads", __name__)

_ALLOWED_UPLOAD_HOST_SUFFIXES = (
    ".backblazeb2.com",
    ".r2.cloudflarestorage.com",
)


def _is_allowed_upload_url(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return any(host.endswith(suffix) for suffix in _ALLOWED_UPLOAD_HOST_SUFFIXES)


def _presign_error(exc: Exception, status: int = 500):
    if isinstance(exc, ImageUploadError):
        return jsonify({"error": str(exc)}), exc.status_code or status
    return jsonify({"error": f"Failed to generate upload URL: {exc}"}), status


@uploads_bp.route("/upload-url", methods=["POST"])
@jwt_required()
def proxy_upload_url():
    """Proxy presign requests to the image Worker (keeps API key server-side)."""
    if not is_image_upload_configured():
        return jsonify({"error": "Image upload worker is not configured"}), 503

    data = request.get_json(silent=True) or {}
    content_type = (data.get("content_type") or data.get("contentType") or "").strip().lower()
    prefix = (data.get("prefix") or "packages").strip() or "packages"
    try:
        content_length = parse_content_length(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if not content_type:
        return jsonify({"error": "content_type is required"}), 400

    try:
        return jsonify(
            create_presigned_upload(
                content_type=content_type,
                content_length=content_length,
                prefix=prefix,
            )
        )
    except ImageUploadError as exc:
        return _presign_error(exc)


@uploads_bp.route("/uploads/put", methods=["POST"])
@jwt_required()
def proxy_presigned_put():
    """Proxy file PUT to B2/R2 so browsers are not blocked by storage CORS."""
    if not is_storage_configured():
        return jsonify({"error": "File storage is not configured"}), 503

    upload_url = (request.form.get("upload_url") or "").strip()
    public_url = (request.form.get("public_url") or "").strip()
    object_key = (request.form.get("object_key") or "").strip()
    content_type = (request.form.get("content_type") or "application/octet-stream").strip().lower()

    if not upload_url:
        return jsonify({"error": "upload_url is required"}), 400
    if not _is_allowed_upload_url(upload_url):
        return jsonify({"error": "Invalid upload URL"}), 400

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "file is required"}), 400

    file_bytes = file.read()
    if not file_bytes:
        return jsonify({"error": "file is empty"}), 400

    if len(file_bytes) > MAX_INVOICE_SIZE_BYTES:
        return jsonify({"error": "File exceeds maximum allowed size"}), 400

    try:
        upload_headers = json.loads(request.form.get("upload_headers") or "{}")
        if not isinstance(upload_headers, dict):
            upload_headers = {}
    except (TypeError, json.JSONDecodeError):
        upload_headers = {}

    try:
        complete_presigned_upload(
            upload_url=upload_url,
            file_bytes=file_bytes,
            content_type=content_type,
            upload_headers=upload_headers,
        )
    except ImageUploadError as exc:
        return _presign_error(exc, status=502)

    if not public_url and object_key:
        from app.services.r2_service import get_public_url

        public_url = get_public_url(object_key) or ""
    if not object_key and public_url:
        object_key = key_from_public_url(public_url)

    return jsonify({"public_url": public_url, "object_key": object_key})


@uploads_bp.route("/uploads/presign", methods=["POST"])
@staff_required()
def presign_upload():
    if not is_storage_configured():
        return jsonify({"error": "File storage is not configured"}), 503

    data = request.get_json(silent=True) or {}
    shipping_id = (data.get("shipping_id") or "").strip().upper()
    try:
        filename, content_type, content_length = parse_presign_fields(
            data,
            default_filename="photo.jpg",
            default_content_type="image/jpeg",
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if content_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400
    if not shipping_id:
        return jsonify({"error": "shipping_id is required"}), 400

    customer = User.query.filter_by(shipping_id=shipping_id).first()
    if not customer:
        return jsonify({"error": "Customer not found for that BOSS ID"}), 404

    try:
        payload = create_upload_presign(
            content_type=content_type,
            content_length=content_length,
            prefix="packages",
            r2_object_key=build_object_key(shipping_id, filename),
        )
    except ImageUploadError as exc:
        return _presign_error(exc)

    payload["shipping_id"] = shipping_id
    return jsonify(payload)


@uploads_bp.route("/uploads/presign-unidentified", methods=["POST"])
@staff_required()
def presign_unidentified_upload():
    if not is_storage_configured():
        return jsonify({"error": "File storage is not configured"}), 503

    data = request.get_json(silent=True) or {}
    try:
        filename, content_type, content_length = parse_presign_fields(
            data,
            default_filename="photo.jpg",
            default_content_type="image/jpeg",
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if content_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400

    try:
        return jsonify(
            create_upload_presign(
                content_type=content_type,
                content_length=content_length,
                prefix="packages",
                r2_object_key=build_unidentified_object_key(filename),
            )
        )
    except ImageUploadError as exc:
        return _presign_error(exc)

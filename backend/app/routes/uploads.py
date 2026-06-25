from flask import Blueprint, jsonify, request

from app.constants import ALLOWED_IMAGE_TYPES
from app.models.user import User
from app.services.image_upload_service import (
    ImageUploadError,
    create_presigned_upload,
    create_upload_presign,
    is_image_upload_configured,
    is_storage_configured,
)
from app.services.r2_service import build_object_key, build_unidentified_object_key
from app.utils.auth_decorators import jwt_required, staff_required

uploads_bp = Blueprint("uploads", __name__)


def _presign_error(exc: Exception, status: int = 500):
    if isinstance(exc, ImageUploadError):
        return jsonify({"error": str(exc)}), exc.status_code or status
    return jsonify({"error": f"Failed to generate upload URL: {exc}"}), status


def _parse_content_length(data: dict) -> int | None:
    raw = data.get("content_length") or data.get("contentLength")
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


@uploads_bp.route("/upload-url", methods=["POST"])
@jwt_required()
def proxy_upload_url():
    """Proxy presign requests to the image Worker (keeps API key server-side)."""
    if not is_image_upload_configured():
        return jsonify({"error": "Image upload worker is not configured"}), 503

    data = request.get_json(silent=True) or {}
    content_type = (data.get("content_type") or data.get("contentType") or "").strip().lower()
    prefix = (data.get("prefix") or "packages").strip() or "packages"
    content_length = _parse_content_length(data)

    if not content_type:
        return jsonify({"error": "content_type is required"}), 400
    if content_length is None or content_length <= 0:
        return jsonify({"error": "content_length is required"}), 400

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


@uploads_bp.route("/uploads/presign", methods=["POST"])
@staff_required()
def presign_upload():
    if not is_storage_configured():
        return jsonify({"error": "File storage is not configured"}), 503

    data = request.get_json(silent=True) or {}
    filename = (data.get("filename") or "photo.jpg").strip()
    content_type = (data.get("content_type") or "image/jpeg").strip().lower()
    shipping_id = (data.get("shipping_id") or "").strip().upper()
    content_length = _parse_content_length(data)

    if content_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400
    if not shipping_id:
        return jsonify({"error": "shipping_id is required"}), 400
    if content_length is None or content_length <= 0:
        return jsonify({"error": "content_length is required"}), 400

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
    filename = (data.get("filename") or "photo.jpg").strip()
    content_type = (data.get("content_type") or "image/jpeg").strip().lower()
    content_length = _parse_content_length(data)

    if content_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400
    if content_length is None or content_length <= 0:
        return jsonify({"error": "content_length is required"}), 400

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

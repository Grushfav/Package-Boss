from flask import Blueprint, jsonify, request

from app.constants import ALLOWED_IMAGE_TYPES
from app.models.user import User
from app.services.r2_service import (
    build_object_key,
    build_unidentified_object_key,
    generate_presigned_upload,
    is_r2_configured,
)
from app.utils.auth_decorators import staff_required

uploads_bp = Blueprint("uploads", __name__)


@uploads_bp.route("/uploads/presign", methods=["POST"])
@staff_required()
def presign_upload():
    if not is_r2_configured():
        return jsonify({"error": "R2 storage is not configured"}), 503

    data = request.get_json(silent=True) or {}
    filename = (data.get("filename") or "photo.jpg").strip()
    content_type = (data.get("content_type") or "image/jpeg").strip().lower()
    shipping_id = (data.get("shipping_id") or "").strip().upper()

    if content_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400

    if not shipping_id:
        return jsonify({"error": "shipping_id is required"}), 400

    customer = User.query.filter_by(shipping_id=shipping_id).first()
    if not customer:
        return jsonify({"error": "Customer not found for that BOSS ID"}), 404

    object_key = build_object_key(shipping_id, filename)

    try:
        upload_url = generate_presigned_upload(object_key, content_type)
    except Exception as exc:
        return jsonify({"error": f"Failed to generate upload URL: {exc}"}), 500

    from app.services.r2_service import get_public_url

    return jsonify(
        {
            "upload_url": upload_url,
            "object_key": object_key,
            "public_url": get_public_url(object_key),
            "shipping_id": shipping_id,
        }
    )


@uploads_bp.route("/uploads/presign-unidentified", methods=["POST"])
@staff_required()
def presign_unidentified_upload():
    if not is_r2_configured():
        return jsonify({"error": "R2 storage is not configured"}), 503

    data = request.get_json(silent=True) or {}
    filename = (data.get("filename") or "photo.jpg").strip()
    content_type = (data.get("content_type") or "image/jpeg").strip().lower()

    if content_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400

    object_key = build_unidentified_object_key(filename)

    try:
        upload_url = generate_presigned_upload(object_key, content_type)
    except Exception as exc:
        return jsonify({"error": f"Failed to generate upload URL: {exc}"}), 500

    from app.services.r2_service import get_public_url

    return jsonify(
        {
            "upload_url": upload_url,
            "object_key": object_key,
            "public_url": get_public_url(object_key),
        }
    )

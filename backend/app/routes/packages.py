import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.constants import ALLOWED_INVOICE_TYPES
from app.models.package import Package
from app.models.user import User
from app.services.billing_service import attach_package_invoice
from app.services.r2_service import (
    build_package_invoice_object_key,
    generate_presigned_upload,
    get_public_url,
    is_r2_configured,
)

packages_bp = Blueprint("packages", __name__)


def _get_current_user():
    user_id = get_jwt_identity()
    try:
        uid = uuid.UUID(user_id)
    except (TypeError, ValueError):
        return None
    return User.query.get(uid)


def _get_customer_package(user: User, package_id: str) -> Package | None:
    try:
        pid = uuid.UUID(package_id)
    except ValueError:
        return None
    return Package.query.filter_by(id=pid, customer_id=user.id).first()


@packages_bp.route("/me/packages", methods=["GET"])
@jwt_required()
def list_my_packages():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    packages = (
        Package.query.filter_by(customer_id=user.id)
        .order_by(Package.created_at.desc())
        .all()
    )
    return jsonify({"packages": [p.to_dict() for p in packages]})


@packages_bp.route("/me/packages/<package_id>", methods=["GET"])
@jwt_required()
def get_my_package(package_id: str):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    package = _get_customer_package(user, package_id)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    from app.services.package_service import get_tracking_timeline

    data = package.to_dict(include_events=True, include_photos=True)
    data["timeline"] = get_tracking_timeline(package)
    return jsonify({"package": data})


@packages_bp.route("/me/packages/<package_id>/invoice/presign", methods=["POST"])
@jwt_required()
def presign_package_invoice(package_id: str):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    package = _get_customer_package(user, package_id)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    if package.invoice_status not in ("pending", "requested"):
        return jsonify({"error": "Invoice upload is not required for this package"}), 400

    if not is_r2_configured():
        return jsonify({"error": "Invoice storage is not configured"}), 503

    data = request.get_json(silent=True) or {}
    filename = (data.get("filename") or "invoice.pdf").strip()
    content_type = (data.get("content_type") or "application/pdf").strip().lower()

    if content_type not in ALLOWED_INVOICE_TYPES:
        return jsonify({"error": "Only JPEG, PNG, WebP, and PDF files are allowed"}), 400

    object_key = build_package_invoice_object_key(
        user.shipping_id, package.tracking_number, filename
    )

    try:
        upload_url = generate_presigned_upload(object_key, content_type)
    except Exception as exc:
        return jsonify({"error": f"Failed to generate upload URL: {exc}"}), 500

    return jsonify(
        {
            "upload_url": upload_url,
            "object_key": object_key,
            "public_url": get_public_url(object_key),
        }
    )


@packages_bp.route("/me/packages/<package_id>/invoice", methods=["POST"])
@jwt_required()
def submit_package_invoice(package_id: str):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    package = _get_customer_package(user, package_id)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    data = request.get_json(silent=True) or {}
    invoice_key = (data.get("invoice_object_key") or "").strip()
    if not invoice_key:
        return jsonify({"error": "invoice_object_key is required"}), 400

    declared_value = data.get("declared_value_usd")
    if declared_value is not None:
        try:
            declared_value = float(declared_value)
        except (TypeError, ValueError):
            return jsonify({"error": "declared_value_usd must be a number"}), 400

    try:
        package = attach_package_invoice(package, invoice_key, declared_value)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"package": package.to_dict()})

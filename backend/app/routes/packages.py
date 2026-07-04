import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.constants import ALLOWED_INVOICE_TYPES
from app.models.package import Package
from app.models.user import User
from app.services.billing_service import attach_package_invoice
from app.services.image_upload_service import (
    ImageUploadError,
    create_upload_presign,
    is_storage_configured,
    parse_presign_fields,
)
from app.services.rate_limit_service import RateLimitExceeded, assert_upload_presign_allowed
from app.utils.auth_decorators import resolve_jwt_user

packages_bp = Blueprint("packages", __name__)


def _get_customer_package(user: User, package_id: str) -> Package | None:
    try:
        pid = uuid.UUID(package_id)
    except ValueError:
        return None
    return Package.query.filter_by(id=pid, customer_id=user.id).first()


@packages_bp.route("/me/packages", methods=["GET"])
@jwt_required()
def list_my_packages():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    packages = (
        Package.query.filter_by(customer_id=user.id)
        .order_by(Package.created_at.desc())
        .all()
    )
    return jsonify({"packages": [p.to_dict() for p in packages]})


@packages_bp.route("/me/packages/<package_id>", methods=["GET"])
@jwt_required()
def get_my_package(package_id: str):
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

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
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    try:
        assert_upload_presign_allowed(str(user.id))
    except RateLimitExceeded as exc:
        return jsonify({"error": str(exc)}), 429

    package = _get_customer_package(user, package_id)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    if package.invoice_status not in ("pending", "requested"):
        return jsonify({"error": "Invoice upload is not required for this package"}), 400

    if not is_storage_configured():
        return jsonify({"error": "Invoice storage is not configured"}), 503

    data = request.get_json(silent=True) or {}
    try:
        filename, content_type, content_length = parse_presign_fields(
            data,
            default_filename="invoice.pdf",
            default_content_type="application/pdf",
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if content_type not in ALLOWED_INVOICE_TYPES:
        return jsonify({"error": "Only JPEG, PNG, WebP, and PDF files are allowed"}), 400

    try:
        return jsonify(
            create_upload_presign(
                content_type=content_type,
                content_length=content_length,
                prefix="invoices",
            )
        )
    except ImageUploadError as exc:
        return jsonify({"error": str(exc)}), exc.status_code or 503
    except Exception as exc:
        return jsonify({"error": f"Failed to generate upload URL: {exc}"}), 500


@packages_bp.route("/me/packages/<package_id>/invoice", methods=["POST"])
@jwt_required()
def submit_package_invoice(package_id: str):
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

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

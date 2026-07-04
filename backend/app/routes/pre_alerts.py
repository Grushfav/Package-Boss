import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.constants import ALLOWED_INVOICE_TYPES
from app.models.pre_alert import PreAlert
from app.services.pre_alert_service import cancel_pre_alert, create_pre_alert
from app.services.image_upload_service import (
    ImageUploadError,
    create_upload_presign,
    is_storage_configured,
    parse_presign_fields,
)
from app.services.rate_limit_service import RateLimitExceeded, assert_upload_presign_allowed
from app.utils.auth_decorators import resolve_jwt_user

pre_alerts_bp = Blueprint("pre_alerts", __name__)


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def _resolve_customer_user():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return None, auth_err
    if user.role != "customer":
        return None, _error("Customer access required", 403)
    return user, None


@pre_alerts_bp.route("/me/pre-alerts", methods=["GET"])
@jwt_required()
def list_my_pre_alerts():
    user, auth_err = _resolve_customer_user()
    if auth_err:
        return auth_err

    alerts = (
        PreAlert.query.filter_by(customer_id=user.id)
        .order_by(PreAlert.created_at.desc())
        .all()
    )
    return jsonify({"pre_alerts": [a.to_dict() for a in alerts]})


@pre_alerts_bp.route("/me/pre-alerts", methods=["POST"])
@jwt_required()
def create_my_pre_alert():
    user, auth_err = _resolve_customer_user()
    if auth_err:
        return auth_err

    data = request.get_json(silent=True) or {}
    carrier_tracking = data.get("carrier_tracking") or ""

    if not carrier_tracking.strip():
        return _error("carrier_tracking is required")

    declared_value = data.get("declared_value_usd")
    if declared_value is not None:
        try:
            declared_value = float(declared_value)
        except (TypeError, ValueError):
            return _error("declared_value_usd must be a number")

    try:
        pre_alert = create_pre_alert(
            customer=user,
            carrier_tracking=carrier_tracking,
            invoice_object_key=data.get("invoice_object_key"),
            merchant=data.get("merchant"),
            description=data.get("description"),
            declared_value_usd=declared_value,
        )
    except ValueError as exc:
        return _error(str(exc))

    return jsonify({"pre_alert": pre_alert.to_dict()}), 201


@pre_alerts_bp.route("/me/pre-alerts/<alert_id>", methods=["GET"])
@jwt_required()
def get_my_pre_alert(alert_id: str):
    user, auth_err = _resolve_customer_user()
    if auth_err:
        return auth_err

    try:
        aid = uuid.UUID(alert_id)
    except ValueError:
        return _error("Invalid pre-alert ID")

    pre_alert = PreAlert.query.filter_by(id=aid, customer_id=user.id).first()
    if not pre_alert:
        return _error("Pre-alert not found", 404)

    return jsonify({"pre_alert": pre_alert.to_dict()})


@pre_alerts_bp.route("/me/pre-alerts/<alert_id>", methods=["DELETE"])
@jwt_required()
def delete_my_pre_alert(alert_id: str):
    user, auth_err = _resolve_customer_user()
    if auth_err:
        return auth_err

    try:
        aid = uuid.UUID(alert_id)
    except ValueError:
        return _error("Invalid pre-alert ID")

    pre_alert = PreAlert.query.filter_by(id=aid, customer_id=user.id).first()
    if not pre_alert:
        return _error("Pre-alert not found", 404)

    try:
        pre_alert = cancel_pre_alert(pre_alert)
    except ValueError as exc:
        return _error(str(exc))

    return jsonify({"pre_alert": pre_alert.to_dict()})


@pre_alerts_bp.route("/me/uploads/invoice/presign", methods=["POST"])
@jwt_required()
def presign_invoice_upload():
    user, auth_err = _resolve_customer_user()
    if auth_err:
        return auth_err

    try:
        assert_upload_presign_allowed(str(user.id))
    except RateLimitExceeded as exc:
        return _error(str(exc), 429)

    if not is_storage_configured():
        return _error("Invoice storage is not configured", 503)

    data = request.get_json(silent=True) or {}
    try:
        filename, content_type, content_length = parse_presign_fields(
            data,
            default_filename="invoice.pdf",
            default_content_type="application/pdf",
        )
    except ValueError as exc:
        return _error(str(exc))

    if content_type not in ALLOWED_INVOICE_TYPES:
        return _error("Only JPEG, PNG, WebP, and PDF files are allowed")

    try:
        return jsonify(
            create_upload_presign(
                content_type=content_type,
                content_length=content_length,
                prefix="invoices",
            )
        )
    except ImageUploadError as exc:
        return _error(str(exc), exc.status_code or 503)
    except Exception as exc:
        return _error(f"Failed to generate upload URL: {exc}", 500)

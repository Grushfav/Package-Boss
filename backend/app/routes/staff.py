from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from app.constants import PACKAGE_STATUSES, SHIPPER_CODES, SHIPPERS, STATUS_LABELS
from app.models.package import Package
from app.models.user import User
from app.services.audit_service import (
    ACTION_PACKAGE_RECEIVED,
    ACTION_PACKAGE_STATUS_UPDATED,
    log_package_action,
)
from app.services.package_service import receive_package, update_package_status
from app.utils.auth_decorators import get_user_from_jwt
from app.services.trn_service import decrypt_trn, format_trn
from app.utils.auth_decorators import warehouse_required

staff_bp = Blueprint("staff", __name__)


def _customer_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "contact_number": user.contact_number,
        "parish": user.parish,
        "shipping_id": user.shipping_id,
        "trn": format_trn(decrypt_trn(user.trn_encrypted)),
    }


@staff_bp.route("/shippers", methods=["GET"])
@warehouse_required()
def list_shippers():
    return jsonify({"shippers": SHIPPERS})


@staff_bp.route("/warehouse/customers", methods=["GET"])
@warehouse_required()
def list_customers():
    q = (request.args.get("q") or "").strip()
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    query = User.query.filter(User.role == "customer")

    if q:
        pattern = f"%{q}%"
        shipping_pattern = f"%{q.upper()}%"
        query = query.filter(
            or_(
                User.shipping_id.ilike(shipping_pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.email.ilike(pattern),
                User.contact_number.ilike(pattern),
            )
        )

    total = query.count()
    users = (
        query.order_by(User.last_name, User.first_name, User.shipping_id)
        .offset(offset)
        .limit(limit)
        .all()
    )

    return jsonify({"customers": [_customer_dict(u) for u in users], "total": total})


@staff_bp.route("/warehouse/customers/search", methods=["GET"])
@warehouse_required()
def search_customers():
    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify({"customers": []})

    pattern = f"%{q}%"
    shipping_pattern = f"%{q.upper()}%"

    users = (
        User.query.filter(User.role == "customer")
        .filter(
            or_(
                User.shipping_id.ilike(shipping_pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.email.ilike(pattern),
                User.contact_number.ilike(pattern),
            )
        )
        .order_by(User.last_name, User.first_name)
        .limit(15)
        .all()
    )

    return jsonify({"customers": [_customer_dict(u) for u in users]})


@staff_bp.route("/staff/customers/<shipping_id>", methods=["GET"])
@warehouse_required()
def lookup_customer(shipping_id: str):
    shipping_id = shipping_id.strip().upper()
    user = User.query.filter_by(shipping_id=shipping_id, role="customer").first()
    if not user:
        return jsonify({"error": "Customer not found"}), 404

    return jsonify({"customer": _customer_dict(user)})


@staff_bp.route("/staff/packages/receive", methods=["POST"])
@warehouse_required()
def receive_package_endpoint():
    data = request.get_json(silent=True) or {}
    shipping_id = (data.get("shipping_id") or "").strip().upper()
    weight_raw = data.get("actual_weight_lbs")
    shipper = (data.get("shipper") or "").strip().lower()

    if not shipping_id:
        return jsonify({"error": "shipping_id is required"}), 400
    if weight_raw is None:
        return jsonify({"error": "actual_weight_lbs is required"}), 400
    if not shipper:
        return jsonify({"error": "shipper is required"}), 400
    if shipper not in SHIPPER_CODES:
        return jsonify({"error": "Invalid shipper"}), 400

    try:
        weight = float(weight_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "actual_weight_lbs must be a number"}), 400

    customer = User.query.filter_by(shipping_id=shipping_id, role="customer").first()
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    photo_keys = data.get("photo_keys") or []
    if not isinstance(photo_keys, list):
        return jsonify({"error": "photo_keys must be an array"}), 400

    try:
        package = receive_package(
            customer=customer,
            actual_weight_lbs=weight,
            carrier_tracking=data.get("carrier_tracking"),
            shipper=shipper,
            photo_keys=photo_keys,
            note=data.get("note"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    actor = get_user_from_jwt()
    if actor:
        log_package_action(
            actor,
            ACTION_PACKAGE_RECEIVED,
            str(package.id),
            f"Received {package.tracking_number} for {customer.shipping_id} ({package.billable_weight_lbs} lbs)",
            metadata={
                "tracking_number": package.tracking_number,
                "shipping_id": customer.shipping_id,
                "shipper": package.shipper,
                "carrier_tracking": package.carrier_tracking,
                "billable_weight_lbs": package.billable_weight_lbs,
                "shipping_cost_usd": float(package.shipping_cost_usd) if package.shipping_cost_usd else None,
            },
        )

    pkg_data = package.to_dict(include_events=True, include_photos=True)
    pkg_data["customer"] = _customer_dict(customer)
    return jsonify({"package": pkg_data}), 201


@staff_bp.route("/staff/packages/<tracking_number>/status", methods=["PATCH"])
@warehouse_required()
def update_status(tracking_number: str):
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip()

    if status not in PACKAGE_STATUSES:
        return jsonify(
            {
                "error": "Invalid status",
                "allowed": PACKAGE_STATUSES,
                "labels": STATUS_LABELS,
            }
        ), 400

    tracking_number = tracking_number.strip().upper()
    package = Package.query.filter_by(tracking_number=tracking_number).first()
    if not package:
        return jsonify({"error": "Package not found"}), 404

    old_status = package.status
    package = update_package_status(package, status, data.get("note"))

    actor = get_user_from_jwt()
    if actor:
        log_package_action(
            actor,
            ACTION_PACKAGE_STATUS_UPDATED,
            str(package.id),
            f"Updated {package.tracking_number}: {STATUS_LABELS.get(old_status, old_status)} → {STATUS_LABELS.get(status, status)}",
            metadata={
                "tracking_number": package.tracking_number,
                "from_status": old_status,
                "to_status": status,
                "note": data.get("note"),
            },
        )

    return jsonify({"package": package.to_dict(include_events=True)})

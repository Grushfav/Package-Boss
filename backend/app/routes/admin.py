import uuid

from flask import Blueprint, jsonify, request

from app.constants import JAMAICA_PARISHES
from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.admin_stats_service import (
    get_overview,
    get_packages_by_status,
    get_packages_timeline,
    get_pre_alerts_vs_receives,
    get_weight_distribution,
)
from app.services.auth_service import hash_password, normalize_phone, validate_password
from app.services.shipping_id_service import generate_shipping_id
from app.services.trn_service import encrypt_trn, hash_trn, normalize_trn
from app.utils.auth_decorators import admin_required, warehouse_required

admin_bp = Blueprint("admin", __name__)


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


@admin_bp.route("/admin/stats/overview", methods=["GET"])
@admin_required()
def stats_overview():
    return jsonify(get_overview())


@admin_bp.route("/admin/stats/packages-timeline", methods=["GET"])
@admin_required()
def stats_packages_timeline():
    days = request.args.get("days", 30, type=int)
    days = max(7, min(days, 90))
    return jsonify({"timeline": get_packages_timeline(days)})


@admin_bp.route("/admin/stats/by-status", methods=["GET"])
@admin_required()
def stats_by_status():
    return jsonify({"statuses": get_packages_by_status()})


@admin_bp.route("/admin/stats/weight-distribution", methods=["GET"])
@admin_required()
def stats_weight_distribution():
    return jsonify({"distribution": get_weight_distribution()})


@admin_bp.route("/admin/stats/pre-alerts-vs-receives", methods=["GET"])
@admin_required()
def stats_pre_alerts_vs_receives():
    days = request.args.get("days", 30, type=int)
    days = max(7, min(days, 90))
    return jsonify({"series": get_pre_alerts_vs_receives(days)})


@admin_bp.route("/admin/activity", methods=["GET"])
@warehouse_required()
def list_activity():
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    action = (request.args.get("action") or "").strip()

    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    query = AuditLog.query.filter(AuditLog.entity_type == "package")
    if action:
        query = query.filter_by(action=action)

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return jsonify({"activity": [log.to_dict() for log in logs], "total": total})


@admin_bp.route("/admin/clerks", methods=["GET"])
@admin_required()
def list_clerks():
    clerks = User.query.filter_by(role="clerk").order_by(User.created_at.desc()).all()
    return jsonify({"clerks": [u.to_dict() for u in clerks]})


@admin_bp.route("/admin/clerks", methods=["POST"])
@admin_required()
def create_clerk():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return _error("Email is required")

    existing = User.query.filter_by(email=email).first()

    # Promote an existing customer to clerk
    if not data.get("password"):
        if not existing:
            return _error("No account found for that email", 404)
        if existing.role != "customer":
            return _error(f"User is already a {existing.role}", 409)
        existing.role = "clerk"
        db.session.commit()
        return jsonify({"user": existing.to_dict(), "promoted": True}), 200

    # Create a new clerk account (same fields as customer signup)
    required = ["first_name", "last_name", "password", "contact_number", "trn", "parish"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return _error(f"Missing required fields: {', '.join(missing)}")

    if existing:
        return _error("An account with this email already exists", 409)

    parish = data["parish"].strip()
    if parish not in JAMAICA_PARISHES:
        return _error("Invalid parish")

    try:
        validate_password(data["password"])
        contact_number = normalize_phone(data["contact_number"])
        trn_hashed = hash_trn(data["trn"])
        normalize_trn(data["trn"])
    except ValueError as exc:
        return _error(str(exc))

    if User.query.filter_by(trn_hash=trn_hashed).first():
        return _error("An account with this TRN already exists", 409)

    user = User(
        email=email,
        password_hash=hash_password(data["password"]),
        first_name=data["first_name"].strip(),
        last_name=data["last_name"].strip(),
        contact_number=contact_number,
        parish=parish,
        trn_encrypted=encrypt_trn(data["trn"]),
        trn_hash=trn_hashed,
        shipping_id=generate_shipping_id(),
        role="clerk",
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({"user": user.to_dict(), "promoted": False}), 201


@admin_bp.route("/admin/clerks/<user_id>", methods=["DELETE"])
@admin_required()
def remove_clerk(user_id: str):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return _error("Invalid user ID")

    user = User.query.get(uid)
    if not user:
        return _error("User not found", 404)
    if user.role != "clerk":
        return _error("User is not a clerk", 400)

    user.role = "customer"
    db.session.commit()
    return jsonify({"user": user.to_dict()})

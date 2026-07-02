import secrets
import uuid

from flask import Blueprint, current_app, jsonify, request

from app.constants import CLERK_PERMISSION_LABELS, CLERK_PERMISSIONS, JAMAICA_PARISHES
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
from app.services.auth_service import hash_password, normalize_phone
from app.services.clerk_permission_service import normalize_clerk_permissions
from app.services.email_service import EmailServiceError, send_clerk_invite_email
from app.services.rate_limit_service import RateLimitExceeded, assert_clerk_invite_resend_allowed
from app.services.reset_token_service import build_reset_url, generate_reset_token, store_invite_token
from app.services.staff_id_service import generate_staff_shipping_id
from app.utils.auth_decorators import admin_required, get_user_from_jwt, permission_required

admin_bp = Blueprint("admin", __name__)


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def _clerk_dict(user: User) -> dict:
    return user.to_dict(include_clerk_fields=True)


def _send_clerk_invite(user: User) -> None:
    raw_token, token_hash = generate_reset_token()
    store_invite_token(str(user.id), token_hash)
    invite_url = build_reset_url(raw_token)
    send_clerk_invite_email(user.email, user.first_name, invite_url)


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
@permission_required("activity")
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


@admin_bp.route("/admin/clerk-permissions", methods=["GET"])
@admin_required()
def list_clerk_permission_options():
    return jsonify(
        {
            "permissions": [
                {"code": code, "label": CLERK_PERMISSION_LABELS[code]}
                for code in CLERK_PERMISSIONS
            ]
        }
    )


@admin_bp.route("/admin/clerks", methods=["GET"])
@admin_required()
def list_clerks():
    include_suspended = request.args.get("include_suspended", "true").lower() in ("1", "true", "yes")
    query = User.query.filter_by(role="clerk")
    if not include_suspended:
        query = query.filter_by(is_active=True)
    clerks = query.order_by(User.is_active.desc(), User.created_at.desc()).all()
    return jsonify({"clerks": [_clerk_dict(u) for u in clerks]})


@admin_bp.route("/admin/clerks", methods=["POST"])
@admin_required()
def create_clerk():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    required = ["first_name", "last_name", "email"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return _error(f"Missing required fields: {', '.join(missing)}")

    if User.query.filter_by(email=email).first():
        return _error("An account with this email already exists", 409)

    contact_number = ""
    if data.get("contact_number"):
        try:
            contact_number = normalize_phone(data["contact_number"])
        except ValueError as exc:
            return _error(str(exc))

    parish = (data.get("parish") or "").strip()
    if parish and parish not in JAMAICA_PARISHES:
        return _error("Invalid parish")

    permissions = normalize_clerk_permissions(data.get("permissions"))

    unusable_secret = secrets.token_urlsafe(32)
    user = User(
        email=email,
        password_hash=hash_password(unusable_secret),
        first_name=data["first_name"].strip(),
        last_name=data["last_name"].strip(),
        contact_number=contact_number,
        parish=parish or None,
        trn=None,
        shipping_id=generate_staff_shipping_id(),
        role="clerk",
        clerk_permissions=permissions,
        must_set_password=True,
        is_active=True,
    )

    db.session.add(user)
    db.session.commit()

    try:
        _send_clerk_invite(user)
    except (RuntimeError, EmailServiceError) as exc:
        current_app.logger.error("Clerk invite email failed for %s: %s", email, exc)
        return _error("Clerk created but invite email could not be sent", 503)

    return jsonify({"user": _clerk_dict(user)}), 201


@admin_bp.route("/admin/clerks/<user_id>", methods=["PATCH"])
@admin_required()
def update_clerk(user_id: str):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return _error("Invalid user ID")

    user = User.query.get(uid)
    if not user or user.role != "clerk":
        return _error("Clerk not found", 404)

    data = request.get_json(silent=True) or {}
    if "permissions" in data:
        user.clerk_permissions = normalize_clerk_permissions(data.get("permissions"))

    if "first_name" in data:
        user.first_name = (data["first_name"] or "").strip()
    if "last_name" in data:
        user.last_name = (data["last_name"] or "").strip()
    if "contact_number" in data:
        if data["contact_number"]:
            try:
                user.contact_number = normalize_phone(data["contact_number"])
            except ValueError as exc:
                return _error(str(exc))
        else:
            user.contact_number = ""
    if "parish" in data:
        parish = (data.get("parish") or "").strip()
        if parish and parish not in JAMAICA_PARISHES:
            return _error("Invalid parish")
        user.parish = parish or None

    if "is_active" in data:
        user.is_active = bool(data.get("is_active"))

    db.session.commit()
    return jsonify({"user": _clerk_dict(user)})


@admin_bp.route("/admin/clerks/<user_id>/resend-invite", methods=["POST"])
@admin_required()
def resend_clerk_invite(user_id: str):
    admin = get_user_from_jwt()
    if not admin:
        return _error("Admin access required", 403)

    try:
        assert_clerk_invite_resend_allowed(str(admin.id))
    except RateLimitExceeded as exc:
        return _error(str(exc), 429)

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return _error("Invalid user ID")

    user = User.query.get(uid)
    if not user or user.role != "clerk" or not user.is_active:
        return _error("Clerk not found", 404)

    try:
        _send_clerk_invite(user)
    except (RuntimeError, EmailServiceError) as exc:
        current_app.logger.error("Clerk invite resend failed for %s: %s", user.email, exc)
        return _error("Invite email could not be sent", 503)

    return jsonify({"message": "Invite email sent"})


@admin_bp.route("/admin/clerks/<user_id>/reactivate", methods=["POST"])
@admin_required()
def reactivate_clerk(user_id: str):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return _error("Invalid user ID")

    user = User.query.get(uid)
    if not user or user.role != "clerk":
        return _error("Clerk not found", 404)

    user.is_active = True
    db.session.commit()
    return jsonify({"user": _clerk_dict(user)})


@admin_bp.route("/admin/clerks/<user_id>", methods=["DELETE"])
@admin_required()
def deactivate_clerk(user_id: str):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return _error("Invalid user ID")

    user = User.query.get(uid)
    if not user:
        return _error("User not found", 404)
    if user.role != "clerk":
        return _error("User is not a clerk", 400)

    user.is_active = False
    db.session.commit()
    return jsonify({"user": _clerk_dict(user)})

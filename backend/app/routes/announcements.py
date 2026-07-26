import uuid

from flask import Blueprint, jsonify, make_response, request
from flask_jwt_extended import jwt_required, verify_jwt_in_request

from app.services.announcement_service import (
    broadcast_announcement,
    dismiss_announcement,
    list_active_banners,
    list_user_inbox,
    mark_announcement_read,
    pick_primary_banner,
)
from app.utils.auth_decorators import resolve_jwt_user

announcements_bp = Blueprint("announcements", __name__)

VALID_CONTEXTS = ("public", "customer", "staff")


@announcements_bp.route("/announcements/active", methods=["GET"])
def active_announcements():
    context = (request.args.get("context") or "public").strip().lower()
    if context not in VALID_CONTEXTS:
        return jsonify({"error": "Invalid context"}), 400

    user = None
    try:
        verify_jwt_in_request(optional=True)
        user, _ = resolve_jwt_user()
    except Exception:
        user = None

    banners = list_active_banners(context, user=user)
    primary = pick_primary_banner(banners)
    modals = [b for b in banners if b["display_as"] == "modal"]

    response = make_response(
        jsonify(
            {
                "banner": primary if primary and primary.get("display_as") == "banner" else None,
                "modals": modals,
            }
        )
    )
    response.headers["Cache-Control"] = "public, max-age=60"
    return response


@announcements_bp.route("/me/announcements", methods=["GET"])
@jwt_required()
def my_announcements():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    return jsonify({"announcements": list_user_inbox(user)})


@announcements_bp.route("/me/announcements/<announcement_id>/dismiss", methods=["POST"])
@jwt_required()
def dismiss_my_announcement(announcement_id: str):
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    try:
        aid = uuid.UUID(announcement_id)
    except ValueError:
        return jsonify({"error": "Invalid announcement ID"}), 400

    try:
        dismiss_announcement(user, aid)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"message": "Dismissed"})


@announcements_bp.route("/me/announcements/<announcement_id>/read", methods=["POST"])
@jwt_required()
def read_my_announcement(announcement_id: str):
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    try:
        aid = uuid.UUID(announcement_id)
    except ValueError:
        return jsonify({"error": "Invalid announcement ID"}), 400

    try:
        mark_announcement_read(user, aid)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"message": "Marked as read"})

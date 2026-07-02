import uuid

from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token

from app.constants import JAMAICA_PARISHES
from app.extensions import db
from app.models.user import User
from app.services.auth_service import (
    hash_password,
    normalize_phone,
    validate_password,
    verify_password,
)
from app.services.email_service import EmailServiceError, send_password_reset_email, send_welcome_email
from app.services.rate_limit_service import (
    RateLimitExceeded,
    assert_forgot_password_allowed,
    assert_login_allowed,
    assert_register_allowed,
    assert_reset_password_allowed,
    record_login_failure,
)
from app.services.reset_token_service import (
    build_reset_url,
    delete_reset_token,
    generate_reset_token,
    get_user_id_for_token,
    store_reset_token,
)
from app.services.shipping_id_service import generate_shipping_id
from app.services.trn_service import normalize_trn
from app.services.warehouse_service import build_shipping_address

auth_bp = Blueprint("auth", __name__)


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def _rate_limit_error(exc: RateLimitExceeded):
    return _error(str(exc), 429)


@auth_bp.route("/auth/register", methods=["POST"])
def register():
    try:
        assert_register_allowed()
    except RateLimitExceeded as exc:
        return _rate_limit_error(exc)

    data = request.get_json(silent=True) or {}

    required = ["first_name", "last_name", "email", "password", "contact_number", "parish"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return _error(f"Missing required fields: {', '.join(missing)}")

    email = data["email"].strip().lower()
    parish = data["parish"].strip()

    if parish not in JAMAICA_PARISHES:
        return _error("Invalid parish")

    if User.query.filter_by(email=email).first():
        return _error("An account with this email already exists", 409)

    try:
        validate_password(data["password"])
        contact_number = normalize_phone(data["contact_number"])
        trn = normalize_trn(data.get("trn"))
    except ValueError as exc:
        return _error(str(exc))

    if trn and User.query.filter_by(trn=trn).first():
        return _error("An account with this TRN already exists", 409)

    if not data.get("accept_terms"):
        return _error("You must accept the Terms and Conditions to create an account")

    shipping_id = generate_shipping_id()

    user = User(
        email=email,
        password_hash=hash_password(data["password"]),
        first_name=data["first_name"].strip(),
        last_name=data["last_name"].strip(),
        contact_number=contact_number,
        parish=parish,
        trn=trn,
        shipping_id=shipping_id,
        terms_accepted_at=datetime.utcnow(),
    )

    db.session.add(user)
    db.session.commit()

    shipping_address = build_shipping_address(user.shipping_id)
    try:
        send_welcome_email(user.email, user.first_name, user.shipping_id, shipping_address)
    except (EmailServiceError, NotImplementedError) as exc:
        current_app.logger.warning("Welcome email not sent for %s: %s", user.email, exc)

    access_token = create_access_token(identity=str(user.id))

    return jsonify(
        {
            "access_token": access_token,
            "user": user.to_dict(include_trn=True),
            "shipping_address": shipping_address,
        }
    ), 201


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return _error("Email and password are required")

    try:
        assert_login_allowed(email)
    except RateLimitExceeded as exc:
        return _rate_limit_error(exc)

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(user.password_hash, password):
        try:
            record_login_failure(email)
        except RateLimitExceeded as exc:
            return _rate_limit_error(exc)
        return _error("Invalid email or password", 401)

    if not user.is_active:
        return _error("This account has been deactivated", 403)

    if user.must_set_password:
        return _error(
            "Please use the invite link in your email to set your password before logging in.",
            403,
        )

    access_token = create_access_token(identity=str(user.id))

    return jsonify(
        {
            "access_token": access_token,
            "user": user.to_dict(
                include_trn=user.role == "customer",
                include_clerk_fields=user.role in ("clerk", "admin"),
            ),
        }
    )


@auth_bp.route("/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return _error("Email is required")

    try:
        assert_forgot_password_allowed(email)
    except RateLimitExceeded as exc:
        return _rate_limit_error(exc)

    user = User.query.filter_by(email=email).first()
    if user:
        try:
            raw_token, token_hash = generate_reset_token()
            store_reset_token(str(user.id), token_hash)
            reset_url = build_reset_url(raw_token)
            send_password_reset_email(user.email, user.first_name, reset_url)
        except (RuntimeError, EmailServiceError) as exc:
            current_app.logger.error("Password reset failed for %s: %s", email, exc)
            return _error("Password reset is temporarily unavailable", 503)

    return jsonify(
        {"message": "If an account exists for that email, we sent reset instructions."}
    )


@auth_bp.route("/auth/reset-password/validate", methods=["GET"])
def validate_reset_token():
    try:
        assert_reset_password_allowed()
    except RateLimitExceeded as exc:
        return _rate_limit_error(exc)

    token = request.args.get("token", "")
    if not token:
        return jsonify({"valid": False})

    user_id = get_user_id_for_token(token)
    return jsonify({"valid": user_id is not None})


@auth_bp.route("/auth/reset-password", methods=["POST"])
def reset_password():
    try:
        assert_reset_password_allowed()
    except RateLimitExceeded as exc:
        return _rate_limit_error(exc)

    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    new_password = data.get("new_password") or ""

    if not token or not new_password:
        return _error("Token and new password are required")

    try:
        validate_password(new_password)
    except ValueError as exc:
        return _error(str(exc))

    user_id = get_user_id_for_token(token)
    if not user_id:
        return _error("Invalid or expired reset link", 400)

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return _error("Invalid or expired reset link", 400)

    user = User.query.get(uid)
    if not user:
        return _error("Invalid or expired reset link", 400)

    user.password_hash = hash_password(new_password)
    user.must_set_password = False
    db.session.commit()
    delete_reset_token(token)

    return jsonify({"message": "Password updated successfully. You can now log in."})

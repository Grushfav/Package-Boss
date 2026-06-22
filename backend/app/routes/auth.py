import uuid

from datetime import datetime

from flask import Blueprint, jsonify, request
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
from app.services.email_service import send_password_reset_email
from app.services.reset_token_service import (
    build_reset_url,
    check_rate_limit,
    delete_reset_token,
    generate_reset_token,
    get_user_id_for_token,
    store_reset_token,
)
from app.services.shipping_id_service import generate_shipping_id
from app.services.trn_service import encrypt_trn, hash_trn, normalize_trn
from app.services.warehouse_service import build_shipping_address

auth_bp = Blueprint("auth", __name__)


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


@auth_bp.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    required = ["first_name", "last_name", "email", "password", "contact_number", "trn", "parish"]
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
        trn_hashed = hash_trn(data["trn"])
        normalize_trn(data["trn"])
    except ValueError as exc:
        return _error(str(exc))

    if User.query.filter_by(trn_hash=trn_hashed).first():
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
        trn_encrypted=encrypt_trn(data["trn"]),
        trn_hash=trn_hashed,
        shipping_id=shipping_id,
        terms_accepted_at=datetime.utcnow(),
    )

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))

    return jsonify(
        {
            "access_token": access_token,
            "user": user.to_dict(include_trn_masked=True),
            "shipping_address": build_shipping_address(user.shipping_id),
        }
    ), 201


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return _error("Email and password are required")

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(user.password_hash, password):
        return _error("Invalid email or password", 401)

    access_token = create_access_token(identity=str(user.id))

    return jsonify(
        {
            "access_token": access_token,
            "user": user.to_dict(include_trn_masked=True),
        }
    )


@auth_bp.route("/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return _error("Email is required")

    try:
        check_rate_limit(email)
    except ValueError as exc:
        return _error(str(exc), 429)

    user = User.query.filter_by(email=email).first()
    if user:
        try:
            raw_token, token_hash = generate_reset_token()
            store_reset_token(str(user.id), token_hash)
            reset_url = build_reset_url(raw_token)
            send_password_reset_email(user.email, user.first_name, reset_url)
        except RuntimeError:
            return _error("Password reset is temporarily unavailable", 503)

    return jsonify(
        {"message": "If an account exists for that email, we sent reset instructions."}
    )


@auth_bp.route("/auth/reset-password/validate", methods=["GET"])
def validate_reset_token():
    token = request.args.get("token", "")
    if not token:
        return jsonify({"valid": False})

    user_id = get_user_id_for_token(token)
    return jsonify({"valid": user_id is not None})


@auth_bp.route("/auth/reset-password", methods=["POST"])
def reset_password():
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
    db.session.commit()
    delete_reset_token(token)

    return jsonify({"message": "Password updated successfully. You can now log in."})

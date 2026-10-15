import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta

import requests
from flask import current_app
from flask_jwt_extended import create_access_token, get_jwt

from app.constants import JAMAICA_PARISHES
from app.extensions import db
from app.models.data_deletion_request import DataDeletionRequest
from app.models.user import User
from app.services.auth_service import hash_password, normalize_phone
from app.services.email_service import EmailServiceError, send_welcome_email
from app.services.shipping_id_service import generate_shipping_id
from app.services.trn_service import normalize_trn
from app.services.warehouse_service import build_shipping_address

FACEBOOK_SIGNUP_TOKEN_TYPE = "facebook_signup"
FACEBOOK_SIGNUP_TOKEN_MINUTES = 15
GRAPH_API_VERSION = "v21.0"


class FacebookAuthError(ValueError):
    pass


def _facebook_app_id() -> str:
    app_id = (current_app.config.get("FACEBOOK_APP_ID") or "").strip()
    if not app_id:
        raise FacebookAuthError("Facebook sign-in is not configured")
    return app_id


def _facebook_app_secret() -> str:
    secret = (current_app.config.get("FACEBOOK_APP_SECRET") or "").strip()
    if not secret:
        raise FacebookAuthError("Facebook sign-in is not configured")
    return secret


def verify_facebook_access_token(access_token: str) -> dict:
    if not access_token or not access_token.strip():
        raise FacebookAuthError("Facebook access token is required")

    token = access_token.strip()
    app_id = _facebook_app_id()
    app_secret = _facebook_app_secret()

    try:
        debug = requests.get(
            f"https://graph.facebook.com/{GRAPH_API_VERSION}/debug_token",
            params={
                "input_token": token,
                "access_token": f"{app_id}|{app_secret}",
            },
            timeout=15,
        )
        debug.raise_for_status()
        debug_data = (debug.json() or {}).get("data") or {}
    except requests.RequestException as exc:
        raise FacebookAuthError("Could not verify Facebook token") from exc

    if not debug_data.get("is_valid"):
        raise FacebookAuthError("Invalid Facebook sign-in token")
    if str(debug_data.get("app_id") or "") != app_id:
        raise FacebookAuthError("Facebook token is for a different app")

    try:
        me = requests.get(
            f"https://graph.facebook.com/{GRAPH_API_VERSION}/me",
            params={
                "fields": "id,email,first_name,last_name",
                "access_token": token,
            },
            timeout=15,
        )
        me.raise_for_status()
        profile = me.json() or {}
    except requests.RequestException as exc:
        raise FacebookAuthError("Could not load Facebook profile") from exc

    facebook_id = str(profile.get("id") or "").strip()
    if not facebook_id:
        raise FacebookAuthError("Invalid Facebook account")

    email = (profile.get("email") or "").strip().lower()
    if not email:
        raise FacebookAuthError(
            "Your Facebook account must share an email address. "
            "Update Facebook permissions or sign up with email instead."
        )

    first_name = (profile.get("first_name") or email.split("@")[0]).strip()
    last_name = (profile.get("last_name") or "").strip() or "Member"

    return {
        "facebook_id": facebook_id,
        "email": email,
        "first_name": first_name[:80],
        "last_name": last_name[:80],
    }


def create_facebook_signup_token(profile: dict) -> str:
    return create_access_token(
        identity=f"facebook:{profile['facebook_id']}",
        additional_claims={
            "type": FACEBOOK_SIGNUP_TOKEN_TYPE,
            "facebook_id": profile["facebook_id"],
            "email": profile["email"],
            "first_name": profile["first_name"],
            "last_name": profile["last_name"],
        },
        expires_delta=timedelta(minutes=FACEBOOK_SIGNUP_TOKEN_MINUTES),
    )


def _read_facebook_signup_claims() -> dict:
    claims = get_jwt()
    if claims.get("type") != FACEBOOK_SIGNUP_TOKEN_TYPE:
        raise FacebookAuthError("Invalid or expired Facebook signup session")

    facebook_id = claims.get("facebook_id")
    email = (claims.get("email") or "").strip().lower()
    first_name = (claims.get("first_name") or "").strip()
    last_name = (claims.get("last_name") or "").strip()

    if not facebook_id or not email or not first_name or not last_name:
        raise FacebookAuthError("Invalid or expired Facebook signup session")

    return {
        "facebook_id": str(facebook_id),
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
    }


def authenticate_facebook_user(profile: dict) -> tuple[User | None, dict | None]:
    """Return (user, None) on login or (None, pending_signup_dict) for new customers."""
    facebook_user = User.query.filter_by(facebook_id=profile["facebook_id"]).first()
    if facebook_user:
        return facebook_user, None

    email_user = User.query.filter_by(email=profile["email"]).first()
    if email_user:
        if email_user.role != "customer":
            raise FacebookAuthError(
                "This email is registered for staff access. Sign in with your password instead."
            )
        if not email_user.is_active:
            raise FacebookAuthError("This account has been deactivated")
        if email_user.must_set_password:
            raise FacebookAuthError(
                "Please use the invite link in your email to set your password before signing in."
            )
        email_user.facebook_id = profile["facebook_id"]
        db.session.commit()
        return email_user, None

    return None, {
        "needs_profile": True,
        "signup_token": create_facebook_signup_token(profile),
        "email": profile["email"],
        "first_name": profile["first_name"],
        "last_name": profile["last_name"],
    }


def complete_facebook_signup(data: dict) -> tuple[User, dict]:
    profile = _read_facebook_signup_claims()

    if User.query.filter_by(facebook_id=profile["facebook_id"]).first():
        raise FacebookAuthError("A Facebook account with this profile already exists")
    if User.query.filter_by(email=profile["email"]).first():
        raise FacebookAuthError("An account with this email already exists")

    parish = (data.get("parish") or "").strip()
    if parish not in JAMAICA_PARISHES:
        raise FacebookAuthError("Invalid parish")

    if not data.get("accept_terms"):
        raise FacebookAuthError("You must accept the Terms and Conditions to create an account")

    try:
        contact_number = normalize_phone(data.get("contact_number") or "")
        trn = normalize_trn(data.get("trn"))
    except ValueError as exc:
        raise FacebookAuthError(str(exc)) from exc

    if trn and User.query.filter_by(trn=trn).first():
        raise FacebookAuthError("An account with this TRN already exists")

    shipping_id = generate_shipping_id()
    user = User(
        email=profile["email"],
        password_hash=hash_password(secrets.token_urlsafe(32)),
        first_name=profile["first_name"],
        last_name=profile["last_name"],
        contact_number=contact_number,
        parish=parish,
        trn=trn,
        shipping_id=shipping_id,
        facebook_id=profile["facebook_id"],
        terms_accepted_at=datetime.utcnow(),
    )
    db.session.add(user)
    db.session.commit()

    shipping_address = build_shipping_address(user.shipping_id)
    try:
        send_welcome_email(user.email, user.first_name, user.shipping_id, shipping_address)
    except (EmailServiceError, NotImplementedError) as exc:
        current_app.logger.warning("Welcome email not sent for %s: %s", user.email, exc)

    return user, shipping_address


def parse_facebook_signed_request(signed_request: str) -> dict:
    if not signed_request or "." not in signed_request:
        raise FacebookAuthError("Invalid signed_request")

    encoded_sig, payload = signed_request.split(".", 1)
    app_secret = _facebook_app_secret()

    def _b64decode(value: str) -> bytes:
        padding = "=" * (-len(value) % 4)
        return base64.urlsafe_b64decode(value + padding)

    try:
        sig = _b64decode(encoded_sig)
        data = json.loads(_b64decode(payload).decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise FacebookAuthError("Invalid signed_request encoding") from exc

    expected = hmac.new(app_secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise FacebookAuthError("Invalid signed_request signature")

    if data.get("algorithm", "").upper() != "HMAC-SHA256":
        raise FacebookAuthError("Unsupported signed_request algorithm")

    return data


def process_facebook_data_deletion(signed_request: str) -> dict:
    """Handle Meta data deletion callback. Returns confirmation payload for Meta."""
    data = parse_facebook_signed_request(signed_request)
    facebook_user_id = str(data.get("user_id") or "").strip()
    if not facebook_user_id:
        raise FacebookAuthError("signed_request missing user_id")

    confirmation_code = secrets.token_urlsafe(24)
    user = User.query.filter_by(facebook_id=facebook_user_id).first()
    notes = "Facebook data deletion callback"
    now = datetime.utcnow()

    if user:
        user.facebook_id = None
        user.updated_at = now
        # Keep operational account; unlink Facebook identity as Meta requires.
        notes = f"Unlinked Facebook ID for user {user.shipping_id}"

    entry = DataDeletionRequest(
        confirmation_code=confirmation_code,
        facebook_user_id=facebook_user_id,
        user_id=user.id if user else None,
        status="completed",
        created_at=now,
        completed_at=now,
        notes=notes,
    )
    db.session.add(entry)
    db.session.commit()

    frontend = (current_app.config.get("FRONTEND_URL") or "http://localhost:5173").rstrip("/")
    return {
        "url": f"{frontend}/deletion-status?code={confirmation_code}",
        "confirmation_code": confirmation_code,
    }


def get_deletion_request_status(confirmation_code: str) -> DataDeletionRequest | None:
    code = (confirmation_code or "").strip()
    if not code:
        return None
    return db.session.get(DataDeletionRequest, code)

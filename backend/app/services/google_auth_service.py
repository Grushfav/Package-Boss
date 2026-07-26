import secrets
from datetime import timedelta

from flask import current_app
from flask_jwt_extended import create_access_token, get_jwt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.constants import JAMAICA_PARISHES
from app.extensions import db
from app.models.user import User
from app.services.auth_service import hash_password, normalize_phone
from app.services.email_service import EmailServiceError, send_welcome_email
from app.services.shipping_id_service import generate_shipping_id
from app.services.token_service import access_token_for_user
from app.services.trn_service import normalize_trn
from app.services.warehouse_service import build_shipping_address

GOOGLE_SIGNUP_TOKEN_TYPE = "google_signup"
GOOGLE_SIGNUP_TOKEN_MINUTES = 15


class GoogleAuthError(ValueError):
    pass


def _google_client_id() -> str:
    client_id = (current_app.config.get("GOOGLE_CLIENT_ID") or "").strip()
    if not client_id:
        raise GoogleAuthError("Google sign-in is not configured")
    return client_id


def verify_google_credential(credential: str) -> dict:
    if not credential or not credential.strip():
        raise GoogleAuthError("Google credential is required")

    try:
        payload = id_token.verify_oauth2_token(
            credential.strip(),
            google_requests.Request(),
            _google_client_id(),
        )
    except ValueError as exc:
        raise GoogleAuthError("Invalid Google sign-in token") from exc

    if payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise GoogleAuthError("Invalid Google token issuer")

    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise GoogleAuthError("Google account email is required")
    if not payload.get("email_verified"):
        raise GoogleAuthError("Google account email is not verified")

    google_id = payload.get("sub")
    if not google_id:
        raise GoogleAuthError("Invalid Google account")

    first_name = (payload.get("given_name") or email.split("@")[0]).strip()
    last_name = (payload.get("family_name") or "").strip() or "Member"

    return {
        "google_id": str(google_id),
        "email": email,
        "first_name": first_name[:80],
        "last_name": last_name[:80],
    }


def create_google_signup_token(profile: dict) -> str:
    return create_access_token(
        identity=f"google:{profile['google_id']}",
        additional_claims={
            "type": GOOGLE_SIGNUP_TOKEN_TYPE,
            "google_id": profile["google_id"],
            "email": profile["email"],
            "first_name": profile["first_name"],
            "last_name": profile["last_name"],
        },
        expires_delta=timedelta(minutes=GOOGLE_SIGNUP_TOKEN_MINUTES),
    )


def _read_google_signup_claims() -> dict:
    claims = get_jwt()
    if claims.get("type") != GOOGLE_SIGNUP_TOKEN_TYPE:
        raise GoogleAuthError("Invalid or expired Google signup session")

    google_id = claims.get("google_id")
    email = (claims.get("email") or "").strip().lower()
    first_name = (claims.get("first_name") or "").strip()
    last_name = (claims.get("last_name") or "").strip()

    if not google_id or not email or not first_name or not last_name:
        raise GoogleAuthError("Invalid or expired Google signup session")

    return {
        "google_id": str(google_id),
        "email": email,
        "first_name": first_name[:80],
        "last_name": last_name[:80],
    }


def authenticate_google_user(profile: dict) -> tuple[User | None, dict | None]:
    """Return (user, None) on login or (None, pending_signup_dict) for new customers."""
    google_user = User.query.filter_by(google_id=profile["google_id"]).first()
    if google_user:
        return google_user, None

    email_user = User.query.filter_by(email=profile["email"]).first()
    if email_user:
        if email_user.role != "customer":
            raise GoogleAuthError(
                "This email is registered for staff access. Sign in with your password instead."
            )
        if not email_user.is_active:
            raise GoogleAuthError("This account has been deactivated")
        if email_user.must_set_password:
            raise GoogleAuthError(
                "Please use the invite link in your email to set your password before signing in."
            )
        email_user.google_id = profile["google_id"]
        db.session.commit()
        return email_user, None

    return None, {
        "needs_profile": True,
        "signup_token": create_google_signup_token(profile),
        "email": profile["email"],
        "first_name": profile["first_name"],
        "last_name": profile["last_name"],
    }


def complete_google_signup(data: dict) -> tuple[User, dict]:
    profile = _read_google_signup_claims()

    if User.query.filter_by(google_id=profile["google_id"]).first():
        raise GoogleAuthError("A Google account with this profile already exists")
    if User.query.filter_by(email=profile["email"]).first():
        raise GoogleAuthError("An account with this email already exists")

    parish = (data.get("parish") or "").strip()
    if parish not in JAMAICA_PARISHES:
        raise GoogleAuthError("Invalid parish")

    if not data.get("accept_terms"):
        raise GoogleAuthError("You must accept the Terms and Conditions to create an account")

    try:
        contact_number = normalize_phone(data.get("contact_number") or "")
        trn = normalize_trn(data.get("trn"))
    except ValueError as exc:
        raise GoogleAuthError(str(exc)) from exc

    if trn and User.query.filter_by(trn=trn).first():
        raise GoogleAuthError("An account with this TRN already exists")

    from datetime import datetime

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
        google_id=profile["google_id"],
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

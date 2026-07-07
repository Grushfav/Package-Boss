import hashlib
import secrets
from datetime import datetime, timedelta

from flask import current_app

from app.extensions import db
from app.models.password_reset_token import PasswordResetToken

RESET_TTL_SECONDS = 900  # 15 minutes
INVITE_TTL_SECONDS = 86400  # 24 hours


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _expires_at(ttl: int) -> datetime:
    return datetime.utcnow() + timedelta(seconds=ttl)


def _purge_expired_for_user(user_id: str) -> None:
    now = datetime.utcnow()
    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.expires_at <= now,
    ).delete(synchronize_session=False)


def _store_reset(user_id: str, token_hash: str, ttl: int) -> None:
    _purge_expired_for_user(user_id)
    PasswordResetToken.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    db.session.add(
        PasswordResetToken(
            token_hash=token_hash,
            user_id=user_id,
            expires_at=_expires_at(ttl),
        )
    )
    db.session.commit()


def _get_reset(token_hash: str) -> str | None:
    row = PasswordResetToken.query.get(token_hash)
    if not row:
        return None
    if datetime.utcnow() > row.expires_at:
        db.session.delete(row)
        db.session.commit()
        return None
    return str(row.user_id)


def generate_reset_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, _hash_token(raw)


def store_reset_token(user_id: str, token_hash: str, ttl: int = RESET_TTL_SECONDS) -> None:
    _store_reset(user_id, token_hash, ttl)


def store_invite_token(user_id: str, token_hash: str) -> None:
    _store_reset(user_id, token_hash, INVITE_TTL_SECONDS)


def get_user_id_for_token(raw_token: str) -> str | None:
    return _get_reset(_hash_token(raw_token))


def delete_reset_token(raw_token: str) -> None:
    token_hash = _hash_token(raw_token)
    row = PasswordResetToken.query.get(token_hash)
    if row:
        db.session.delete(row)
        db.session.commit()


def build_reset_url(raw_token: str, *, invite: bool = False) -> str:
    frontend = current_app.config.get("FRONTEND_URL", "http://localhost:5173")
    url = f"{frontend}/reset-password?token={raw_token}"
    if invite:
        url += "&invite=1"
    return url

import hashlib
import secrets
import time

from flask import current_app

RESET_TTL_SECONDS = 900  # 15 minutes
INVITE_TTL_SECONDS = 86400  # 24 hours

_reset_tokens: dict[str, tuple[str, float]] = {}


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _store_reset(token_hash: str, user_id: str, ttl: int = RESET_TTL_SECONDS) -> None:
    _reset_tokens[token_hash] = (user_id, time.time() + ttl)


def _get_reset(token_hash: str) -> str | None:
    entry = _reset_tokens.get(token_hash)
    if not entry:
        return None
    user_id, expires = entry
    if time.time() > expires:
        _reset_tokens.pop(token_hash, None)
        return None
    return user_id


def generate_reset_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, _hash_token(raw)


def store_reset_token(user_id: str, token_hash: str, ttl: int = RESET_TTL_SECONDS) -> None:
    _store_reset(token_hash, user_id, ttl)


def store_invite_token(user_id: str, token_hash: str) -> None:
    _store_reset(token_hash, user_id, INVITE_TTL_SECONDS)


def get_user_id_for_token(raw_token: str) -> str | None:
    return _get_reset(_hash_token(raw_token))


def delete_reset_token(raw_token: str) -> None:
    _reset_tokens.pop(_hash_token(raw_token), None)


def build_reset_url(raw_token: str) -> str:
    frontend = current_app.config.get("FRONTEND_URL", "http://localhost:5173")
    return f"{frontend}/reset-password?token={raw_token}"

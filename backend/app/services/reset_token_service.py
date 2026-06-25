import hashlib
import secrets
import time

from flask import current_app, request

RESET_TTL_SECONDS = 900  # 15 minutes
RATE_LIMIT_TTL = 3600
RATE_LIMIT_MAX = 3

_reset_tokens: dict[str, tuple[str, float]] = {}
_rate_limits: dict[str, tuple[int, float]] = {}


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _store_reset(token_hash: str, user_id: str) -> None:
    _reset_tokens[token_hash] = (user_id, time.time() + RESET_TTL_SECONDS)


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


def store_reset_token(user_id: str, token_hash: str) -> None:
    _store_reset(token_hash, user_id)


def get_user_id_for_token(raw_token: str) -> str | None:
    return _get_reset(_hash_token(raw_token))


def delete_reset_token(raw_token: str) -> None:
    _reset_tokens.pop(_hash_token(raw_token), None)


def check_rate_limit(email: str) -> None:
    now = time.time()
    ip = request.remote_addr or "unknown"
    for key in (f"reset_attempts:email:{email}", f"reset_attempts:ip:{ip}"):
        count, expires = _rate_limits.get(key, (0, now + RATE_LIMIT_TTL))
        if now > expires:
            count, expires = 0, now + RATE_LIMIT_TTL
        count += 1
        _rate_limits[key] = (count, expires)
        if count > RATE_LIMIT_MAX:
            raise ValueError("Too many reset attempts. Try again later.")


def build_reset_url(raw_token: str) -> str:
    frontend = current_app.config.get("FRONTEND_URL", "http://localhost:5173")
    return f"{frontend}/reset-password?token={raw_token}"

import hashlib
import secrets

from flask import current_app, request

from app.extensions import redis_client

RESET_TTL_SECONDS = 900  # 15 minutes
RATE_LIMIT_TTL = 3600
RATE_LIMIT_MAX = 3


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def generate_reset_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, _hash_token(raw)


def store_reset_token(user_id: str, token_hash: str) -> None:
    if redis_client is None:
        raise RuntimeError("Redis is required for password reset")
    redis_client.setex(f"password_reset:{token_hash}", RESET_TTL_SECONDS, user_id)


def get_user_id_for_token(raw_token: str) -> str | None:
    if redis_client is None:
        return None
    token_hash = _hash_token(raw_token)
    return redis_client.get(f"password_reset:{token_hash}")


def delete_reset_token(raw_token: str) -> None:
    if redis_client is None:
        return
    token_hash = _hash_token(raw_token)
    redis_client.delete(f"password_reset:{token_hash}")


def check_rate_limit(email: str) -> None:
    if redis_client is None:
        return

    ip = request.remote_addr or "unknown"
    for key in (f"reset_attempts:email:{email}", f"reset_attempts:ip:{ip}"):
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, RATE_LIMIT_TTL)
        if count > RATE_LIMIT_MAX:
            raise ValueError("Too many reset attempts. Try again later.")


def build_reset_url(raw_token: str) -> str:
    frontend = current_app.config.get("FRONTEND_URL", "http://localhost:5173")
    return f"{frontend}/reset-password?token={raw_token}"

import time

from flask import request

# In-memory buckets: key -> (count, window_expires_at)
_buckets: dict[str, tuple[int, float]] = {}


class RateLimitExceeded(ValueError):
    pass


def get_client_ip() -> str:
    forwarded = (request.headers.get("X-Forwarded-For") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _get_count(key: str) -> int:
    now = time.time()
    entry = _buckets.get(key)
    if not entry:
        return 0
    count, expires = entry
    if now > expires:
        return 0
    return count


def _increment(key: str, window_seconds: int) -> int:
    now = time.time()
    count, expires = _buckets.get(key, (0, now + window_seconds))
    if now > expires:
        count, expires = 0, now + window_seconds
    count += 1
    _buckets[key] = (count, expires)
    return count


def assert_rate_limit(
    key: str,
    *,
    max_attempts: int,
    window_seconds: int,
    message: str,
) -> None:
    count = _increment(key, window_seconds)
    if count > max_attempts:
        raise RateLimitExceeded(message)


def assert_rate_limits(
    keys: list[str],
    *,
    max_attempts: int,
    window_seconds: int,
    message: str,
) -> None:
    for key in keys:
        assert_rate_limit(
            key,
            max_attempts=max_attempts,
            window_seconds=window_seconds,
            message=message,
        )


def assert_not_rate_limited(
    keys: list[str],
    *,
    max_attempts: int,
    message: str,
) -> None:
    for key in keys:
        if _get_count(key) >= max_attempts:
            raise RateLimitExceeded(message)


def record_failure(
    keys: list[str],
    *,
    max_attempts: int,
    window_seconds: int,
    message: str,
) -> None:
    for key in keys:
        count = _increment(key, window_seconds)
        if count > max_attempts:
            raise RateLimitExceeded(message)


# --- Named limits (per product spec) ---

LOGIN_FAIL_WINDOW = 15 * 60
LOGIN_FAIL_MAX = 8
LOGIN_FAIL_MESSAGE = "Too many failed login attempts. Try again in 15 minutes."

REGISTER_WINDOW = 3600
REGISTER_MAX = 5
REGISTER_MESSAGE = "Too many registration attempts from this network. Try again later."

FORGOT_PASSWORD_WINDOW = 3600
FORGOT_PASSWORD_MAX = 3
FORGOT_PASSWORD_MESSAGE = "Too many reset attempts. Try again later."

RESET_PASSWORD_WINDOW = 3600
RESET_PASSWORD_MAX = 5
RESET_PASSWORD_MESSAGE = "Too many password reset attempts. Try again later."

TRACK_WINDOW = 60
TRACK_MAX = 15
TRACK_MESSAGE = "Too many tracking lookups. Please wait a moment and try again."

RATES_ESTIMATE_WINDOW = 60
RATES_ESTIMATE_MAX = 20
RATES_ESTIMATE_MESSAGE = "Too many rate estimates. Please wait a moment and try again."

UPLOAD_PRESIGN_WINDOW = 3600
UPLOAD_PRESIGN_MAX = 20
UPLOAD_PRESIGN_MESSAGE = "Upload limit reached. Try again later."

CLERK_INVITE_WINDOW = 3600
CLERK_INVITE_MAX = 3
CLERK_INVITE_MESSAGE = "Too many invite emails sent. Try again later."


def login_keys(email: str) -> list[str]:
    ip = get_client_ip()
    return [f"login_fail:ip:{ip}", f"login_fail:email:{email}"]


def assert_login_allowed(email: str) -> None:
    assert_not_rate_limited(
        login_keys(email),
        max_attempts=LOGIN_FAIL_MAX,
        message=LOGIN_FAIL_MESSAGE,
    )


def record_login_failure(email: str) -> None:
    record_failure(
        login_keys(email),
        max_attempts=LOGIN_FAIL_MAX,
        window_seconds=LOGIN_FAIL_WINDOW,
        message=LOGIN_FAIL_MESSAGE,
    )


def assert_register_allowed() -> None:
    assert_rate_limit(
        f"register:ip:{get_client_ip()}",
        max_attempts=REGISTER_MAX,
        window_seconds=REGISTER_WINDOW,
        message=REGISTER_MESSAGE,
    )


def assert_forgot_password_allowed(email: str) -> None:
    ip = get_client_ip()
    assert_rate_limits(
        [f"forgot_password:email:{email}", f"forgot_password:ip:{ip}"],
        max_attempts=FORGOT_PASSWORD_MAX,
        window_seconds=FORGOT_PASSWORD_WINDOW,
        message=FORGOT_PASSWORD_MESSAGE,
    )


def assert_reset_password_allowed() -> None:
    assert_rate_limit(
        f"reset_password:ip:{get_client_ip()}",
        max_attempts=RESET_PASSWORD_MAX,
        window_seconds=RESET_PASSWORD_WINDOW,
        message=RESET_PASSWORD_MESSAGE,
    )


def assert_track_lookup_allowed() -> None:
    assert_rate_limit(
        f"track:ip:{get_client_ip()}",
        max_attempts=TRACK_MAX,
        window_seconds=TRACK_WINDOW,
        message=TRACK_MESSAGE,
    )


def assert_rates_estimate_allowed() -> None:
    assert_rate_limit(
        f"rates_estimate:ip:{get_client_ip()}",
        max_attempts=RATES_ESTIMATE_MAX,
        window_seconds=RATES_ESTIMATE_WINDOW,
        message=RATES_ESTIMATE_MESSAGE,
    )


def assert_upload_presign_allowed(user_id: str) -> None:
    assert_rate_limit(
        f"upload_presign:user:{user_id}",
        max_attempts=UPLOAD_PRESIGN_MAX,
        window_seconds=UPLOAD_PRESIGN_WINDOW,
        message=UPLOAD_PRESIGN_MESSAGE,
    )


def assert_clerk_invite_resend_allowed(admin_user_id: str) -> None:
    assert_rate_limit(
        f"clerk_invite_resend:admin:{admin_user_id}",
        max_attempts=CLERK_INVITE_MAX,
        window_seconds=CLERK_INVITE_WINDOW,
        message=CLERK_INVITE_MESSAGE,
    )

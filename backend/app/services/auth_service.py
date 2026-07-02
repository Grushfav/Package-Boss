import re

from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)


def normalize_phone(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        raise ValueError("Contact number is required")
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 7 or len(digits) > 15:
        raise ValueError("Contact number must be 7–15 digits (include country code)")
    return f"+{digits}"


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

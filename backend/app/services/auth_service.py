import re

from werkzeug.security import check_password_hash, generate_password_hash

PHONE_PATTERN = re.compile(r"^\+?1?876\d{7}$|^\d{10}$")


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if digits.startswith("1876") and len(digits) == 11:
        return f"+{digits}"
    if digits.startswith("876") and len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    raise ValueError("Contact number must be a valid Jamaica number (876)")


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

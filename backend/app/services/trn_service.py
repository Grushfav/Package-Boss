import hashlib
import hmac
import os
import re

from cryptography.fernet import Fernet, InvalidToken
from flask import current_app

TRN_PATTERN = re.compile(r"^\d{9}$")


def normalize_trn(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if not TRN_PATTERN.match(digits):
        raise ValueError("TRN must be 9 digits")
    return digits


def _get_fernet() -> Fernet:
    key = current_app.config.get("TRN_ENCRYPTION_KEY") or os.environ.get("TRN_ENCRYPTION_KEY", "")
    if not key:
        key = Fernet.generate_key().decode()
        current_app.logger.warning(
            "TRN_ENCRYPTION_KEY not set; using ephemeral key (dev only)"
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def hash_trn(trn: str) -> str:
    pepper = current_app.config.get("TRN_PEPPER") or os.environ.get("TRN_PEPPER", "dev-pepper")
    normalized = normalize_trn(trn)
    return hmac.new(
        pepper.encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def encrypt_trn(trn: str) -> str:
    normalized = normalize_trn(trn)
    return _get_fernet().encrypt(normalized.encode("utf-8")).decode("utf-8")


def decrypt_trn(encrypted: str) -> str:
    try:
        return _get_fernet().decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Invalid encrypted TRN data") from exc


def format_trn(trn: str) -> str:
    n = normalize_trn(trn)
    return f"{n[:3]}-{n[3:6]}-{n[6:]}"


def get_trn_masked(user) -> str:
    trn = decrypt_trn(user.trn_encrypted)
    return f"***-***-{trn[-3:]}"

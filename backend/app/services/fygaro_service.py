"""Fygaro payment link (JWT) and webhook signature helpers."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from flask import current_app


class FygaroConfigError(ValueError):
    pass


def _fygaro_jwt_kid(api_key: str) -> str:
    """Fygaro checkout JWT header kid is the UUID, not the full api- prefixed key."""
    key = api_key.strip()
    if key.lower().startswith("api-"):
        return key[4:]
    return key


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_fygaro_jwt(
    *,
    amount: str,
    currency: str,
    custom_reference: str,
    api_key: str,
    secret_key: str,
    include_expiry: bool = False,
    expires_in_seconds: int = 3600,
) -> str:
    """Sign a Fygaro checkout JWT exactly per their API docs."""
    header = {"alg": "HS256", "typ": "JWT", "kid": _fygaro_jwt_kid(api_key)}
    payload: dict[str, str] = {
        "amount": f"{float(amount):.2f}",
        "currency": currency.upper(),
        "custom_reference": custom_reference,
    }
    if include_expiry:
        now = int(time.time())
        payload["exp"] = str(now + expires_in_seconds)
        payload["nbf"] = str(now)

    header_segment = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_segment = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_segment}.{payload_segment}"
    signature = hmac.new(
        secret_key.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{_b64url(signature)}"


def build_prefill_url(
    *,
    button_url: str,
    amount: str,
    client_reference: str | None = None,
    client_note: str | None = None,
) -> str:
    """Option 1: pre-fill query params (customer can still edit amount)."""
    from urllib.parse import quote, urlencode

    base = button_url.strip()
    params: dict[str, str] = {"amount": f"{float(amount):.2f}"}
    if client_reference:
        params["client_reference"] = client_reference
    if client_note:
        params["client_note"] = client_note
    separator = "&" if "?" in base else "?"
    return f"{base}{separator}{urlencode(params, quote_via=quote)}"


def _fygaro_config() -> tuple[str, str, str]:
    api_key = (current_app.config.get("FYGARO_API_KEY") or "").strip()
    secret_key = (current_app.config.get("FYGARO_SECRET_KEY") or "").strip()
    button_url = (current_app.config.get("FYGARO_PAYMENT_BUTTON_URL") or "").strip()
    if not api_key or not secret_key:
        raise FygaroConfigError(
            "Fygaro is not configured (FYGARO_API_KEY / FYGARO_SECRET_KEY)"
        )
    if not button_url:
        raise FygaroConfigError("Fygaro payment button URL is not configured (FYGARO_PAYMENT_BUTTON_URL)")
    return api_key, secret_key, button_url


def create_payment_jwt(
    *,
    amount: str,
    currency: str,
    custom_reference: str,
    api_key: str | None = None,
    secret_key: str | None = None,
    include_expiry: bool = False,
    expires_in_seconds: int = 3600,
) -> str:
    """Build a signed Fygaro checkout JWT (amount/currency cannot be changed by customer)."""
    resolved_api_key = (api_key or current_app.config.get("FYGARO_API_KEY") or "").strip()
    resolved_secret = (secret_key or current_app.config.get("FYGARO_SECRET_KEY") or "").strip()
    if not resolved_api_key or not resolved_secret:
        raise FygaroConfigError(
            "Fygaro is not configured (FYGARO_API_KEY / FYGARO_SECRET_KEY)"
        )

    return sign_fygaro_jwt(
        amount=amount,
        currency=currency,
        custom_reference=custom_reference,
        api_key=resolved_api_key,
        secret_key=resolved_secret,
        include_expiry=include_expiry,
        expires_in_seconds=expires_in_seconds,
    )


def build_payment_url(
    *,
    amount: str,
    currency: str,
    custom_reference: str,
    button_url: str | None = None,
) -> str:
    """Return a hosted Fygaro checkout URL with a signed JWT (Option 2)."""
    _, _, configured_button_url = _fygaro_config()
    base_url = (button_url or configured_button_url).strip()
    token = create_payment_jwt(
        amount=amount,
        currency=currency,
        custom_reference=custom_reference,
    )
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}jwt={token}"


def verify_webhook_signature(
    *,
    raw_body: bytes,
    signature_header: str,
    key_id: str,
    secret_key: str | None = None,
    max_age_seconds: int = 300,
) -> bool:
    """Validate Fygaro-Signature header on webhook POST bodies."""
    resolved_secret = (secret_key or current_app.config.get("FYGARO_SECRET_KEY") or "").strip()
    configured_api_key = (current_app.config.get("FYGARO_API_KEY") or "").strip()
    if not resolved_secret:
        raise FygaroConfigError("Fygaro secret key is not configured (FYGARO_SECRET_KEY)")
    if key_id and configured_api_key:
        expected_ids = {_fygaro_jwt_kid(configured_api_key), configured_api_key.strip()}
        if key_id not in expected_ids:
            return False

    timestamp: str | None = None
    hashes: list[str] = []
    for part in signature_header.split(","):
        key, _, value = part.strip().partition("=")
        if key == "t":
            timestamp = value
        elif key == "v1" and value:
            hashes.append(value)

    if not timestamp or not hashes:
        return False

    if max_age_seconds > 0 and abs(int(time.time()) - int(timestamp)) > max_age_seconds:
        return False

    message = f"{timestamp}.{raw_body.decode('utf-8')}"
    expected = hmac.new(
        resolved_secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return any(hmac.compare_digest(expected, candidate) for candidate in hashes)


def parse_webhook_payload(raw_body: bytes) -> dict[str, Any]:
    return json.loads(raw_body.decode("utf-8"))

from __future__ import annotations

import re

import requests
from flask import current_app


class WhatsAppServiceError(Exception):
    def __init__(self, message: str, status_code: int | None = None, response: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response or {}


def send_invoice_request_whatsapp(
    to_phone: str,
    first_name: str,
    package_tracking: str,
    upload_url: str,
    note: str | None = None,
) -> None:
    """Request customer invoice upload via WhatsApp."""
    note_line = f" Note: {note}" if note else ""
    body = (
        f"Hi {first_name}, Package Boss needs an invoice for {package_tracking} "
        f"to complete customs and your final bill.{note_line} "
        f"Upload here: {upload_url}"
    )
    _dispatch_whatsapp(to_phone, body)


def send_whatsapp_text(to_phone: str, body: str) -> dict:
    """Send a plain-text WhatsApp message. Returns the provider response."""
    return _dispatch_whatsapp(to_phone, body)


def _normalize_whatsapp_recipient(phone: str) -> str:
    raw = (phone or "").strip()
    if not raw:
        raise WhatsAppServiceError("Recipient phone number is required")
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 7 or len(digits) > 15:
        raise WhatsAppServiceError("Recipient phone must be 7-15 digits including country code")
    return digits


def _meta_config() -> tuple[str, str, str]:
    api_version = (current_app.config.get("WHATSAPP_API_VERSION") or "v21.0").strip()
    phone_number_id = (current_app.config.get("WHATSAPP_PHONE_NUMBER_ID") or "").strip()
    access_token = (current_app.config.get("WHATSAPP_ACCESS_TOKEN") or "").strip()
    if not phone_number_id or not access_token:
        raise WhatsAppServiceError(
            "WhatsApp Cloud API is not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)"
        )
    return api_version, phone_number_id, access_token


def _send_meta_text_message(to_phone: str, body: str) -> dict:
    api_version, phone_number_id, access_token = _meta_config()
    recipient = _normalize_whatsapp_recipient(to_phone)
    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "text",
        "text": {"preview_url": True, "body": body},
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as exc:
        raise WhatsAppServiceError(f"WhatsApp request failed: {exc}") from exc

    try:
        data = response.json()
    except ValueError:
        data = {"error": response.text}

    if not response.ok:
        error = data.get("error", {})
        message = error.get("message") if isinstance(error, dict) else None
        raise WhatsAppServiceError(
            message or "WhatsApp send failed",
            status_code=response.status_code,
            response=data if isinstance(data, dict) else {"error": data},
        )

    return data


def _dispatch_whatsapp(to_phone: str, body: str) -> dict:
    provider = current_app.config.get("WHATSAPP_PROVIDER", "console")

    if provider == "console":
        current_app.logger.info("WHATSAPP\nTo: %s\n\n%s", to_phone, body)
        print(f"\n--- WHATSAPP ---\nTo: {to_phone}\n\n{body}\n")
        return {"provider": "console", "to": to_phone}

    if provider in ("meta", "cloud_api"):
        return _send_meta_text_message(to_phone, body)

    raise WhatsAppServiceError(f"WhatsApp provider '{provider}' is not configured")

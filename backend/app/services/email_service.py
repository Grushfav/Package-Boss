from __future__ import annotations

from pathlib import Path
from threading import Thread

import requests
from flask import current_app

from app.services.email_templates import (
    render_invoice_request_html,
    render_package_status_html,
    render_password_reset_html,
    render_welcome_html,
)

APP_ID = "package-boss"
_LOGO_ASSET_PATH = Path(__file__).resolve().parent.parent / "assets" / "email-logo.png"
_cached_logo_url: str | None = None


class EmailServiceError(Exception):
    def __init__(self, message: str, status_code: int | None = None, response: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response or {}


def _email_headers(api_key: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }


def _worker_config() -> tuple[str, str, str]:
    api_url = (current_app.config.get("EMAIL_API_URL") or "").rstrip("/")
    api_key = current_app.config.get("EMAIL_API_KEY") or ""
    from_address = current_app.config.get("DEFAULT_FROM_EMAIL") or "info@packagebossja.com"
    if not api_url or not api_key:
        raise EmailServiceError("Email worker is not configured (EMAIL_API_URL / EMAIL_API_KEY)")
    return api_url, api_key, from_address


def _image_upload_configured() -> bool:
    from app.services.image_upload_service import is_image_upload_configured

    return is_image_upload_configured()


def resolve_logo_url() -> str | None:
    """Return a public logo URL for HTML emails (config, cache, or one-time B2 upload)."""
    global _cached_logo_url

    configured = (current_app.config.get("EMAIL_LOGO_URL") or "").strip()
    if configured:
        return configured

    if _cached_logo_url:
        return _cached_logo_url

    if current_app.config.get("EMAIL_PROVIDER") == "worker" and _image_upload_configured():
        if _LOGO_ASSET_PATH.is_file():
            try:
                from app.services.image_upload_service import upload_bytes

                logo_bytes = _LOGO_ASSET_PATH.read_bytes()
                _cached_logo_url = upload_bytes(logo_bytes, "image/png", prefix="packages")
                return _cached_logo_url
            except Exception as exc:
                current_app.logger.warning("Could not upload email logo: %s", exc)

    frontend = (current_app.config.get("FRONTEND_URL") or "").rstrip("/")
    if frontend:
        return f"{frontend}/email-logo.png"

    return None


def send_email(
    *,
    to: str | list[str],
    subject: str,
    text: str | None = None,
    html_body: str | None = None,
    from_address: str | None = None,
    reply_to: str | None = None,
    cc: str | list[str] | None = None,
    bcc: str | list[str] | None = None,
    assets: list[dict] | None = None,
    metadata: dict | None = None,
) -> dict:
    if not text and not html_body:
        raise ValueError("Either text or html is required")

    api_url, api_key, default_from = _worker_config()

    payload = {
        "to": to,
        "subject": subject,
        "text": text,
        "html": html_body,
        "from": from_address or default_from,
        "replyTo": reply_to,
        "cc": cc,
        "bcc": bcc,
        "assets": assets,
        "metadata": {"appId": APP_ID, **(metadata or {})},
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    try:
        response = requests.post(
            f"{api_url}/v1/email",
            json=payload,
            headers=_email_headers(api_key),
            timeout=30,
        )
    except requests.RequestException as exc:
        raise EmailServiceError(f"Email request failed: {exc}") from exc

    try:
        data = response.json()
    except ValueError:
        data = {"error": response.text}

    if not response.ok:
        raise EmailServiceError(
            data.get("error", "Email send failed"),
            status_code=response.status_code,
            response=data,
        )

    return data


def upload_image(file_bytes: bytes, content_type: str) -> str:
    """Upload bytes via the image Worker (used by send_email_with_images)."""
    from app.services.image_upload_service import ImageUploadError, upload_bytes

    try:
        return upload_bytes(file_bytes, content_type, prefix="packages")
    except ImageUploadError as exc:
        raise EmailServiceError(str(exc)) from exc


def send_email_with_images(
    *,
    to: str | list[str],
    subject: str,
    html_body: str,
    image_files: list[tuple[str, bytes, str]],
    text: str | None = None,
    metadata: dict | None = None,
    **kwargs,
) -> dict:
    assets = []
    for filename, file_bytes, content_type in image_files:
        public_url = upload_image(file_bytes, content_type)
        assets.append(
            {
                "url": public_url,
                "filename": filename,
                "contentType": content_type,
            }
        )

    return send_email(
        to=to,
        subject=subject,
        html_body=html_body,
        text=text,
        assets=assets,
        metadata=metadata,
        **kwargs,
    )


def send_email_async(**kwargs) -> None:
    app = current_app._get_current_object()

    def _run():
        with app.app_context():
            try:
                result = send_email(**kwargs)
                app.logger.info(
                    "Email sent to %s (requestId=%s)",
                    kwargs.get("to"),
                    result.get("requestId"),
                )
            except EmailServiceError as exc:
                app.logger.error("Async email failed for %s: %s", kwargs.get("to"), exc)

    thread = Thread(target=_run, daemon=False)
    thread.start()


def _dispatch_email(
    to_email: str,
    subject: str,
    body: str,
    *,
    html_body: str | None = None,
    metadata: dict | None = None,
    async_send: bool = False,
) -> dict | None:
    provider = current_app.config.get("EMAIL_PROVIDER", "console")

    if provider == "console":
        current_app.logger.info(
            "EMAIL\nTo: %s\nSubject: %s\n\n%s",
            to_email,
            subject,
            body,
        )
        if html_body:
            current_app.logger.debug("HTML body length: %d chars", len(html_body))
        print(f"\n--- EMAIL ---\nTo: {to_email}\nSubject: {subject}\n\n{body}\n")
        return None

    if provider == "worker":
        send_kwargs = {
            "to": to_email,
            "subject": subject,
            "text": body,
            "html_body": html_body,
            "metadata": metadata,
        }
        if async_send:
            send_email_async(**send_kwargs)
            return None
        result = send_email(**send_kwargs)
        current_app.logger.info(
            "Email sent to %s (requestId=%s)",
            to_email,
            result.get("requestId"),
        )
        return result

    raise NotImplementedError(f"Email provider '{provider}' is not configured")


def send_welcome_email(
    to_email: str,
    first_name: str,
    shipping_id: str,
    shipping_address: dict,
) -> None:
    frontend = (current_app.config.get("FRONTEND_URL") or "http://localhost:5173").rstrip("/")
    dashboard_url = f"{frontend}/dashboard"
    formatted_address = shipping_address.get("formatted") or ""
    subject = f"Welcome to Package Boss — {shipping_id}"
    body = (
        f"Hi {first_name},\n\n"
        f"Welcome to Package Boss! Your shipping ID is {shipping_id}.\n\n"
        f"Fort Lauderdale warehouse address:\n{formatted_address}\n\n"
        f"Dashboard: {dashboard_url}\n\n"
        f"— Package Boss"
    )
    html_body = render_welcome_html(
        first_name,
        shipping_id,
        formatted_address,
        dashboard_url,
        logo_url=resolve_logo_url(),
    )
    _dispatch_email(
        to_email,
        subject,
        body,
        html_body=html_body,
        metadata={"type": "welcome", "shippingId": shipping_id},
        async_send=True,
    )


def send_package_status_email(
    to_email: str,
    first_name: str,
    tracking_number: str,
    status: str,
    *,
    status_label: str | None = None,
    note: str | None = None,
    carrier_tracking: str | None = None,
    shipper_label: str | None = None,
) -> None:
    from app.constants import STATUS_LABELS

    label = status_label or STATUS_LABELS.get(status, status.replace("_", " ").title())
    frontend = (current_app.config.get("FRONTEND_URL") or "http://localhost:5173").rstrip("/")
    track_url = f"{frontend}/track?tracking={tracking_number}"
    subject = f"Package update — {tracking_number}: {label}"

    shipment_lines = [f"Package Boss tracking: {tracking_number}"]
    if carrier_tracking and carrier_tracking.strip():
        shipment_lines.append(f"Carrier tracking: {carrier_tracking.strip()}")
    if shipper_label and shipper_label.strip():
        shipment_lines.append(f"Shipper: {shipper_label.strip()}")
    shipment_block = "\n".join(shipment_lines)

    body = (
        f"Hi {first_name},\n\n"
        f"Your package status is now: {label}.\n\n"
        f"{shipment_block}\n\n"
        f"Track your package: {track_url}\n\n"
        f"— Package Boss"
    )
    if note:
        body = (
            f"Hi {first_name},\n\n"
            f"Your package status is now: {label}.\n\n"
            f"{note}\n\n"
            f"{shipment_block}\n\n"
            f"Track your package: {track_url}\n\n"
            f"— Package Boss"
        )
    html_body = render_package_status_html(
        first_name,
        tracking_number,
        status,
        label,
        track_url,
        note=note,
        logo_url=resolve_logo_url(),
        carrier_tracking=carrier_tracking,
        shipper_label=shipper_label,
    )
    _dispatch_email(
        to_email,
        subject,
        body,
        html_body=html_body,
        metadata={
            "type": "package_status",
            "trackingNumber": tracking_number,
            "status": status,
        },
        async_send=True,
    )


def send_password_reset_email(to_email: str, first_name: str, reset_url: str) -> None:
    subject = "Reset your Package Boss password"
    body = (
        f"Hi {first_name},\n\n"
        f"We received a request to reset your password.\n"
        f"Click the link below (expires in 15 minutes):\n\n"
        f"{reset_url}\n\n"
        f"If you didn't request this, ignore this email.\n\n"
        f"— Package Boss"
    )
    html_body = render_password_reset_html(first_name, reset_url, logo_url=resolve_logo_url())
    _dispatch_email(
        to_email,
        subject,
        body,
        html_body=html_body,
        metadata={"type": "password_reset"},
        async_send=True,
    )


def send_clerk_invite_email(to_email: str, first_name: str, invite_url: str) -> None:
    subject = "You're invited to Package Boss warehouse"
    body = (
        f"Hi {first_name},\n\n"
        f"An admin created a clerk account for you on Package Boss.\n"
        f"Set your password using the link below (expires in 24 hours):\n\n"
        f"{invite_url}\n\n"
        f"If you weren't expecting this, ignore this email.\n\n"
        f"— Package Boss"
    )
    html_body = render_password_reset_html(
        first_name,
        invite_url,
        logo_url=resolve_logo_url(),
        heading="Set your clerk password",
        intro="An admin created a warehouse clerk account for you. Choose a password to get started.",
        expiry_note="24 hours",
    )
    _dispatch_email(
        to_email,
        subject,
        body,
        html_body=html_body,
        metadata={"type": "clerk_invite"},
        async_send=True,
    )


def send_invoice_request_email(
    to_email: str,
    first_name: str,
    package_tracking: str,
    upload_url: str,
    note: str | None = None,
) -> dict | None:
    subject = f"Package Boss — upload receipt for {package_tracking}"
    note_line = f"\n\nNote from our team:\n{note}\n" if note else ""
    body = (
        f"Hi {first_name},\n\n"
        f"We need an invoice or receipt for package {package_tracking} "
        f"to complete customs clearance and prepare your final bill.\n"
        f"{note_line}\n"
        f"Upload your invoice here:\n{upload_url}\n\n"
        f"Items over $100 USD may incur duties and additional charges.\n\n"
        f"— Package Boss"
    )
    html_body = render_invoice_request_html(
        first_name,
        package_tracking,
        upload_url,
        note=note,
        logo_url=resolve_logo_url(),
    )
    return _dispatch_email(
        to_email,
        subject,
        body,
        html_body=html_body,
        metadata={"type": "invoice_request", "trackingNumber": package_tracking},
        async_send=True,
    )


def send_announcement_email(
    to_email: str,
    first_name: str,
    title: str,
    body_text: str,
) -> None:
    frontend = (current_app.config.get("FRONTEND_URL") or "http://localhost:5173").rstrip("/")
    dashboard_url = f"{frontend}/dashboard/notifications"
    subject = f"Package Boss update — {title}"
    body = (
        f"Hi {first_name},\n\n"
        f"{body_text}\n\n"
        f"View in your dashboard: {dashboard_url}\n\n"
        f"— Package Boss"
    )
    _dispatch_email(
        to_email,
        subject,
        body,
        metadata={"type": "announcement", "title": title},
        async_send=False,
    )

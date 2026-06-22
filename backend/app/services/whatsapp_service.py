from flask import current_app


def send_invoice_request_whatsapp(
    to_phone: str,
    first_name: str,
    package_tracking: str,
    upload_url: str,
    note: str | None = None,
) -> None:
    """Request customer invoice upload via WhatsApp. Placeholder until provider is wired."""
    note_line = f" Note: {note}" if note else ""
    body = (
        f"Hi {first_name}, Package Boss needs an invoice for {package_tracking} "
        f"to complete customs and your final bill.{note_line} "
        f"Upload here: {upload_url}"
    )
    _dispatch_whatsapp(to_phone, body)


def _dispatch_whatsapp(to_phone: str, body: str) -> None:
    provider = current_app.config.get("WHATSAPP_PROVIDER", "console")

    if provider == "console":
        current_app.logger.info("WHATSAPP\nTo: %s\n\n%s", to_phone, body)
        print(f"\n--- WHATSAPP ---\nTo: {to_phone}\n\n{body}\n")
        return

    raise NotImplementedError(f"WhatsApp provider '{provider}' is not configured")

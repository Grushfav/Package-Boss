from flask import current_app


def send_password_reset_email(to_email: str, first_name: str, reset_url: str) -> None:
    """Send password reset email. Logs in development when no provider is configured."""
    subject = "Reset your Package Boss password"
    body = (
        f"Hi {first_name},\n\n"
        f"We received a request to reset your password.\n"
        f"Click the link below (expires in 15 minutes):\n\n"
        f"{reset_url}\n\n"
        f"If you didn't request this, ignore this email.\n\n"
        f"— Package Boss"
    )
    _dispatch_email(to_email, subject, body)


def send_invoice_request_email(
    to_email: str,
    first_name: str,
    package_tracking: str,
    upload_url: str,
    note: str | None = None,
) -> None:
    """Request customer invoice upload. Placeholder until email provider is wired."""
    subject = f"Invoice needed — Package {package_tracking}"
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
    _dispatch_email(to_email, subject, body)


def _dispatch_email(to_email: str, subject: str, body: str) -> None:
    provider = current_app.config.get("EMAIL_PROVIDER", "console")

    if provider == "console":
        current_app.logger.info(
            "EMAIL\nTo: %s\nSubject: %s\n\n%s",
            to_email,
            subject,
            body,
        )
        print(f"\n--- EMAIL ---\nTo: {to_email}\nSubject: {subject}\n\n{body}\n")
        return

    raise NotImplementedError(f"Email provider '{provider}' is not configured")

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

    provider = current_app.config.get("EMAIL_PROVIDER", "console")

    if provider == "console":
        current_app.logger.info(
            "PASSWORD RESET EMAIL\nTo: %s\nSubject: %s\n\n%s",
            to_email,
            subject,
            body,
        )
        print(f"\n--- PASSWORD RESET EMAIL ---\nTo: {to_email}\n{body}\n")
        return

    raise NotImplementedError(f"Email provider '{provider}' is not configured")

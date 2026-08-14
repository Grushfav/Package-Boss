"""One-off: send a package status test email to preview the logo."""

from app import create_app
from app.services.email_service import _dispatch_email, resolve_logo_url
from app.services.email_templates import render_package_status_html

TO_EMAIL = "grushfav@gmail.com"


def main() -> None:
    app = create_app()
    with app.app_context():
        provider = app.config.get("EMAIL_PROVIDER")
        print(f"EMAIL_PROVIDER: {provider}")

        logo_url = resolve_logo_url()
        print(f"Logo URL: {logo_url or '(none)'}")

        html = render_package_status_html(
            "Grush",
            "PB-2026-000001",
            "received",
            "Received",
            "https://www.packagebossja.com/track?tracking=PB-2026-000001",
            logo_url=logo_url,
            carrier_tracking="TEST123456",
            shipper_label="Amazon",
        )

        result = _dispatch_email(
            TO_EMAIL,
            "Package Boss logo test — PB-2026-000001: Received",
            "Hi Grush,\n\nThis is a test email to preview the updated logo.\n\n— Package Boss",
            html_body=html,
            metadata={
                "type": "package_status",
                "trackingNumber": "PB-2026-000001",
                "status": "received",
            },
            async_send=False,
        )
        print(f"Send result: {result}")


if __name__ == "__main__":
    main()

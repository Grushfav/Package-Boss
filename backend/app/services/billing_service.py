from datetime import datetime
from decimal import Decimal

from app.constants import INVOICE_REQUEST_CHANNELS
from app.extensions import db
from app.models.package import Package
from app.models.user import User
from app.services.billing_calculations import compute_total_due
from app.services.delivery_address_service import build_invoice_upload_url, get_delivery_address
from app.services.email_service import EmailServiceError, send_invoice_request_email
from app.services.image_upload_service import is_valid_invoice_reference
from app.services.package_service import add_package_event
from app.services.whatsapp_service import WhatsAppServiceError, send_invoice_request_whatsapp


def _decimal(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value)).quantize(Decimal("0.01"))


def update_package_billing(
    package: Package,
    *,
    estimated_freight_jmd: float | None = None,
    duties_jmd: float | None = None,
    handling_jmd: float | None = None,
    other_fees_jmd: float | None = None,
    declared_value_usd: float | None = None,
    billing_status: str | None = None,
    publish: bool = False,
) -> Package:
    from app.constants import BILLING_STATUSES

    if estimated_freight_jmd is not None:
        package.estimated_freight_jmd = _decimal(estimated_freight_jmd)
    if duties_jmd is not None:
        package.duties_jmd = _decimal(duties_jmd)
    if handling_jmd is not None:
        package.handling_jmd = _decimal(handling_jmd)
    if other_fees_jmd is not None:
        package.other_fees_jmd = _decimal(other_fees_jmd)
    if declared_value_usd is not None:
        package.declared_value_usd = _decimal(declared_value_usd)

    package.total_due_jmd = compute_total_due(
        package.estimated_freight_jmd,
        package.duties_jmd,
        package.handling_jmd,
        package.other_fees_jmd,
    )

    if publish:
        if package.status != "ready_for_pickup":
            raise ValueError(
                "Bills publish when a package is marked ready for pickup. "
                "For packages in customs, use Release & bill."
            )
        if package.total_due_jmd is None:
            raise ValueError("Set at least freight or fee amounts before publishing a bill")
        package.billing_status = "ready"
    elif billing_status:
        if billing_status not in BILLING_STATUSES:
            raise ValueError("Invalid billing status")
        package.billing_status = billing_status

    package.updated_at = datetime.utcnow()
    db.session.commit()
    return package


def request_package_invoice(
    package: Package,
    channel: str,
    note: str | None = None,
) -> dict:
    from flask import current_app

    if channel not in INVOICE_REQUEST_CHANNELS:
        raise ValueError("channel must be email, whatsapp, or both")

    if package.status == "unidentified":
        raise ValueError("Assign package to a customer before requesting an invoice")

    customer: User = package.customer
    upload_url = build_invoice_upload_url(str(package.id))

    channels_sent: list[str] = []
    email_result: dict | None = None

    if channel in ("email", "both"):
        try:
            email_result = send_invoice_request_email(
                customer.email,
                customer.first_name,
                package.tracking_number,
                upload_url,
                note,
            )
            channels_sent.append("email")
        except (EmailServiceError, NotImplementedError) as exc:
            raise ValueError(f"Failed to send invoice email: {exc}") from exc

    if channel in ("whatsapp", "both"):
        if customer.whatsapp_opt_in:
            try:
                send_invoice_request_whatsapp(
                    customer.contact_number,
                    customer.first_name,
                    package.tracking_number,
                    upload_url,
                    note,
                )
                channels_sent.append("whatsapp")
            except (NotImplementedError, WhatsAppServiceError) as exc:
                if channel == "whatsapp":
                    raise ValueError(f"Failed to send WhatsApp message: {exc}") from exc
                current_app.logger.warning(
                    "WhatsApp invoice request skipped for %s: %s",
                    package.tracking_number,
                    exc,
                )
        elif channel == "whatsapp":
            raise ValueError("Customer has not opted in to WhatsApp notifications")

    package.invoice_status = "requested"
    package.invoice_requested_at = datetime.utcnow()
    package.invoice_requested_via = channel
    package.invoice_request_note = (note or "").strip() or None
    package.updated_at = datetime.utcnow()

    add_package_event(
        package,
        package.status,
        f"Invoice requested via {channel}"
        + (f" — {note}" if note else ""),
    )
    db.session.commit()

    return {
        "channels_sent": channels_sent,
        "invoice_status": package.invoice_status,
        "email_recipient": customer.email if "email" in channels_sent else None,
        "email_request_id": email_result.get("requestId") if email_result else None,
    }


def attach_package_invoice(
    package: Package,
    invoice_object_key: str,
    declared_value_usd: float | None = None,
) -> Package:
    customer = package.customer
    if not is_valid_invoice_reference(invoice_object_key, customer.shipping_id):
        raise ValueError("Invalid invoice object key")

    package.invoice_object_key = invoice_object_key
    package.invoice_status = "received"
    package.invoice_received_at = datetime.utcnow()
    if declared_value_usd is not None:
        package.declared_value_usd = _decimal(declared_value_usd)

    add_package_event(package, package.status, "Customer uploaded invoice")
    db.session.commit()
    return package


def assign_delivery_address(package: Package, address_id, customer: User) -> Package:
    address = get_delivery_address(customer, address_id)
    if not address:
        raise ValueError("Delivery address not found")

    package.delivery_address_id = address.id
    package.updated_at = datetime.utcnow()
    db.session.commit()
    return package

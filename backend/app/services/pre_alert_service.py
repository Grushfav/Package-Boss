from datetime import datetime

from app.extensions import db
from app.models.pre_alert import PreAlert
from app.models.user import User
from app.services.r2_service import is_r2_configured


def normalize_carrier_tracking(value: str) -> str:
    return value.strip().upper()


def create_pre_alert(
    customer: User,
    carrier_tracking: str,
    invoice_object_key: str | None = None,
    merchant: str | None = None,
    description: str | None = None,
    declared_value_usd: float | None = None,
) -> PreAlert:
    tracking = normalize_carrier_tracking(carrier_tracking)
    if not tracking:
        raise ValueError("carrier_tracking is required")

    if is_r2_configured() and not invoice_object_key:
        raise ValueError("invoice upload is required")

    if invoice_object_key and not invoice_object_key.startswith(f"invoices/{customer.shipping_id}/"):
        raise ValueError("Invalid invoice object key")

    existing = PreAlert.query.filter_by(
        customer_id=customer.id,
        carrier_tracking=tracking,
        status="pending",
    ).first()
    if existing:
        raise ValueError("A pending pre-alert already exists for this tracking number")

    pre_alert = PreAlert(
        customer_id=customer.id,
        carrier_tracking=tracking,
        merchant=(merchant or "").strip() or None,
        description=(description or "").strip() or None,
        declared_value_usd=declared_value_usd,
        invoice_object_key=invoice_object_key,
        status="pending",
    )
    db.session.add(pre_alert)
    db.session.commit()
    return pre_alert


def cancel_pre_alert(pre_alert: PreAlert) -> PreAlert:
    if pre_alert.status != "pending":
        raise ValueError("Only pending pre-alerts can be cancelled")
    pre_alert.status = "cancelled"
    pre_alert.updated_at = datetime.utcnow()
    db.session.commit()
    return pre_alert

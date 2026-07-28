import re
from datetime import datetime

from app.extensions import db
from app.models.package import Package
from app.models.pre_alert import PreAlert
from app.models.user import User
from app.services.image_upload_service import is_valid_invoice_reference

# Minimum alphanumeric length for partial (substring) matching.
MIN_TRACKING_MATCH_LEN = 8

_TRACKING_ALNUM = re.compile(r"[^A-Z0-9]+")


def normalize_carrier_tracking(value: str) -> str:
    return value.strip().upper()


def tracking_core(value: str | None) -> str:
    """Uppercase alphanumeric-only tracking for fuzzy comparison."""
    if not value:
        return ""
    return _TRACKING_ALNUM.sub("", normalize_carrier_tracking(value))


def tracking_match_score(pre_alert_tracking: str, received_tracking: str) -> int:
    """
    Score how well two tracking values match (higher is better, 0 = no match).
    Supports exact and partial matches when one value contains the other.
    """
    pre_core = tracking_core(pre_alert_tracking)
    recv_core = tracking_core(received_tracking)
    if not pre_core or not recv_core:
        return 0

    if pre_core == recv_core:
        return 10_000 + len(pre_core)

    short, long = (pre_core, recv_core) if len(pre_core) <= len(recv_core) else (recv_core, pre_core)
    if len(short) < MIN_TRACKING_MATCH_LEN:
        return 0
    if short not in long:
        return 0

    return len(short)


def find_matching_pre_alert(customer_id, carrier_tracking: str | None) -> PreAlert | None:
    """Find the best pending pre-alert for this customer and carrier tracking."""
    recv_core = tracking_core(carrier_tracking)
    if len(recv_core) < MIN_TRACKING_MATCH_LEN:
        return None

    candidates = PreAlert.query.filter_by(customer_id=customer_id, status="pending").all()
    best: PreAlert | None = None
    best_score = 0

    for pre_alert in candidates:
        score = tracking_match_score(pre_alert.carrier_tracking, carrier_tracking or "")
        if score > best_score:
            best_score = score
            best = pre_alert
        elif score == best_score and score > 0 and best is not None:
            if pre_alert.created_at > best.created_at:
                best = pre_alert

    return best


def find_pending_pre_alerts_by_tracking(
    carrier_tracking: str | None,
) -> list[tuple[PreAlert, int]]:
    """Find all pending pre-alerts matching carrier tracking (any customer)."""
    recv_core = tracking_core(carrier_tracking)
    if len(recv_core) < MIN_TRACKING_MATCH_LEN:
        return []

    candidates = PreAlert.query.filter_by(status="pending").all()
    scored: list[tuple[PreAlert, int]] = []
    for pre_alert in candidates:
        score = tracking_match_score(pre_alert.carrier_tracking, carrier_tracking or "")
        if score > 0:
            scored.append((pre_alert, score))

    scored.sort(key=lambda item: (-item[1], -item[0].created_at.timestamp()))
    return scored


def _apply_pre_alert_invoice(package: Package, pre_alert: PreAlert) -> None:
    if not pre_alert.invoice_object_key or package.invoice_object_key:
        return

    customer: User = package.customer
    if not is_valid_invoice_reference(pre_alert.invoice_object_key, customer.shipping_id):
        return

    package.invoice_object_key = pre_alert.invoice_object_key
    package.invoice_status = "received"
    package.invoice_received_at = datetime.utcnow()


def apply_pre_alert_to_package(pre_alert: PreAlert, package: Package) -> None:
    """Link a matched pre-alert to a received package (does not commit)."""
    pre_alert.status = "received"
    pre_alert.package_id = package.id
    pre_alert.updated_at = datetime.utcnow()

    if pre_alert.declared_value_usd is not None and package.declared_value_usd is None:
        package.declared_value_usd = pre_alert.declared_value_usd

    _apply_pre_alert_invoice(package, pre_alert)


def match_pre_alert_on_receive(package: Package) -> PreAlert | None:
    """Match a pending pre-alert when a package is received or assigned to a customer."""
    carrier_tracking = (package.carrier_tracking or "").strip()
    if not carrier_tracking:
        return None

    pre_alert = find_matching_pre_alert(package.customer_id, carrier_tracking)
    if not pre_alert:
        return None

    apply_pre_alert_to_package(pre_alert, package)
    return pre_alert


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

    if invoice_object_key and not is_valid_invoice_reference(invoice_object_key, customer.shipping_id):
        raise ValueError("Invalid invoice object key")

    pending = PreAlert.query.filter_by(customer_id=customer.id, status="pending").all()
    for existing in pending:
        if tracking_match_score(existing.carrier_tracking, tracking) >= 10_000:
            raise ValueError("A pending pre-alert already exists for this tracking number")
        recv_core = tracking_core(tracking)
        exist_core = tracking_core(existing.carrier_tracking)
        short, long = (
            (recv_core, exist_core) if len(recv_core) <= len(exist_core) else (exist_core, recv_core)
        )
        if (
            len(short) >= MIN_TRACKING_MATCH_LEN
            and short in long
            and len(short) / len(long) >= 0.85
        ):
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

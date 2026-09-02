from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import selectinload

from app.constants import DELIVERY_FEE_JMD, PAYMENT_ELIGIBLE_STATUS, PAYMENT_METHODS
from app.extensions import db
from app.models.package import Package
from app.models.payment import PaymentCheckout, PaymentCheckoutItem
from app.models.user import User
from app.services.delivery_request_service import resolve_delivery_request_for_payment
from app.services.package_service import add_package_event
from app.utils.datetime_format import utc_isoformat


def _decimal(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def generate_invoice_number() -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"PB-INV-{today}-"
    count = (
        PaymentCheckout.query.filter(PaymentCheckout.invoice_number.like(f"{prefix}%")).count() + 1
    )
    return f"{prefix}{count:04d}"


def get_package_checkout_item(package: Package) -> PaymentCheckoutItem | None:
    return PaymentCheckoutItem.query.filter_by(package_id=package.id).first()


def package_payment_summaries_for_packages(packages: list[Package]) -> dict[str, dict]:
    from app.constants import PAYMENT_METHOD_LABELS

    if not packages:
        return {}
    package_ids = [pkg.id for pkg in packages]
    items = (
        PaymentCheckoutItem.query.filter(PaymentCheckoutItem.package_id.in_(package_ids))
        .options(
            selectinload(PaymentCheckoutItem.checkout).selectinload(PaymentCheckout.recorded_by)
        )
        .all()
    )
    summaries: dict[str, dict] = {}
    for item in items:
        checkout = item.checkout
        if not checkout:
            continue
        summaries[str(item.package_id)] = {
            "checkout_id": str(checkout.id),
            "invoice_number": checkout.invoice_number,
            "amount_jmd": float(item.amount_jmd),
            "method": checkout.method,
            "method_label": PAYMENT_METHOD_LABELS.get(checkout.method, checkout.method),
            "reference": checkout.reference,
            "notes": checkout.notes,
            "recorded_by_name": checkout.recorded_by.full_name if checkout.recorded_by else None,
            "recorded_at": utc_isoformat(checkout.recorded_at),
        }
    return summaries


def package_payment_summary(package: Package) -> dict | None:
    from app.constants import PAYMENT_METHOD_LABELS

    item = get_package_checkout_item(package)
    if not item or not item.checkout:
        return None
    checkout = item.checkout
    return {
        "checkout_id": str(checkout.id),
        "invoice_number": checkout.invoice_number,
        "amount_jmd": float(item.amount_jmd),
        "method": checkout.method,
        "method_label": PAYMENT_METHOD_LABELS.get(checkout.method, checkout.method),
        "reference": checkout.reference,
        "notes": checkout.notes,
        "recorded_by_name": checkout.recorded_by.full_name if checkout.recorded_by else None,
        "recorded_at": utc_isoformat(checkout.recorded_at),
    }


def list_customer_checkouts(customer: User, limit: int = 100) -> list[PaymentCheckout]:
    return (
        PaymentCheckout.query.filter_by(customer_id=customer.id)
        .order_by(PaymentCheckout.recorded_at.desc())
        .limit(limit)
        .all()
    )


def list_customer_packages(customer: User, limit: int = 100) -> list[Package]:
    return (
        Package.query.options(
            selectinload(Package.customer),
            selectinload(Package.shipment),
        )
        .filter_by(customer_id=customer.id)
        .filter(Package.status != "unidentified")
        .order_by(Package.received_at.desc(), Package.tracking_number.desc())
        .limit(limit)
        .all()
    )


def compute_customer_billing_summary(packages: list[Package]) -> dict:
    total_due_jmd = Decimal("0")
    ready_count = 0
    paid_count = 0

    for pkg in packages:
        if (
            pkg.status == PAYMENT_ELIGIBLE_STATUS
            and pkg.billing_status == "ready"
            and pkg.total_due_jmd is not None
        ):
            total_due_jmd += pkg.total_due_jmd
            ready_count += 1
        elif pkg.billing_status == "paid":
            paid_count += 1

    return {
        "total_due_jmd": float(total_due_jmd.quantize(Decimal("0.01"))),
        "ready_count": ready_count,
        "paid_count": paid_count,
        "package_count": len(packages),
        "currency": "JMD",
    }


def _validate_checkout_packages(
    customer: User,
    package_ids: list,
) -> list[Package]:
    if not package_ids:
        raise ValueError("Select at least one package to checkout")

    if len(package_ids) > 50:
        raise ValueError("Cannot checkout more than 50 packages at once")

    packages: list[Package] = []
    seen: set[str] = set()

    for raw_id in package_ids:
        pid = str(raw_id)
        if pid in seen:
            continue
        seen.add(pid)

        package = Package.query.filter_by(id=raw_id, customer_id=customer.id).first()
        if not package:
            raise ValueError("One or more packages were not found for this customer")
        if package.status != PAYMENT_ELIGIBLE_STATUS:
            raise ValueError(
                f"{package.tracking_number} must be ready for pickup before payment"
            )
        if package.billing_status != "ready":
            raise ValueError(
                f"{package.tracking_number} is not ready for payment ({package.billing_status})"
            )
        if package.total_due_jmd is None:
            raise ValueError(f"{package.tracking_number} has no bill amount")
        if get_package_checkout_item(package):
            raise ValueError(f"{package.tracking_number} is already paid")
        packages.append(package)

    if not packages:
        raise ValueError("Select at least one package to checkout")

    return packages


def record_payment_checkout(
    customer: User,
    package_ids: list,
    *,
    method: str,
    recorded_by: User,
    reference: str | None = None,
    notes: str | None = None,
    processing_fee_jmd: float | None = None,
    include_delivery_fee: bool = False,
) -> PaymentCheckout:
    if method not in PAYMENT_METHODS:
        raise ValueError("Invalid payment method")

    packages = _validate_checkout_packages(customer, package_ids)
    delivery_request, delivery_fee = resolve_delivery_request_for_payment(customer, packages)
    if delivery_fee <= 0 and include_delivery_fee:
        delivery_fee = DELIVERY_FEE_JMD
    total = Decimal("0")
    line_amounts: list[tuple[Package, Decimal]] = []

    for package in packages:
        amount = _decimal(package.total_due_jmd)
        if amount <= 0:
            raise ValueError(f"{package.tracking_number} has an invalid bill amount")
        total += amount
        line_amounts.append((package, amount))

    if delivery_fee > 0:
        total += delivery_fee

    processing_fee = Decimal("0")
    if processing_fee_jmd is not None:
        processing_fee = _decimal(processing_fee_jmd)
        if processing_fee < 0:
            raise ValueError("Processing fee cannot be negative")
        if processing_fee > 0:
            total += processing_fee

    checkout = PaymentCheckout(
        customer_id=customer.id,
        invoice_number=generate_invoice_number(),
        total_jmd=total,
        method=method,
        reference=(reference or "").strip() or None,
        notes=(notes or "").strip() or None,
        recorded_by_id=recorded_by.id,
        recorded_at=datetime.utcnow(),
        delivery_request_id=delivery_request.id if delivery_request else None,
        delivery_fee_jmd=delivery_fee if delivery_fee > 0 else None,
        processing_fee_jmd=processing_fee if processing_fee > 0 else None,
    )
    db.session.add(checkout)
    db.session.flush()

    method_label = method.replace("_", " ")
    for package, amount in line_amounts:
        db.session.add(
            PaymentCheckoutItem(
                checkout_id=checkout.id,
                package_id=package.id,
                amount_jmd=amount,
            )
        )
        package.billing_status = "paid"
        package.updated_at = datetime.utcnow()
        add_package_event(
            package,
            package.status,
            f"Payment recorded ({method_label}) — invoice {checkout.invoice_number}",
        )

    db.session.commit()
    return checkout


def record_package_payment(
    package: Package,
    *,
    method: str,
    recorded_by: User,
    reference: str | None = None,
    notes: str | None = None,
) -> PaymentCheckout:
    """Single-package checkout convenience wrapper."""
    return record_payment_checkout(
        package.customer,
        [str(package.id)],
        method=method,
        recorded_by=recorded_by,
        reference=reference,
        notes=notes,
    )

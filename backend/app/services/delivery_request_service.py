from datetime import datetime
from decimal import Decimal
import uuid

from app.constants import DELIVERY_FEE_JMD, DELIVERY_REQUEST_OPEN_STATUSES, PAYMENT_ELIGIBLE_STATUS
from app.extensions import db
from app.models.delivery_request import DeliveryRequest, DeliveryRequestPackage
from app.models.package import Package
from app.models.user import User
from app.services.delivery_address_service import get_delivery_address
from app.services.package_service import add_package_event, update_package_status


def _decimal(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def list_customer_delivery_requests(customer: User, limit: int = 50) -> list[DeliveryRequest]:
    return (
        DeliveryRequest.query.filter_by(customer_id=customer.id)
        .order_by(DeliveryRequest.requested_at.desc())
        .limit(limit)
        .all()
    )


def list_pending_customer_delivery_requests(customer: User, limit: int = 20) -> list[DeliveryRequest]:
    return (
        DeliveryRequest.query.filter(
            DeliveryRequest.customer_id == customer.id,
            DeliveryRequest.status.in_(DELIVERY_REQUEST_OPEN_STATUSES),
        )
        .order_by(DeliveryRequest.requested_at.desc())
        .limit(limit)
        .all()
    )


def list_pending_delivery_requests(limit: int = 100) -> list[DeliveryRequest]:
    return (
        DeliveryRequest.query.filter_by(status="pending")
        .order_by(DeliveryRequest.requested_at.asc())
        .limit(limit)
        .all()
    )


def list_open_delivery_requests(limit: int = 200) -> list[DeliveryRequest]:
    return (
        DeliveryRequest.query.filter(DeliveryRequest.status.in_(DELIVERY_REQUEST_OPEN_STATUSES))
        .order_by(DeliveryRequest.requested_at.asc())
        .limit(limit)
        .all()
    )


def list_all_delivery_requests(limit: int = 200) -> list[DeliveryRequest]:
    return (
        DeliveryRequest.query.order_by(DeliveryRequest.requested_at.desc())
        .limit(limit)
        .all()
    )


def list_delivery_request_history(limit: int = 200) -> list[DeliveryRequest]:
    return (
        DeliveryRequest.query.filter(~DeliveryRequest.status.in_(DELIVERY_REQUEST_OPEN_STATUSES))
        .order_by(DeliveryRequest.requested_at.desc())
        .limit(limit)
        .all()
    )


def list_delivery_requests_by_status(status: str, limit: int = 200) -> list[DeliveryRequest]:
    return (
        DeliveryRequest.query.filter_by(status=status)
        .order_by(DeliveryRequest.requested_at.desc())
        .limit(limit)
        .all()
    )


def count_pending_delivery_requests() -> int:
    return DeliveryRequest.query.filter_by(status="pending").count()


def count_open_delivery_requests() -> int:
    return DeliveryRequest.query.filter(DeliveryRequest.status.in_(DELIVERY_REQUEST_OPEN_STATUSES)).count()


def get_delivery_request(request_id) -> DeliveryRequest | None:
    try:
        rid = uuid.UUID(str(request_id))
    except ValueError:
        return None
    return DeliveryRequest.query.get(rid)


def get_active_request_for_package(package_id) -> DeliveryRequest | None:
    link = (
        DeliveryRequestPackage.query.join(DeliveryRequest)
        .filter(
            DeliveryRequestPackage.package_id == package_id,
            DeliveryRequest.status.in_(DELIVERY_REQUEST_OPEN_STATUSES),
        )
        .first()
    )
    return link.delivery_request if link else None


def get_pending_request_for_package(package_id) -> DeliveryRequest | None:
    return get_active_request_for_package(package_id)


def package_pending_delivery_summary(package: Package) -> dict | None:
    request = get_pending_request_for_package(package.id)
    if not request:
        return None
    return {
        "id": str(request.id),
        "status": request.status,
        "status_label": request.to_dict()["status_label"],
        "delivery_fee_jmd": float(request.delivery_fee_jmd),
        "requested_at": request.requested_at.isoformat() if request.requested_at else None,
    }


def _validate_request_packages(customer: User, package_ids: list) -> list[Package]:
    if not package_ids:
        raise ValueError("Select at least one package for delivery")

    if len(package_ids) > 50:
        raise ValueError("Cannot request delivery for more than 50 packages at once")

    packages: list[Package] = []
    seen: set[str] = set()

    for raw_id in package_ids:
        pid = str(raw_id)
        if pid in seen:
            continue
        seen.add(pid)

        package = Package.query.filter_by(id=raw_id, customer_id=customer.id).first()
        if not package:
            raise ValueError("One or more packages were not found on your account")
        if package.status != PAYMENT_ELIGIBLE_STATUS:
            raise ValueError(f"{package.tracking_number} is not ready for pickup or delivery yet")
        if package.status == "delivered":
            raise ValueError(f"{package.tracking_number} has already been delivered")
        if get_active_request_for_package(package.id):
            raise ValueError(f"{package.tracking_number} already has an active delivery request")
        packages.append(package)

    if not packages:
        raise ValueError("Select at least one package for delivery")

    return packages


def create_delivery_request(
    customer: User,
    *,
    package_ids: list,
    delivery_address_id,
    notes: str | None = None,
) -> DeliveryRequest:
    packages = _validate_request_packages(customer, package_ids)

    address = get_delivery_address(customer, delivery_address_id)
    if not address:
        raise ValueError("Delivery address not found")

    note_text = (notes or "").strip() or None
    if note_text and len(note_text) > 500:
        raise ValueError("notes must be 500 characters or fewer")

    request = DeliveryRequest(
        customer_id=customer.id,
        delivery_address_id=address.id,
        status="pending",
        delivery_fee_jmd=DELIVERY_FEE_JMD,
        notes=note_text,
        requested_at=datetime.utcnow(),
    )
    db.session.add(request)
    db.session.flush()

    for package in packages:
        db.session.add(
            DeliveryRequestPackage(
                delivery_request_id=request.id,
                package_id=package.id,
            )
        )
        package.delivery_address_id = address.id
        package.updated_at = datetime.utcnow()
        add_package_event(
            package,
            package.status,
            f"Delivery requested to {address.label}",
        )

    db.session.commit()
    return request


def cancel_delivery_request(request: DeliveryRequest, *, by_customer: bool = True) -> DeliveryRequest:
    if by_customer and request.status != "pending":
        raise ValueError("Only pending delivery requests can be cancelled")
    if not by_customer and request.status not in DELIVERY_REQUEST_OPEN_STATUSES:
        raise ValueError("Only open delivery requests can be cancelled")

    request.status = "cancelled"
    request.cancelled_at = datetime.utcnow()

    for link in request.package_links:
        package = link.package
        if package:
            add_package_event(package, package.status, "Delivery request cancelled")

    db.session.commit()
    return request


def mark_delivery_request_in_progress(request: DeliveryRequest, staff_user: User) -> DeliveryRequest:
    if request.status != "pending":
        raise ValueError("Only pending delivery requests can be marked in progress")

    request.status = "in_progress"
    request.in_progress_at = datetime.utcnow()
    request.in_progress_by_id = staff_user.id

    for link in request.package_links:
        package = link.package
        if package:
            add_package_event(package, package.status, "Delivery in progress")

    db.session.commit()
    return request


def complete_delivery_request(request: DeliveryRequest, staff_user: User) -> DeliveryRequest:
    if request.status not in DELIVERY_REQUEST_OPEN_STATUSES:
        raise ValueError("Only open delivery requests can be completed")

    unpaid = [
        link.package.tracking_number
        for link in request.package_links
        if link.package and link.package.billing_status != "paid"
    ]
    if unpaid:
        raise ValueError(
            f"Payment required before delivery: {', '.join(unpaid)}"
        )

    for link in request.package_links:
        package = link.package
        if not package:
            continue
        if package.status == "delivered":
            continue
        update_package_status(package, "delivered", note="Delivery completed")

    request.status = "completed"
    request.completed_at = datetime.utcnow()
    request.completed_by_id = staff_user.id
    db.session.commit()
    return request


def resolve_delivery_request_for_payment(
    customer: User,
    packages: list[Package],
) -> tuple[DeliveryRequest | None, Decimal]:
    if not packages:
        return None, Decimal("0")

    request_ids: set[uuid.UUID] = set()
    for package in packages:
        request = get_pending_request_for_package(package.id)
        if request:
            if request.customer_id != customer.id:
                raise ValueError("Invalid delivery request for customer")
            request_ids.add(request.id)

    if not request_ids:
        return None, Decimal("0")

    if len(request_ids) > 1:
        raise ValueError("Selected packages belong to different delivery requests")

    request = DeliveryRequest.query.get(next(iter(request_ids)))
    if not request or request.status not in DELIVERY_REQUEST_OPEN_STATUSES:
        raise ValueError("Delivery request is no longer active")

    request_package_ids = {link.package_id for link in request.package_links}
    checkout_package_ids = {package.id for package in packages}
    if request_package_ids != checkout_package_ids:
        raise ValueError(
            "All packages in a delivery request must be paid together"
        )

    return request, _decimal(request.delivery_fee_jmd)


def compute_payment_total_with_delivery(
    customer: User,
    package_ids: list,
) -> dict:
    packages = _validate_request_packages_for_payment(customer, package_ids)
    packages_total = Decimal("0")
    for package in packages:
        if package.total_due_jmd is not None:
            packages_total += _decimal(package.total_due_jmd)

    request, delivery_fee = resolve_delivery_request_for_payment(customer, packages)
    total = (packages_total + delivery_fee).quantize(Decimal("0.01"))

    return {
        "packages_total_jmd": float(packages_total),
        "delivery_fee_jmd": float(delivery_fee),
        "delivery_request_id": str(request.id) if request else None,
        "total_jmd": float(total),
        "currency": "JMD",
    }


def _validate_request_packages_for_payment(customer: User, package_ids: list) -> list[Package]:
    if not package_ids:
        raise ValueError("Select at least one package")

    packages: list[Package] = []
    seen: set[str] = set()

    for raw_id in package_ids:
        pid = str(raw_id)
        if pid in seen:
            continue
        seen.add(pid)

        package = Package.query.filter_by(id=raw_id, customer_id=customer.id).first()
        if not package:
            raise ValueError("One or more packages were not found on your account")
        if package.billing_status == "paid":
            raise ValueError(f"{package.tracking_number} is already paid")
        if package.status != PAYMENT_ELIGIBLE_STATUS or package.billing_status != "ready":
            raise ValueError(f"{package.tracking_number} is not ready for payment yet")
        if package.total_due_jmd is None:
            raise ValueError(f"{package.tracking_number} has no bill amount")
        packages.append(package)

    return packages

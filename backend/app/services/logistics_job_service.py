from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import selectinload

from app.constants import (
    LOGISTICS_DELIVERY_SPEEDS,
    LOGISTICS_ENABLED_PAYMENT_METHODS,
    LOGISTICS_IN_HOUSE_FEE_JMD,
    LOGISTICS_IN_HOUSE_PARISHES,
    LOGISTICS_ISLAND_FEE_JMD,
    LOGISTICS_ITEM_CATEGORIES,
    LOGISTICS_ITEM_CATEGORY_LABELS,
    LOGISTICS_JOB_OPEN_STATUSES,
    LOGISTICS_PAYMENT_METHODS,
    LOGISTICS_VEHICLE_TYPES,
)
from app.extensions import db
from app.models.logistics_job import LogisticsJob
from app.models.user import User
from app.services.delivery_address_service import create_delivery_address, get_delivery_address


def _decimal(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def _load_options():
    return (
        selectinload(LogisticsJob.customer),
        selectinload(LogisticsJob.pickup_address),
        selectinload(LogisticsJob.dropoff_address),
        selectinload(LogisticsJob.in_progress_by),
        selectinload(LogisticsJob.picked_up_by),
        selectinload(LogisticsJob.in_transit_by),
        selectinload(LogisticsJob.driver_confirmed_by),
        selectinload(LogisticsJob.completed_by),
        selectinload(LogisticsJob.assigned_clerk),
        selectinload(LogisticsJob.assigned_by),
        selectinload(LogisticsJob.rejected_by),
    )


def _query():
    return LogisticsJob.query.options(*_load_options())


def _next_reference() -> str:
    prefix = "LD"
    latest = (
        LogisticsJob.query.filter(LogisticsJob.reference.like(f"{prefix}-%"))
        .order_by(LogisticsJob.requested_at.desc())
        .first()
    )
    if latest and latest.reference.startswith(f"{prefix}-"):
        try:
            seq = int(latest.reference.split("-", 1)[1]) + 1
        except ValueError:
            seq = LogisticsJob.query.count() + 1
    else:
        seq = LogisticsJob.query.count() + 1
    return f"{prefix}-{seq:05d}"


def _resolve_address(
    customer: User,
    *,
    address_id=None,
    address_data: dict | None = None,
    default_label: str,
):
    if address_id:
        address = get_delivery_address(customer, address_id)
        if not address:
            raise ValueError(f"{default_label} address not found")
        return address

    if address_data and isinstance(address_data, dict):
        payload = dict(address_data)
        if not (payload.get("label") or "").strip():
            payload["label"] = default_label
        return create_delivery_address(customer, payload)

    raise ValueError(f"{default_label} address is required")


def estimate_logistics_fee(pickup_parish: str, dropoff_parish: str) -> tuple[Decimal, bool]:
    pickup_in_house = pickup_parish in LOGISTICS_IN_HOUSE_PARISHES
    dropoff_in_house = dropoff_parish in LOGISTICS_IN_HOUSE_PARISHES
    if pickup_in_house and dropoff_in_house:
        return LOGISTICS_IN_HOUSE_FEE_JMD, False
    if pickup_in_house or dropoff_in_house:
        return LOGISTICS_ISLAND_FEE_JMD, False
    return Decimal("0.00"), True


def list_customer_logistics_jobs(customer: User, limit: int = 50) -> list[LogisticsJob]:
    return (
        _query()
        .filter_by(customer_id=customer.id)
        .order_by(LogisticsJob.requested_at.desc())
        .limit(limit)
        .all()
    )


def list_pending_logistics_jobs(limit: int = 100) -> list[LogisticsJob]:
    return (
        _query()
        .filter_by(status="pending")
        .order_by(LogisticsJob.requested_at.asc())
        .limit(limit)
        .all()
    )


def list_open_logistics_jobs(limit: int = 100) -> list[LogisticsJob]:
    return (
        _query()
        .filter(LogisticsJob.status.in_(LOGISTICS_JOB_OPEN_STATUSES))
        .order_by(LogisticsJob.requested_at.asc())
        .limit(limit)
        .all()
    )


def list_all_logistics_jobs(limit: int = 200) -> list[LogisticsJob]:
    return (
        _query()
        .order_by(LogisticsJob.requested_at.desc())
        .limit(limit)
        .all()
    )


def list_logistics_job_history(limit: int = 200) -> list[LogisticsJob]:
    return (
        _query()
        .filter(~LogisticsJob.status.in_(LOGISTICS_JOB_OPEN_STATUSES))
        .order_by(LogisticsJob.requested_at.desc())
        .limit(limit)
        .all()
    )


def list_logistics_jobs_by_status(status: str, limit: int = 200) -> list[LogisticsJob]:
    return (
        _query()
        .filter_by(status=status)
        .order_by(LogisticsJob.requested_at.desc())
        .limit(limit)
        .all()
    )


def count_open_logistics_jobs() -> int:
    return LogisticsJob.query.filter(LogisticsJob.status.in_(LOGISTICS_JOB_OPEN_STATUSES)).count()


def count_clerk_open_logistics_jobs(clerk: User) -> int:
    return (
        LogisticsJob.query.filter(
            LogisticsJob.assigned_clerk_id == clerk.id,
            LogisticsJob.status.in_(LOGISTICS_JOB_OPEN_STATUSES),
        ).count()
    )


def list_clerk_logistics_jobs(clerk: User, status: str = "active", limit: int = 100) -> list[LogisticsJob]:
    base = _query().filter(LogisticsJob.assigned_clerk_id == clerk.id)
    if status == "pending":
        jobs = base.filter_by(status="pending")
    elif status == "active":
        jobs = base.filter(LogisticsJob.status.in_(LOGISTICS_JOB_OPEN_STATUSES))
    elif status == "all":
        jobs = base
    elif status == "history":
        jobs = base.filter(~LogisticsJob.status.in_(LOGISTICS_JOB_OPEN_STATUSES))
    elif status in ("rejected", "cancelled", "completed", "picked_up", "in_transit"):
        jobs = base.filter_by(status=status)
    else:
        jobs = base.filter_by(status=status)
    return jobs.order_by(LogisticsJob.requested_at.asc()).limit(limit).all()


def count_pending_logistics_jobs() -> int:
    return LogisticsJob.query.filter_by(status="pending").count()


def get_logistics_job(job_id) -> LogisticsJob | None:
    import uuid

    try:
        jid = uuid.UUID(str(job_id))
    except ValueError:
        return None
    return _query().filter_by(id=jid).first()


def resolve_item_description(
    *,
    item_category: str | None = None,
    item_other_detail: str | None = None,
    item_description: str | None = None,
) -> str:
    if item_category:
        category = item_category.strip().lower()
        if category not in LOGISTICS_ITEM_CATEGORIES:
            raise ValueError("Select a valid item category")
        if category == "other":
            detail = (item_other_detail or "").strip()
            if not detail:
                raise ValueError("Describe the item when selecting Other")
            if len(detail) > 480:
                raise ValueError("Item description must be 500 characters or fewer")
            return f"Other — {detail}"
        return LOGISTICS_ITEM_CATEGORY_LABELS[category]

    description = (item_description or "").strip()
    if not description:
        raise ValueError("Item category is required")
    if len(description) > 500:
        raise ValueError("Item description must be 500 characters or fewer")
    return description


def resolve_vehicle_type(vehicle_type: str | None) -> str:
    value = (vehicle_type or "").strip().lower()
    if value not in LOGISTICS_VEHICLE_TYPES:
        raise ValueError("Select a vehicle size for this delivery")
    return value


def resolve_delivery_speed(delivery_speed: str | None) -> str:
    value = (delivery_speed or "immediate").strip().lower()
    if value not in LOGISTICS_DELIVERY_SPEEDS:
        raise ValueError("Select when you need this delivery")
    return value


def resolve_payment_method(payment_method: str | None) -> str:
    value = (payment_method or "cash").strip().lower()
    if value not in LOGISTICS_PAYMENT_METHODS:
        raise ValueError("Select a payment method")
    if value not in LOGISTICS_ENABLED_PAYMENT_METHODS:
        raise ValueError("Online payment is not available yet — please choose cash")
    return value


def create_logistics_job(
    customer: User,
    *,
    pickup_address_id=None,
    pickup_address: dict | None = None,
    dropoff_address_id=None,
    dropoff_address: dict | None = None,
    item_category: str | None = None,
    item_other_detail: str | None = None,
    item_description: str | None = None,
    vehicle_type: str | None = None,
    delivery_speed: str | None = None,
    payment_method: str | None = None,
    weight_lbs=None,
    notes: str | None = None,
) -> LogisticsJob:
    description = resolve_item_description(
        item_category=item_category,
        item_other_detail=item_other_detail,
        item_description=item_description,
    )
    vehicle = resolve_vehicle_type(vehicle_type)
    speed = resolve_delivery_speed(delivery_speed)
    pay_method = resolve_payment_method(payment_method)

    note_text = (notes or "").strip() or None
    if note_text and len(note_text) > 500:
        raise ValueError("notes must be 500 characters or fewer")

    pickup = _resolve_address(
        customer,
        address_id=pickup_address_id,
        address_data=pickup_address,
        default_label="Pickup",
    )
    dropoff = _resolve_address(
        customer,
        address_id=dropoff_address_id,
        address_data=dropoff_address,
        default_label="Drop-off",
    )

    if pickup.id == dropoff.id:
        raise ValueError("Pickup and drop-off must be different addresses")

    fee, fee_pending = estimate_logistics_fee(pickup.parish, dropoff.parish)
    if vehicle == "truck":
        fee_pending = True
        fee = None

    job = LogisticsJob(
        reference=_next_reference(),
        customer_id=customer.id,
        pickup_address_id=pickup.id,
        dropoff_address_id=dropoff.id,
        item_description=description,
        vehicle_type=vehicle,
        delivery_speed=speed,
        payment_method=pay_method,
        weight_lbs=None,
        notes=note_text,
        status="pending",
        quoted_fee_jmd=None if fee_pending else fee,
        fee_pending_quote=fee_pending,
        requested_at=datetime.utcnow(),
    )
    db.session.add(job)
    db.session.commit()
    return job


def update_customer_logistics_notes(job: LogisticsJob, customer: User, notes: str) -> LogisticsJob:
    if job.customer_id != customer.id:
        raise ValueError("Local delivery request not found")
    if job.status not in LOGISTICS_JOB_OPEN_STATUSES:
        raise ValueError("Notes can only be updated on active deliveries")

    note_text = (notes or "").strip()
    if not note_text:
        raise ValueError("Note cannot be empty")
    if len(note_text) > 500:
        raise ValueError("Note must be 500 characters or fewer")

    job.notes = note_text
    db.session.commit()
    return job


def confirm_logistics_driver(
    job: LogisticsJob,
    staff_user: User,
    *,
    driver_name: str,
    driver_contact_number: str,
) -> LogisticsJob:
    if job.status != "pending":
        raise ValueError("Driver can only be confirmed on jobs searching for a driver")

    name = (driver_name or "").strip()
    if not name:
        raise ValueError("Driver name is required")

    from app.services.auth_service import normalize_phone

    try:
        contact = normalize_phone(driver_contact_number)
    except ValueError as exc:
        raise ValueError(str(exc)) from exc

    job.driver_name = name
    job.driver_contact_number = contact
    job.driver_confirmed_at = datetime.utcnow()
    job.driver_confirmed_by_id = staff_user.id
    db.session.commit()
    return job


def _get_active_clerk(clerk_id) -> User:
    import uuid

    try:
        cid = uuid.UUID(str(clerk_id))
    except ValueError as exc:
        raise ValueError("Select a valid clerk") from exc

    clerk = User.query.filter_by(id=cid, role="clerk").first()
    if not clerk or clerk.is_active is False:
        raise ValueError("Clerk not found or inactive")
    if not (clerk.contact_number or "").strip():
        raise ValueError("Clerk must have a contact number before assignment")
    return clerk


def assign_logistics_clerk(job: LogisticsJob, admin_user: User, *, clerk_id) -> LogisticsJob:
    if job.status != "pending":
        raise ValueError("Only pending local delivery requests can be assigned")

    clerk = _get_active_clerk(clerk_id)

    from app.services.auth_service import normalize_phone

    try:
        contact = normalize_phone(clerk.contact_number)
    except ValueError as exc:
        raise ValueError(f"Clerk contact number is invalid: {exc}") from exc

    now = datetime.utcnow()
    job.assigned_clerk_id = clerk.id
    job.assigned_at = now
    job.assigned_by_id = admin_user.id
    job.driver_name = clerk.full_name
    job.driver_contact_number = contact
    job.driver_confirmed_at = now
    job.driver_confirmed_by_id = admin_user.id
    db.session.commit()
    refreshed = get_logistics_job(job.id)
    return refreshed or job


def reject_logistics_job(
    job: LogisticsJob,
    admin_user: User,
    *,
    reason: str | None = None,
) -> LogisticsJob:
    if job.status != "pending":
        raise ValueError("Only pending local delivery requests can be rejected")

    reason_text = (reason or "").strip() or None
    if reason_text and len(reason_text) > 500:
        raise ValueError("Rejection reason must be 500 characters or fewer")

    job.status = "rejected"
    job.rejected_at = datetime.utcnow()
    job.rejected_by_id = admin_user.id
    job.rejection_reason = reason_text
    db.session.commit()
    return job


def cancel_logistics_job(job: LogisticsJob, *, by_customer: bool = True) -> LogisticsJob:
    if by_customer and job.status != "pending":
        raise ValueError("Only pending jobs can be cancelled")
    if not by_customer and job.status not in LOGISTICS_JOB_OPEN_STATUSES:
        raise ValueError("Only open jobs can be cancelled")

    job.status = "cancelled"
    job.cancelled_at = datetime.utcnow()
    db.session.commit()
    return job


def mark_logistics_job_picked_up(job: LogisticsJob, staff_user: User) -> LogisticsJob:
    if job.status != "pending":
        raise ValueError("Only jobs searching for a driver can be marked picked up")

    job.status = "picked_up"
    job.picked_up_at = datetime.utcnow()
    job.picked_up_by_id = staff_user.id
    db.session.commit()
    return job


def mark_logistics_job_in_transit(job: LogisticsJob, staff_user: User) -> LogisticsJob:
    if job.status != "picked_up":
        raise ValueError("Only picked-up jobs can be marked in transit")

    job.status = "in_transit"
    job.in_transit_at = datetime.utcnow()
    job.in_transit_by_id = staff_user.id
    db.session.commit()
    return job


def complete_logistics_job(job: LogisticsJob, staff_user: User) -> LogisticsJob:
    if job.status != "in_transit":
        raise ValueError("Only in-transit jobs can be completed")

    job.status = "completed"
    job.completed_at = datetime.utcnow()
    job.completed_by_id = staff_user.id
    db.session.commit()
    return job


def confirm_customer_logistics_receipt(job: LogisticsJob, customer: User) -> LogisticsJob:
    if job.customer_id != customer.id:
        raise ValueError("Local delivery request not found")
    if job.status != "completed":
        raise ValueError("Receipt can only be confirmed after delivery")
    if job.customer_receipt_confirmed_at:
        raise ValueError("Receipt already confirmed")

    job.customer_receipt_confirmed_at = datetime.utcnow()
    db.session.commit()
    return job

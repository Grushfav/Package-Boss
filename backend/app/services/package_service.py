import re
import uuid
from datetime import datetime, timedelta

from flask import current_app

from app.constants import UNIDENTIFIED_HOLDER_SHIPPING_ID
from app.extensions import db
from app.models.package import Package, PackageEvent, PackagePhoto
from app.models.user import User
from app.services.shipping_service import calculate_shipping_cost
from app.services.image_upload_service import is_valid_photo_reference


def generate_tracking_number() -> str:
    year = datetime.utcnow().year
    packages = Package.query.filter(Package.tracking_number.like(f"PB-{year}-%")).all()
    max_seq = 0
    for pkg in packages:
        match = re.match(rf"PB-{year}-(\d+)$", pkg.tracking_number)
        if match:
            max_seq = max(max_seq, int(match.group(1)))
    return f"PB-{year}-{max_seq + 1:06d}"


def add_package_event(package: Package, status: str, note: str | None = None) -> None:
    previous_status = package.status
    had_events = bool(package.events)

    event = PackageEvent(package_id=package.id, status=status, note=note)
    db.session.add(event)
    package.status = status
    package.updated_at = datetime.utcnow()

    if status != "unidentified" and (previous_status != status or not had_events):
        _notify_package_status_email(package, status, note)


def _notify_package_status_email(package: Package, status: str, note: str | None) -> None:
    customer = package.customer
    if customer is None and package.customer_id:
        customer = db.session.get(User, package.customer_id)
    if not customer or customer.shipping_id == UNIDENTIFIED_HOLDER_SHIPPING_ID:
        current_app.logger.info(
            "Skipping status email for %s (no customer or unidentified holder)",
            package.tracking_number,
        )
        return

    try:
        from app.services.email_service import EmailServiceError, send_package_status_email

        send_package_status_email(
            customer.email,
            customer.first_name,
            package.tracking_number,
            status,
            note=note,
        )
    except EmailServiceError as exc:
        current_app.logger.error(
            "Status email failed for %s → %s: %s",
            package.tracking_number,
            customer.email,
            exc,
        )
    except Exception as exc:
        current_app.logger.warning(
            "Failed to send status email for %s: %s",
            package.tracking_number,
            exc,
        )


def receive_package(
    customer: User,
    actual_weight_lbs: float,
    carrier_tracking: str | None = None,
    shipper: str | None = None,
    photo_keys: list[str] | None = None,
    note: str | None = None,
) -> Package:
    quote = calculate_shipping_cost(actual_weight_lbs)
    tracking_number = generate_tracking_number()

    package = Package(
        tracking_number=tracking_number,
        customer_id=customer.id,
        carrier_tracking=(carrier_tracking or "").strip() or None,
        shipper=(shipper or "").strip().lower() or None,
        actual_weight_lbs=quote["actual_weight_lbs"],
        billable_weight_lbs=quote["billable_weight_lbs"],
        estimated_freight_usd=quote["cost_usd"],
        rate_tier_label=quote["tier_label"],
        billing_status="pending",
        invoice_status="pending",
        status="received_miami",
        received_at=datetime.utcnow(),
    )
    db.session.add(package)
    db.session.flush()

    add_package_event(
        package,
        "received_miami",
        note or f"Package received at Miami warehouse for {customer.shipping_id}",
    )

    for key in photo_keys or []:
        if is_valid_photo_reference(key, shipping_id=customer.shipping_id):
            db.session.add(PackagePhoto(package_id=package.id, r2_object_key=key))

    db.session.commit()
    return package


def receive_unidentified_package(
    actual_weight_lbs: float,
    carrier_tracking: str | None = None,
    shipper: str | None = None,
    label_name: str | None = None,
    label_boss_id: str | None = None,
    photo_keys: list[str] | None = None,
    note: str | None = None,
) -> Package:
    from app.services.unidentified_service import ensure_unidentified_holder

    holder = ensure_unidentified_holder()
    quote = calculate_shipping_cost(actual_weight_lbs)
    tracking_number = generate_tracking_number()

    normalized_label_name = (label_name or "").strip() or None
    normalized_label_boss_id = (label_boss_id or "").strip().upper() or None

    if not normalized_label_name and not normalized_label_boss_id and not (carrier_tracking or "").strip():
        raise ValueError(
            "Provide a label name, BOSS ID from the label, or carrier tracking to identify the package"
        )

    package = Package(
        tracking_number=tracking_number,
        customer_id=holder.id,
        carrier_tracking=(carrier_tracking or "").strip() or None,
        label_name=normalized_label_name,
        label_boss_id=normalized_label_boss_id,
        shipper=(shipper or "").strip().lower() or None,
        actual_weight_lbs=quote["actual_weight_lbs"],
        billable_weight_lbs=quote["billable_weight_lbs"],
        estimated_freight_usd=quote["cost_usd"],
        rate_tier_label=quote["tier_label"],
        billing_status="pending",
        invoice_status="pending",
        status="unidentified",
        received_at=datetime.utcnow(),
    )
    db.session.add(package)
    db.session.flush()

    label_bits = []
    if normalized_label_name:
        label_bits.append(f"name: {normalized_label_name}")
    if normalized_label_boss_id:
        label_bits.append(f"BOSS ID: {normalized_label_boss_id}")
    label_summary = ", ".join(label_bits) if label_bits else "no label details"

    add_package_event(
        package,
        "unidentified",
        note or f"Added to unidentified queue ({label_summary})",
    )

    for key in photo_keys or []:
        if is_valid_photo_reference(key, unidentified=True):
            db.session.add(PackagePhoto(package_id=package.id, r2_object_key=key))

    db.session.commit()
    return package


def assign_unidentified_package(package: Package, customer: User, note: str | None = None) -> Package:
    if package.status != "unidentified":
        raise ValueError("Only unidentified packages can be assigned to a customer")

    package.customer_id = customer.id
    add_package_event(
        package,
        "received_miami",
        note or f"Assigned to {customer.shipping_id} ({customer.full_name})",
    )
    db.session.commit()
    return package


def list_unidentified_packages(limit: int = 50, offset: int = 0) -> tuple[list[Package], int]:
    query = Package.query.filter_by(status="unidentified").order_by(Package.received_at.desc())
    total = query.count()
    packages = query.offset(offset).limit(limit).all()
    return packages, total


def _parse_date_bound(value: str, end_of_day: bool = False) -> datetime | None:
    try:
        dt = datetime.strptime(value.strip(), "%Y-%m-%d")
    except (ValueError, AttributeError):
        return None
    if end_of_day:
        return dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def list_warehouse_packages(
    from_date: str | None = None,
    to_date: str | None = None,
    status: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[Package], int]:
    query = Package.query.filter(Package.status != "unidentified")

    if from_date:
        start = _parse_date_bound(from_date)
        if start:
            query = query.filter(Package.received_at >= start)

    if to_date:
        end = _parse_date_bound(to_date, end_of_day=True)
        if end:
            query = query.filter(Package.received_at <= end)

    if status:
        query = query.filter(Package.status == status)

    query = query.order_by(Package.received_at.desc(), Package.tracking_number.desc())
    total = query.count()
    packages = query.offset(offset).limit(limit).all()
    return packages, total


def warehouse_package_to_dict(package: Package) -> dict:
    data = package.to_dict()
    customer = package.customer
    if customer and customer.shipping_id != UNIDENTIFIED_HOLDER_SHIPPING_ID:
        data["customer"] = {
            "id": str(customer.id),
            "full_name": customer.full_name,
            "email": customer.email,
            "shipping_id": customer.shipping_id,
            "parish": customer.parish,
        }
    else:
        data["customer"] = None
    return data


def list_print_queue(days: int = 7, limit: int = 100, offset: int = 0) -> tuple[list[Package], int]:
    cutoff = datetime.utcnow() - timedelta(days=max(1, min(days, 30)))
    query = (
        Package.query.filter(Package.label_printed_at.is_(None))
        .filter(Package.received_at >= cutoff)
        .order_by(Package.received_at.asc(), Package.tracking_number.asc())
    )
    total = query.count()
    packages = query.offset(offset).limit(limit).all()
    return packages, total


def mark_labels_printed(package_ids: list[str]) -> tuple[list[Package], list[dict]]:
    now = datetime.utcnow()
    marked: list[Package] = []
    failed: list[dict] = []

    for raw_id in package_ids:
        try:
            pid = uuid.UUID(str(raw_id))
        except (TypeError, ValueError):
            failed.append({"id": str(raw_id), "error": "Invalid package ID"})
            continue

        package = db.session.get(Package, pid)
        if not package:
            failed.append({"id": str(raw_id), "error": "Package not found"})
            continue

        package.label_printed_at = now
        package.updated_at = now
        marked.append(package)

    if marked:
        db.session.commit()

    return marked, failed


def bulk_update_package_status(
    package_ids: list[str],
    status: str,
    note: str | None = None,
) -> tuple[list[Package], list[dict]]:
    from app.constants import UPDATABLE_STATUSES

    if status not in UPDATABLE_STATUSES:
        raise ValueError(f"Invalid status: {status}")

    updated: list[Package] = []
    failed: list[dict] = []

    for raw_id in package_ids:
        try:
            pid = uuid.UUID(str(raw_id))
        except (TypeError, ValueError):
            failed.append({"id": str(raw_id), "error": "Invalid package ID"})
            continue

        package = db.session.get(Package, pid)
        if not package:
            failed.append({"id": str(raw_id), "error": "Package not found"})
            continue

        if package.status == "unidentified":
            failed.append(
                {
                    "id": str(package.id),
                    "tracking_number": package.tracking_number,
                    "error": "Unidentified packages must be assigned first",
                }
            )
            continue

        try:
            add_package_event(package, status, note)
            updated.append(package)
        except ValueError as exc:
            failed.append(
                {
                    "id": str(package.id),
                    "tracking_number": package.tracking_number,
                    "error": str(exc),
                }
            )

    if updated:
        db.session.commit()

    return updated, failed


def update_package_status(package: Package, status: str, note: str | None = None) -> Package:
    from app.constants import UPDATABLE_STATUSES

    if status not in UPDATABLE_STATUSES:
        raise ValueError(f"Invalid status: {status}")

    add_package_event(package, status, note)
    db.session.commit()
    return package


def get_tracking_timeline(package: Package) -> list[dict]:
    return [
        {
            **event.to_dict(),
            "is_current": event.status == package.status and event.id == package.events[-1].id,
        }
        for event in package.events
    ]


def get_warehouse_summary() -> dict:
    from app.models.pre_alert import PreAlert

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    print_cutoff = datetime.utcnow() - timedelta(days=7)

    print_queue_pending = Package.query.filter(
        Package.label_printed_at.is_(None),
        Package.received_at >= print_cutoff,
    ).count()

    return {
        "print_queue_pending": print_queue_pending,
        "unidentified_count": Package.query.filter_by(status="unidentified").count(),
        "received_miami_count": Package.query.filter_by(status="received_miami").count(),
        "packages_today": Package.query.filter(Package.received_at >= today_start).count(),
        "pending_pre_alerts": PreAlert.query.filter_by(status="pending").count(),
    }

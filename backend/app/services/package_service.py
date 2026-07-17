import re
import uuid
from datetime import datetime, timedelta

from flask import current_app

from app.constants import UNIDENTIFIED_HOLDER_SHIPPING_ID
from app.extensions import db
from app.models.package import Package, PackageEvent, PackagePhoto
from app.models.pre_alert import PreAlert
from app.models.user import User
from app.services.image_upload_service import is_valid_photo_reference
from app.services.pre_alert_service import match_pre_alert_on_receive, normalize_carrier_tracking
from app.services.shipping_service import calculate_receive_quote


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
    from app.constants import STATUS_LABELS, WORKFLOW_TRANSITIONS

    previous_status = package.status
    had_events = bool(package.events)

    if previous_status != status:
        if status == "ready_for_pickup" and previous_status == "customs":
            pass
        elif (previous_status, status) not in WORKFLOW_TRANSITIONS:
            raise ValueError(
                f"Cannot change {package.tracking_number} from "
                f"{STATUS_LABELS.get(previous_status, previous_status)} to "
                f"{STATUS_LABELS.get(status, status)}. Use the next step in the workflow."
            )

    if status == "ready_for_pickup" and previous_status != "ready_for_pickup":
        if package.billing_status != "paid":
            if previous_status == "customs":
                if package.billing_status != "ready":
                    raise ValueError(
                        f"{package.tracking_number} must be released from customs "
                        "so the bill is published before marking ready for pickup"
                    )
            else:
                from app.services.billing_calculations import publish_ready_for_pickup_bill

                publish_ready_for_pickup_bill(package)

    if status == "delivered" and previous_status != "delivered":
        if package.billing_status != "paid":
            raise ValueError(
                f"{package.tracking_number} cannot be delivered until payment is confirmed"
            )

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
        from app.constants import SHIPPER_LABELS
        from app.services.email_service import EmailServiceError, send_package_status_email

        shipper_label = (
            SHIPPER_LABELS.get(package.shipper, package.shipper) if package.shipper else None
        )
        send_package_status_email(
            customer.email,
            customer.first_name,
            package.tracking_number,
            status,
            note=note,
            carrier_tracking=package.carrier_tracking,
            shipper_label=shipper_label,
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
    receive_batch_id: str | None = None,
) -> tuple[Package, PreAlert | None]:
    from app.services.receive_batch_service import assign_package_to_receive_batch, resolve_receive_batch_id

    quote = calculate_receive_quote(actual_weight_lbs)
    tracking_number = generate_tracking_number()
    normalized_carrier = normalize_carrier_tracking(carrier_tracking) if carrier_tracking else None
    if normalized_carrier == "":
        normalized_carrier = None

    package = Package(
        tracking_number=tracking_number,
        customer_id=customer.id,
        carrier_tracking=normalized_carrier,
        shipper=(shipper or "").strip().lower() or None,
        actual_weight_lbs=quote["actual_weight_lbs"],
        billable_weight_lbs=quote["billable_weight_lbs"],
        estimated_freight_jmd=quote["cost_jmd"],
        rate_tier_label=quote["tier_label"],
        billing_status="pending",
        invoice_status="pending",
        status="received",
        received_at=datetime.utcnow(),
    )
    db.session.add(package)
    db.session.flush()

    receive_batch = resolve_receive_batch_id(receive_batch_id)
    if receive_batch:
        assign_package_to_receive_batch(package, receive_batch)

    add_package_event(
        package,
        "received",
        note or f"Package received at Fort Lauderdale for {customer.shipping_id}",
    )

    for key in photo_keys or []:
        if is_valid_photo_reference(key, shipping_id=customer.shipping_id):
            db.session.add(PackagePhoto(package_id=package.id, r2_object_key=key))

    matched_pre_alert = match_pre_alert_on_receive(package)
    if matched_pre_alert:
        db.session.add(
            PackageEvent(
                package_id=package.id,
                status=package.status,
                note=f"Matched customer pre-alert ({matched_pre_alert.carrier_tracking})",
            )
        )

    db.session.commit()
    return package, matched_pre_alert


def receive_unidentified_package(
    actual_weight_lbs: float,
    carrier_tracking: str | None = None,
    shipper: str | None = None,
    label_name: str | None = None,
    label_boss_id: str | None = None,
    photo_keys: list[str] | None = None,
    note: str | None = None,
    receive_batch_id: str | None = None,
) -> Package:
    from app.services.unidentified_service import ensure_unidentified_holder
    from app.services.receive_batch_service import assign_package_to_receive_batch, resolve_receive_batch_id

    holder = ensure_unidentified_holder()
    quote = calculate_receive_quote(actual_weight_lbs)
    tracking_number = generate_tracking_number()

    normalized_label_name = (label_name or "").strip() or None
    normalized_label_boss_id = (label_boss_id or "").strip().upper() or None

    normalized_carrier = normalize_carrier_tracking(carrier_tracking) if carrier_tracking else None
    if normalized_carrier == "":
        normalized_carrier = None

    if not normalized_label_name and not normalized_label_boss_id and not normalized_carrier:
        raise ValueError(
            "Provide a label name, BOSS ID from the label, or carrier tracking to identify the package"
        )

    package = Package(
        tracking_number=tracking_number,
        customer_id=holder.id,
        carrier_tracking=normalized_carrier,
        label_name=normalized_label_name,
        label_boss_id=normalized_label_boss_id,
        shipper=(shipper or "").strip().lower() or None,
        actual_weight_lbs=quote["actual_weight_lbs"],
        billable_weight_lbs=quote["billable_weight_lbs"],
        estimated_freight_jmd=quote["cost_jmd"],
        rate_tier_label=quote["tier_label"],
        billing_status="pending",
        invoice_status="pending",
        status="unidentified",
        received_at=datetime.utcnow(),
    )
    db.session.add(package)
    db.session.flush()

    receive_batch = resolve_receive_batch_id(receive_batch_id)
    if receive_batch:
        assign_package_to_receive_batch(package, receive_batch)

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


def assign_unidentified_package(
    package: Package, customer: User, note: str | None = None
) -> tuple[Package, PreAlert | None]:
    if package.status != "unidentified":
        raise ValueError("Only unidentified packages can be assigned to a customer")

    package.customer_id = customer.id
    add_package_event(
        package,
        "received",
        note or f"Assigned to {customer.shipping_id} ({customer.full_name})",
    )

    matched_pre_alert = match_pre_alert_on_receive(package)
    if matched_pre_alert:
        db.session.add(
            PackageEvent(
                package_id=package.id,
                status=package.status,
                note=f"Matched customer pre-alert ({matched_pre_alert.carrier_tracking})",
            )
        )

    db.session.commit()
    return package, matched_pre_alert


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
    return list_label_log(days=days, limit=limit, offset=offset, pending_only=True)


def list_label_log(
    days: int = 7,
    limit: int = 100,
    offset: int = 0,
    pending_only: bool = False,
) -> tuple[list[Package], int]:
    cutoff = datetime.utcnow() - timedelta(days=max(1, min(days, 30)))
    query = Package.query.filter(Package.received_at >= cutoff)
    if pending_only:
        query = query.filter(Package.label_printed_at.is_(None)).order_by(
            Package.received_at.asc(), Package.tracking_number.asc()
        )
    else:
        query = query.order_by(Package.received_at.desc(), Package.tracking_number.desc())
    total = query.count()
    packages = query.offset(offset).limit(limit).all()
    return packages, total


def list_clerk_receives_today(clerk_id, limit: int = 3) -> list[dict]:
    from app.models.audit_log import AuditLog
    from app.services.audit_service import (
        ACTION_PACKAGE_RECEIVED,
        ACTION_PACKAGE_RECEIVED_UNIDENTIFIED,
    )

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    logs = (
        AuditLog.query.filter(
            AuditLog.actor_id == clerk_id,
            AuditLog.action.in_(
                [ACTION_PACKAGE_RECEIVED, ACTION_PACKAGE_RECEIVED_UNIDENTIFIED]
            ),
            AuditLog.created_at >= today_start,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(max(1, min(limit, 10)))
        .all()
    )

    results: list[dict] = []
    for entry in logs:
        package = None
        if entry.entity_id:
            try:
                pid = uuid.UUID(str(entry.entity_id))
                package = db.session.get(Package, pid)
            except (TypeError, ValueError):
                package = None

        metadata = entry.metadata_json or {}
        item = {
            "received_at": entry.created_at.isoformat(),
            "action": entry.action,
            "tracking_number": metadata.get("tracking_number")
            or (package.tracking_number if package else None),
            "shipping_id": metadata.get("shipping_id"),
            "billable_weight_lbs": metadata.get("billable_weight_lbs")
            or (package.billable_weight_lbs if package else None),
            "is_unidentified": entry.action == ACTION_PACKAGE_RECEIVED_UNIDENTIFIED,
            "label_name": metadata.get("label_name"),
            "package_id": str(package.id) if package else entry.entity_id,
        }

        if package:
            customer = package.customer
            if customer and customer.shipping_id != UNIDENTIFIED_HOLDER_SHIPPING_ID:
                item["customer_name"] = customer.full_name
                item["shipping_id"] = item["shipping_id"] or customer.shipping_id
            elif package.label_name:
                item["customer_name"] = package.label_name
            else:
                item["customer_name"] = "Unidentified"

        results.append(item)

    return results


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
    from app.constants import WORKFLOW_STATUSES
    from app.models.pre_alert import PreAlert
    from app.services.delivery_request_service import count_open_delivery_requests
    from app.services.bank_transfer_proof_service import count_open_transfer_proofs
    from app.services.shipment_service import count_open_shipments

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    print_cutoff = datetime.utcnow() - timedelta(days=7)

    print_queue_pending = Package.query.filter(
        Package.label_printed_at.is_(None),
        Package.received_at >= print_cutoff,
    ).count()

    status_counts = {
        status: Package.query.filter_by(status=status).count() for status in WORKFLOW_STATUSES
    }

    return {
        "print_queue_pending": print_queue_pending,
        "unidentified_count": Package.query.filter_by(status="unidentified").count(),
        "received_count": status_counts["received"],
        "packages_today": Package.query.filter(Package.received_at >= today_start).count(),
        "pending_pre_alerts": PreAlert.query.filter_by(status="pending").count(),
        "open_shipments": count_open_shipments(),
        "pending_delivery_requests": count_open_delivery_requests(),
        "pending_transfer_proofs": count_open_transfer_proofs(),
        "pending_customer_requests": (
            count_open_delivery_requests() + count_open_transfer_proofs()
        ),
        "status_counts": status_counts,
    }

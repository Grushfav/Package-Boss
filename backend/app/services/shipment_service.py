import uuid
from datetime import date, datetime

from sqlalchemy import func

from app.extensions import db
from app.models.package import Package
from app.models.shipment import Shipment
from app.models.user import User
from app.services.audit_service import (
    ACTION_SHIPMENT_CREATED,
    ACTION_SHIPMENT_DEPARTED,
    ACTION_SHIPMENT_PACKAGE_ADDED,
    ACTION_SHIPMENT_PACKAGE_REMOVED,
    log_entity_action,
    log_package_action,
    ACTION_PACKAGE_STATUS_UPDATED,
)
from app.services.package_service import add_package_event


def create_shipment(
    *,
    reference: str,
    departure_date: date,
    note: str | None,
    created_by: User | None,
) -> Shipment:
    reference = reference.strip()
    if not reference:
        raise ValueError("Reference is required")

    shipment = Shipment(
        reference=reference,
        departure_date=departure_date,
        note=note.strip() if note else None,
        status="open",
        created_by_id=created_by.id if created_by else None,
    )
    db.session.add(shipment)
    db.session.flush()

    if created_by:
        log_entity_action(
            created_by,
            ACTION_SHIPMENT_CREATED,
            "shipment",
            str(shipment.id),
            f"Created departure {reference}",
            metadata={
                "reference": reference,
                "departure_date": departure_date.isoformat(),
            },
        )

    db.session.commit()
    return shipment


def list_shipments(
    *,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Shipment], int]:
    query = Shipment.query
    if status:
        query = query.filter(Shipment.status == status)
    query = query.order_by(Shipment.departure_date.desc(), Shipment.created_at.desc())
    total = query.count()
    shipments = query.offset(offset).limit(limit).all()
    return shipments, total


def get_shipment(shipment_id: uuid.UUID) -> Shipment | None:
    return db.session.get(Shipment, shipment_id)


def _assert_open(shipment: Shipment) -> None:
    if shipment.status != "open":
        raise ValueError(f"Departure {shipment.reference} has already departed")


def _find_other_open_shipment(package: Package, current: Shipment) -> Shipment | None:
    if not package.shipment_id or package.shipment_id == current.id:
        return None
    other = db.session.get(Shipment, package.shipment_id)
    if other and other.status == "open" and other.id != current.id:
        return other
    return None


def add_package_to_shipment(
    shipment: Shipment,
    package: Package,
    *,
    actor: User | None = None,
) -> Package:
    _assert_open(shipment)

    if package.status != "received":
        raise ValueError(f"{package.tracking_number} is not in received status")

    other = _find_other_open_shipment(package, shipment)
    if other:
        raise ValueError(
            f"{package.tracking_number} is already on departure {other.reference}"
        )

    package.shipment_id = shipment.id
    package.updated_at = datetime.utcnow()

    if actor:
        log_entity_action(
            actor,
            ACTION_SHIPMENT_PACKAGE_ADDED,
            "shipment",
            str(shipment.id),
            f"Added {package.tracking_number} to {shipment.reference}",
            metadata={
                "reference": shipment.reference,
                "package_id": str(package.id),
                "tracking_number": package.tracking_number,
            },
        )

    db.session.commit()
    return package


def add_packages_to_shipment(
    shipment: Shipment,
    package_ids: list,
    *,
    actor: User | None = None,
) -> tuple[list[Package], list[dict]]:
    added: list[Package] = []
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

        try:
            _assert_open(shipment)
            if package.status != "received":
                raise ValueError(f"{package.tracking_number} is not in received status")
            other = _find_other_open_shipment(package, shipment)
            if other:
                raise ValueError(
                    f"{package.tracking_number} is already on departure {other.reference}"
                )
            package.shipment_id = shipment.id
            package.updated_at = datetime.utcnow()
            added.append(package)
        except ValueError as exc:
            failed.append(
                {
                    "id": str(package.id) if package else str(raw_id),
                    "tracking_number": package.tracking_number if package else None,
                    "error": str(exc),
                }
            )

    if added:
        if actor:
            for package in added:
                log_entity_action(
                    actor,
                    ACTION_SHIPMENT_PACKAGE_ADDED,
                    "shipment",
                    str(shipment.id),
                    f"Added {package.tracking_number} to {shipment.reference}",
                    metadata={
                        "reference": shipment.reference,
                        "package_id": str(package.id),
                        "tracking_number": package.tracking_number,
                    },
                )
        db.session.commit()

    return added, failed


def add_package_by_tracking(
    shipment: Shipment,
    tracking: str,
    *,
    actor: User | None = None,
) -> Package:
    tracking = tracking.strip()
    if not tracking:
        raise ValueError("Tracking number is required")

    package = Package.query.filter(
        func.lower(Package.tracking_number) == tracking.lower()
    ).first()
    if not package and not tracking.upper().startswith("PB-"):
        package = Package.query.filter(
            func.lower(Package.carrier_tracking) == tracking.lower()
        ).first()

    if not package:
        raise ValueError(f"Package {tracking} not found")

    return add_package_to_shipment(shipment, package, actor=actor)


def remove_package_from_shipment(
    shipment: Shipment,
    package: Package,
    *,
    actor: User | None = None,
) -> Package:
    _assert_open(shipment)

    if package.shipment_id != shipment.id:
        raise ValueError(f"{package.tracking_number} is not on this departure")

    package.shipment_id = None
    package.updated_at = datetime.utcnow()

    if actor:
        log_entity_action(
            actor,
            ACTION_SHIPMENT_PACKAGE_REMOVED,
            "shipment",
            str(shipment.id),
            f"Removed {package.tracking_number} from {shipment.reference}",
            metadata={
                "reference": shipment.reference,
                "package_id": str(package.id),
                "tracking_number": package.tracking_number,
            },
        )

    db.session.commit()
    return package


def depart_shipment(
    shipment: Shipment,
    *,
    actor: User | None = None,
    note: str | None = None,
) -> tuple[list[Package], list[dict]]:
    _assert_open(shipment)

    packages = list(shipment.packages)
    if not packages:
        raise ValueError("Add at least one package before departing")

    event_note = note.strip() if note else f"Departure {shipment.reference} — {shipment.departure_date.isoformat()}"
    updated: list[Package] = []
    failed: list[dict] = []

    for package in packages:
        if package.status != "received":
            failed.append(
                {
                    "id": str(package.id),
                    "tracking_number": package.tracking_number,
                    "error": f"Package is {package.status}, expected received",
                }
            )
            continue
        try:
            add_package_event(package, "in_transit", event_note)
            updated.append(package)
        except ValueError as exc:
            failed.append(
                {
                    "id": str(package.id),
                    "tracking_number": package.tracking_number,
                    "error": str(exc),
                }
            )

    if failed:
        db.session.rollback()
        raise ValueError(
            f"Could not depart: {len(failed)} package(s) failed. Fix issues and try again."
        )

    if not updated:
        raise ValueError("No packages could be marked in transit")

    now = datetime.utcnow()
    shipment.status = "departed"
    shipment.departed_at = now
    shipment.updated_at = now

    if actor:
        log_entity_action(
            actor,
            ACTION_SHIPMENT_DEPARTED,
            "shipment",
            str(shipment.id),
            f"Departed {shipment.reference} with {len(updated)} package(s)",
            metadata={
                "reference": shipment.reference,
                "departure_date": shipment.departure_date.isoformat(),
                "package_ids": [str(p.id) for p in updated],
                "failed_count": len(failed),
            },
        )
        for package in updated:
            log_package_action(
                actor,
                ACTION_PACKAGE_STATUS_UPDATED,
                str(package.id),
                f"{package.tracking_number}: received → in transit ({shipment.reference})",
                metadata={
                    "tracking_number": package.tracking_number,
                    "from_status": "received",
                    "to_status": "in_transit",
                    "shipment_id": str(shipment.id),
                    "shipment_reference": shipment.reference,
                },
            )

    db.session.commit()
    return updated, failed


def count_open_shipments() -> int:
    return Shipment.query.filter_by(status="open").count()


def batch_depart_packages(
    package_ids: list,
    *,
    shipment_id: uuid.UUID | None = None,
    reference: str | None = None,
    departure_date: date | None = None,
    note: str | None = None,
    actor: User | None = None,
) -> tuple[Shipment, list[Package]]:
    """Create or use an open departure, assign packages, and mark them in transit."""
    if not package_ids:
        raise ValueError("package_ids must be a non-empty array")
    if len(package_ids) > 500:
        raise ValueError("Cannot depart more than 500 packages at once")

    if shipment_id:
        shipment = get_shipment(shipment_id)
        if not shipment:
            raise ValueError("Departure not found")
        _assert_open(shipment)
    else:
        reference = (reference or "").strip()
        if not reference:
            raise ValueError("Departure reference is required")
        if not departure_date:
            raise ValueError("departure_date is required")
        shipment = Shipment(
            reference=reference,
            departure_date=departure_date,
            note=note.strip() if note else None,
            status="open",
            created_by_id=actor.id if actor else None,
        )
        db.session.add(shipment)
        db.session.flush()
        if actor:
            log_entity_action(
                actor,
                ACTION_SHIPMENT_CREATED,
                "shipment",
                str(shipment.id),
                f"Created departure {reference}",
                metadata={
                    "reference": reference,
                    "departure_date": departure_date.isoformat(),
                    "batch_depart": True,
                },
            )

    packages: list[Package] = []
    for raw_id in package_ids:
        try:
            pid = uuid.UUID(str(raw_id))
        except (TypeError, ValueError):
            db.session.rollback()
            raise ValueError(f"Invalid package ID: {raw_id}")

        package = db.session.get(Package, pid)
        if not package:
            db.session.rollback()
            raise ValueError(f"Package not found: {raw_id}")

        if package.status != "received":
            db.session.rollback()
            raise ValueError(f"{package.tracking_number} is not in received status")

        other = _find_other_open_shipment(package, shipment)
        if other:
            db.session.rollback()
            raise ValueError(
                f"{package.tracking_number} is already on departure {other.reference}"
            )

        package.shipment_id = shipment.id
        package.updated_at = datetime.utcnow()
        packages.append(package)

    if not packages:
        db.session.rollback()
        raise ValueError("No packages to depart")

    event_note = (
        note.strip()
        if note
        else f"Departure {shipment.reference} — {shipment.departure_date.isoformat()}"
    )
    updated: list[Package] = []
    for package in packages:
        add_package_event(package, "in_transit", event_note)
        updated.append(package)

    now = datetime.utcnow()
    shipment.status = "departed"
    shipment.departed_at = now
    shipment.updated_at = now

    if actor:
        for package in packages:
            log_entity_action(
                actor,
                ACTION_SHIPMENT_PACKAGE_ADDED,
                "shipment",
                str(shipment.id),
                f"Added {package.tracking_number} to {shipment.reference}",
                metadata={
                    "reference": shipment.reference,
                    "package_id": str(package.id),
                    "tracking_number": package.tracking_number,
                    "batch_depart": True,
                },
            )
        log_entity_action(
            actor,
            ACTION_SHIPMENT_DEPARTED,
            "shipment",
            str(shipment.id),
            f"Departed {shipment.reference} with {len(updated)} package(s)",
            metadata={
                "reference": shipment.reference,
                "departure_date": shipment.departure_date.isoformat(),
                "package_ids": [str(p.id) for p in updated],
                "batch_depart": True,
            },
        )
        for package in updated:
            log_package_action(
                actor,
                ACTION_PACKAGE_STATUS_UPDATED,
                str(package.id),
                f"{package.tracking_number}: received → in transit ({shipment.reference})",
                metadata={
                    "tracking_number": package.tracking_number,
                    "from_status": "received",
                    "to_status": "in_transit",
                    "shipment_id": str(shipment.id),
                    "shipment_reference": shipment.reference,
                    "batch_depart": True,
                },
            )

    db.session.commit()
    return shipment, updated

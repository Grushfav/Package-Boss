import re
from datetime import datetime

from flask import current_app

from app.constants import PACKAGE_STATUSES, STATUS_LABELS
from app.extensions import db, redis_client
from app.models.package import Package, PackageEvent, PackagePhoto
from app.models.user import User
from app.services.shipping_service import calculate_shipping_cost


def generate_tracking_number() -> str:
    year = datetime.utcnow().year
    key = f"boss:tracking_seq:{year}"
    start = 1

    if redis_client is not None:
        try:
            if not redis_client.exists(key):
                redis_client.set(key, start - 1)
            seq = redis_client.incr(key)
            return f"PB-{year}-{seq:06d}"
        except Exception:
            current_app.logger.warning("Redis unavailable for tracking number, using DB fallback")

    packages = Package.query.filter(Package.tracking_number.like(f"PB-{year}-%")).all()
    max_seq = start - 1
    for pkg in packages:
        match = re.match(rf"PB-{year}-(\d+)$", pkg.tracking_number)
        if match:
            max_seq = max(max_seq, int(match.group(1)))
    return f"PB-{year}-{max_seq + 1:06d}"


def add_package_event(package: Package, status: str, note: str | None = None) -> None:
    event = PackageEvent(package_id=package.id, status=status, note=note)
    db.session.add(event)
    package.status = status
    package.updated_at = datetime.utcnow()


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
        shipping_cost_usd=quote["cost_usd"],
        rate_tier_label=quote["tier_label"],
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
        if key and key.startswith(f"packages/{customer.shipping_id}/"):
            db.session.add(PackagePhoto(package_id=package.id, r2_object_key=key))

    db.session.commit()
    return package


def update_package_status(package: Package, status: str, note: str | None = None) -> Package:
    if status not in PACKAGE_STATUSES:
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

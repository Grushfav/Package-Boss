"""Customer email notifications for package status changes (single or batched)."""

from __future__ import annotations

from collections import defaultdict

from app.constants import UNIDENTIFIED_HOLDER_SHIPPING_ID
from app.extensions import db
from app.models.package import Package
from app.models.user import User


def notify_customers_of_status_batch(
    entries: list[tuple[Package, str | None]],
    status: str,
) -> None:
    """Send one email per customer (per shared note) when multiple packages change together."""
    seen_package_ids: set = set()
    groups: dict[tuple, list[Package]] = defaultdict(list)
    for package, note in entries:
        if package.id in seen_package_ids:
            continue
        if package.status != status or not package.customer_id:
            continue
        seen_package_ids.add(package.id)
        groups[(package.customer_id, note)].append(package)

    for (customer_id, note), packages in groups.items():
        customer = packages[0].customer or db.session.get(User, customer_id)
        if not customer or customer.shipping_id == UNIDENTIFIED_HOLDER_SHIPPING_ID:
            continue
        if len(packages) == 1:
            from app.services.package_service import _notify_package_status_email

            _notify_package_status_email(packages[0], status, note)
        else:
            _notify_package_status_batch_email(customer, packages, status, note)


def _notify_package_status_batch_email(
    customer: User,
    packages: list[Package],
    status: str,
    note: str | None,
) -> None:
    from flask import current_app

    from app.services.email_service import EmailServiceError, send_package_status_batch_email

    try:
        send_package_status_batch_email(
            customer.email,
            customer.first_name,
            packages,
            status,
            note=note,
        )
    except EmailServiceError as exc:
        current_app.logger.error(
            "Batch status email failed for %d packages → %s: %s",
            len(packages),
            customer.email,
            exc,
        )
    except Exception as exc:
        current_app.logger.warning(
            "Failed to send batch status email (%d packages): %s",
            len(packages),
            exc,
        )

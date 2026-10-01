from app.extensions import db
from app.models.package import Package
from app.services.billing_calculations import publish_ready_for_pickup_bill
from app.services.billing_service import request_package_invoice
from app.services.package_service import add_package_event


def release_package_from_customs(
    package: Package,
    *,
    estimated_freight_jmd: float | None = None,
    duties_jmd: float | None = None,
    handling_jmd: float | None = None,
    other_fees_jmd: float | None = None,
    note: str | None = None,
    skip_status_email: bool = False,
) -> Package:
    if package.status != "customs":
        raise ValueError(f"{package.tracking_number} is not in customs")

    publish_ready_for_pickup_bill(
        package,
        estimated_freight_jmd=estimated_freight_jmd,
        duties_jmd=duties_jmd,
        handling_jmd=handling_jmd,
        other_fees_jmd=other_fees_jmd,
    )
    add_package_event(
        package,
        "ready_for_pickup",
        note or "Released from customs — bill published",
        skip_status_email=skip_status_email,
    )
    return package


def release_packages_from_customs(
    items: list[dict],
    *,
    note: str | None = None,
) -> tuple[list[Package], list[dict]]:
    released: list[Package] = []
    notify_entries: list[tuple[Package, str | None]] = []
    failed: list[dict] = []

    for item in items:
        raw_id = item.get("package_id")
        package = db.session.get(Package, raw_id)
        if not package:
            failed.append({"id": str(raw_id), "error": "Package not found"})
            continue
        item_note = item.get("note") or note
        try:
            release_package_from_customs(
                package,
                estimated_freight_jmd=item.get("estimated_freight_jmd"),
                duties_jmd=item.get("duties_jmd"),
                handling_jmd=item.get("handling_jmd"),
                other_fees_jmd=item.get("other_fees_jmd"),
                note=item_note,
                skip_status_email=True,
            )
            released.append(package)
            notify_entries.append(
                (package, item_note or "Released from customs — bill published")
            )
        except ValueError as exc:
            failed.append(
                {
                    "id": str(package.id),
                    "tracking_number": package.tracking_number,
                    "error": str(exc),
                }
            )

    if released:
        db.session.commit()
        from app.services.package_status_notification_service import notify_customers_of_status_batch

        notify_customers_of_status_batch(notify_entries, "ready_for_pickup")
    return released, failed


def bulk_request_customs_invoices(
    package_ids: list,
    channel: str,
    note: str | None = None,
) -> tuple[list[dict], list[dict]]:
    sent: list[dict] = []
    failed: list[dict] = []

    for raw_id in package_ids:
        package = db.session.get(Package, raw_id)
        if not package:
            failed.append({"id": str(raw_id), "error": "Package not found"})
            continue
        if package.status != "customs":
            failed.append(
                {
                    "id": str(package.id),
                    "tracking_number": package.tracking_number,
                    "error": "Package is not in customs",
                }
            )
            continue
        try:
            result = request_package_invoice(package, channel, note)
            sent.append(
                {
                    "package_id": str(package.id),
                    "tracking_number": package.tracking_number,
                    **result,
                }
            )
        except ValueError as exc:
            failed.append(
                {
                    "id": str(package.id),
                    "tracking_number": package.tracking_number,
                    "error": str(exc),
                }
            )

    return sent, failed

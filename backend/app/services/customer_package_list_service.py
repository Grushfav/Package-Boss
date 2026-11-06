from sqlalchemy.orm import selectinload

from app.models.package import Package
from app.models.user import User
from app.services.delivery_request_service import pending_delivery_summaries_for_packages

PACKAGE_LIST_SCOPES = ("active", "completed", "payable")
PACKAGE_LIST_DEFAULT_LIMITS = {"active": 10, "completed": 5, "payable": 50}
PACKAGE_LIST_MAX_LIMIT = 50


def _scoped_packages(user: User, scope: str):
    query = Package.query.filter(Package.customer_id == user.id)
    if scope == "completed":
        return query.filter(Package.status == "delivered")
    if scope == "payable":
        return query.filter(
            Package.status == "ready_for_pickup",
            Package.billing_status == "ready",
            Package.total_due_jmd.isnot(None),
        )
    if scope == "active":
        return query.filter(Package.status != "delivered")
    raise ValueError("Invalid scope")


def list_customer_package_page(
    user: User,
    scope: str,
    limit: int | None = None,
    offset: int | None = None,
) -> dict:
    """One page of the customer's packages. Never returns the full history."""
    if scope not in PACKAGE_LIST_SCOPES:
        raise ValueError("Invalid scope")

    default_limit = PACKAGE_LIST_DEFAULT_LIMITS[scope]
    page_limit = default_limit if limit is None else max(1, min(int(limit), PACKAGE_LIST_MAX_LIMIT))
    page_offset = 0 if offset is None else max(0, int(offset))

    total = _scoped_packages(user, scope).count()
    rows = (
        _scoped_packages(user, scope)
        .options(
            selectinload(Package.delivery_address),
            selectinload(Package.receive_batch),
            selectinload(Package.shipment),
        )
        .order_by(Package.created_at.desc())
        .offset(page_offset)
        .limit(page_limit)
        .all()
    )
    summaries = pending_delivery_summaries_for_packages([package.id for package in rows])
    ready_count = Package.query.filter_by(
        customer_id=user.id,
        status="ready_for_pickup",
    ).count()

    return {
        "packages": [
            {**package.to_dict(), "pending_delivery_request": summaries.get(str(package.id))}
            for package in rows
        ],
        "total": total,
        "limit": page_limit,
        "offset": page_offset,
        "ready_for_pickup_count": ready_count,
    }

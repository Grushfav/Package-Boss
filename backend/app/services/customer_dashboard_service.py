from app.constants import MULTI_PACKAGE_HANDLING_FEE_JMD
from app.extensions import db
from app.models.delivery_address import DeliveryAddress
from app.models.package import Package
from app.models.user import User
from app.services.warehouse_service import build_shipping_address
from sqlalchemy import func


def get_customer_dashboard(user: User) -> dict:
    """Counts and addresses for the customer home screen. Does not load package rows."""
    status_rows = (
        db.session.query(Package.status, func.count(Package.id))
        .filter(Package.customer_id == user.id)
        .group_by(Package.status)
        .all()
    )
    counts = {status: count for status, count in status_rows}

    payable_count, due_sum = (
        db.session.query(
            func.count(Package.id),
            func.coalesce(func.sum(Package.total_due_jmd), 0),
        )
        .filter(
            Package.customer_id == user.id,
            Package.status == "ready_for_pickup",
            Package.billing_status == "ready",
            Package.total_due_jmd.isnot(None),
        )
        .one()
    )
    handling_fee = MULTI_PACKAGE_HANDLING_FEE_JMD if payable_count > 1 else 0
    invoice_action_count = Package.query.filter(
        Package.customer_id == user.id,
        Package.invoice_status == "requested",
        Package.status.notin_(("received", "ready_for_pickup", "delivered")),
    ).count()
    default_address = (
        DeliveryAddress.query.filter_by(customer_id=user.id, is_default=True)
        .order_by(DeliveryAddress.created_at.asc())
        .first()
    )

    return {
        "stats": {
            "received_fort_lauderdale": counts.get("received", 0),
            "in_transit": counts.get("in_transit", 0),
            "customs": counts.get("customs", 0),
            "ready_pickup_delivery": counts.get("ready_for_pickup", 0),
            "payable_package_count": payable_count,
            "handling_fee_jmd": float(handling_fee),
            "total_due_jmd": float(due_sum or 0) + float(handling_fee),
            "invoice_action_count": invoice_action_count,
        },
        "default_delivery_address": default_address.to_dict() if default_address else None,
        "shipping_address": build_shipping_address(user.shipping_id),
    }

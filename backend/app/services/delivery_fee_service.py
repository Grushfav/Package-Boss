"""Parish-based home delivery fees (Kingston metro vs Portmore)."""

from decimal import Decimal

from app.constants import DELIVERY_FEE_KINGSTON_JMD, DELIVERY_FEE_PORTMORE_JMD
from app.extensions import db
from app.models.delivery_address import DeliveryAddress
from app.models.package import Package
from app.models.user import User

__all__ = [
    "delivery_fee_for_parish",
    "delivery_fee_label_for_parish",
    "delivery_fee_area_for_parish",
    "infer_optional_delivery_fee_jmd",
]


def _normalize_parish(parish: str) -> str:
    return (parish or "").strip().lower()


def delivery_fee_for_parish(parish: str) -> Decimal:
    """St. Catherine (Portmore) is $1,000 JMD; Kingston & St. Andrew are $800 JMD."""
    if _normalize_parish(parish) == "st. catherine":
        return DELIVERY_FEE_PORTMORE_JMD
    return DELIVERY_FEE_KINGSTON_JMD


def delivery_fee_area_for_parish(parish: str) -> str:
    if _normalize_parish(parish) == "st. catherine":
        return "Portmore"
    return "Kingston & St. Andrew"


def delivery_fee_label_for_parish(parish: str) -> str:
    fee = delivery_fee_for_parish(parish)
    area = delivery_fee_area_for_parish(parish)
    amount = int(fee) if fee == int(fee) else float(fee)
    return f"Delivery fee ({area}) — J${amount:,}"


def infer_optional_delivery_fee_jmd(customer: User, packages: list[Package]) -> Decimal:
    """Best-effort fee when checkout adds delivery without an open delivery request."""
    address_ids = {package.delivery_address_id for package in packages if package.delivery_address_id}
    if len(address_ids) == 1:
        address = db.session.get(DeliveryAddress, next(iter(address_ids)))
        if address and address.customer_id == customer.id:
            return delivery_fee_for_parish(address.parish)
    return DELIVERY_FEE_KINGSTON_JMD

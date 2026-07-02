from decimal import Decimal

from flask import current_app

from app.constants import DELIVERY_PARISHES, JAMAICA_PARISHES, MAX_DELIVERY_ADDRESSES
from app.extensions import db
from app.models.delivery_address import DeliveryAddress
from app.models.user import User
from app.services.auth_service import normalize_phone


def _validate_parish(parish: str) -> str:
    parish = parish.strip()
    if parish not in JAMAICA_PARISHES:
        raise ValueError("Invalid parish")
    return parish


def list_delivery_addresses(customer: User) -> list[DeliveryAddress]:
    return (
        DeliveryAddress.query.filter_by(customer_id=customer.id)
        .order_by(DeliveryAddress.is_default.desc(), DeliveryAddress.sort_order, DeliveryAddress.created_at)
        .all()
    )


def count_delivery_addresses(customer: User) -> int:
    return DeliveryAddress.query.filter_by(customer_id=customer.id).count()


def get_delivery_address(customer: User, address_id) -> DeliveryAddress | None:
    return DeliveryAddress.query.filter_by(id=address_id, customer_id=customer.id).first()


def create_delivery_address(customer: User, data: dict) -> DeliveryAddress:
    if count_delivery_addresses(customer) >= MAX_DELIVERY_ADDRESSES:
        raise ValueError(f"You can save up to {MAX_DELIVERY_ADDRESSES} delivery addresses")

    label = (data.get("label") or "").strip()
    line1 = (data.get("line1") or "").strip()
    parish = _validate_parish(data.get("parish") or "")

    if not label:
        raise ValueError("label is required")
    if not line1:
        raise ValueError("line1 is required")
    try:
        contact_number = normalize_phone(data.get("contact_number") or "")
    except ValueError as exc:
        raise ValueError(str(exc)) from exc

    is_default = bool(data.get("is_default"))
    if is_default:
        _clear_default(customer)

    address = DeliveryAddress(
        customer_id=customer.id,
        label=label,
        recipient_name=(data.get("recipient_name") or "").strip() or customer.full_name,
        line1=line1,
        line2=(data.get("line2") or "").strip() or None,
        community=(data.get("community") or "").strip() or None,
        parish=parish,
        contact_number=contact_number,
        delivery_notes=(data.get("delivery_notes") or "").strip() or None,
        is_default=is_default or count_delivery_addresses(customer) == 0,
        sort_order=count_delivery_addresses(customer),
    )
    db.session.add(address)
    db.session.commit()
    return address


def update_delivery_address(address: DeliveryAddress, data: dict) -> DeliveryAddress:
    if "label" in data:
        label = (data.get("label") or "").strip()
        if not label:
            raise ValueError("label cannot be empty")
        address.label = label

    if "recipient_name" in data:
        address.recipient_name = (data.get("recipient_name") or "").strip() or None

    if "line1" in data:
        line1 = (data.get("line1") or "").strip()
        if not line1:
            raise ValueError("line1 cannot be empty")
        address.line1 = line1

    if "line2" in data:
        address.line2 = (data.get("line2") or "").strip() or None

    if "community" in data:
        address.community = (data.get("community") or "").strip() or None

    if "parish" in data:
        address.parish = _validate_parish(data.get("parish") or "")

    if "contact_number" in data:
        try:
            address.contact_number = normalize_phone(data.get("contact_number") or "")
        except ValueError as exc:
            raise ValueError(str(exc)) from exc

    if "delivery_notes" in data:
        address.delivery_notes = (data.get("delivery_notes") or "").strip() or None

    if data.get("is_default"):
        _clear_default(address.customer)
        address.is_default = True

    db.session.commit()
    return address


def delete_delivery_address(address: DeliveryAddress) -> None:
    was_default = address.is_default
    customer = address.customer
    db.session.delete(address)
    db.session.flush()

    if was_default:
        replacement = (
            DeliveryAddress.query.filter_by(customer_id=customer.id)
            .order_by(DeliveryAddress.sort_order, DeliveryAddress.created_at)
            .first()
        )
        if replacement:
            replacement.is_default = True

    db.session.commit()


def set_default_delivery_address(address: DeliveryAddress) -> DeliveryAddress:
    _clear_default(address.customer)
    address.is_default = True
    db.session.commit()
    return address


def _clear_default(customer: User) -> None:
    DeliveryAddress.query.filter_by(customer_id=customer.id, is_default=True).update(
        {"is_default": False}
    )


def validate_delivery_parish_for_service(parish: str) -> None:
    if parish not in DELIVERY_PARISHES:
        raise ValueError(
            "Delivery is available in Kingston, St. Andrew, and St. Catherine (Portmore) only"
        )


def build_invoice_upload_url(package_id: str) -> str:
    base = current_app.config.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return f"{base}/packages/{package_id}/upload-invoice"

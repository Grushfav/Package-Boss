from app.constants import MAX_AUTHORIZED_PICKUPS, PICKUP_ID_TYPES
from app.extensions import db
from app.models.authorized_pickup import AuthorizedPickupPerson
from app.models.user import User
from app.services.auth_service import normalize_phone


def list_authorized_pickups(customer: User) -> list[AuthorizedPickupPerson]:
    return (
        AuthorizedPickupPerson.query.filter_by(customer_id=customer.id)
        .order_by(AuthorizedPickupPerson.sort_order, AuthorizedPickupPerson.created_at)
        .all()
    )


def count_authorized_pickups(customer: User) -> int:
    return AuthorizedPickupPerson.query.filter_by(customer_id=customer.id).count()


def get_authorized_pickup(customer: User, pickup_id) -> AuthorizedPickupPerson | None:
    return AuthorizedPickupPerson.query.filter_by(
        id=pickup_id, customer_id=customer.id
    ).first()


def _validate_id_type(value: str) -> str:
    value = (value or "").strip().lower()
    if value not in PICKUP_ID_TYPES:
        raise ValueError("Invalid ID type")
    return value


def create_authorized_pickup(customer: User, data: dict) -> AuthorizedPickupPerson:
    if count_authorized_pickups(customer) >= MAX_AUTHORIZED_PICKUPS:
        raise ValueError(f"You can save up to {MAX_AUTHORIZED_PICKUPS} authorized pickup persons")

    full_name = (data.get("full_name") or "").strip()
    if not full_name:
        raise ValueError("Full name is required")

    pickup = AuthorizedPickupPerson(
        customer_id=customer.id,
        full_name=full_name,
        relationship="other",
        contact_number=normalize_phone(data.get("contact_number") or ""),
        id_type=_validate_id_type(data.get("id_type")),
        id_last_four=None,
        notes=(data.get("notes") or "").strip() or None,
        sort_order=count_authorized_pickups(customer),
    )
    db.session.add(pickup)
    db.session.commit()
    return pickup


def update_authorized_pickup(pickup: AuthorizedPickupPerson, data: dict) -> AuthorizedPickupPerson:
    if "full_name" in data:
        full_name = (data.get("full_name") or "").strip()
        if not full_name:
            raise ValueError("Full name cannot be empty")
        pickup.full_name = full_name

    if "contact_number" in data:
        pickup.contact_number = normalize_phone(data.get("contact_number") or "")

    if "id_type" in data:
        pickup.id_type = _validate_id_type(data.get("id_type"))

    if "notes" in data:
        pickup.notes = (data.get("notes") or "").strip() or None

    db.session.commit()
    return pickup


def delete_authorized_pickup(pickup: AuthorizedPickupPerson) -> None:
    db.session.delete(pickup)
    db.session.commit()

from app.constants import JAMAICA_PARISHES
from app.extensions import db
from app.models.user import User
from app.services.auth_service import hash_password, normalize_phone, validate_password, verify_password


def update_profile(user: User, data: dict) -> User:
    if "first_name" in data:
        first_name = (data.get("first_name") or "").strip()
        if not first_name:
            raise ValueError("First name cannot be empty")
        user.first_name = first_name

    if "last_name" in data:
        last_name = (data.get("last_name") or "").strip()
        if not last_name:
            raise ValueError("Last name cannot be empty")
        user.last_name = last_name

    if "contact_number" in data:
        user.contact_number = normalize_phone(data["contact_number"])

    if "parish" in data:
        parish = (data.get("parish") or "").strip()
        if parish not in JAMAICA_PARISHES:
            raise ValueError("Invalid parish")
        user.parish = parish

    if "whatsapp_opt_in" in data:
        user.whatsapp_opt_in = bool(data["whatsapp_opt_in"])

    db.session.commit()
    return user


def change_password(user: User, current_password: str, new_password: str) -> None:
    if not current_password or not new_password:
        raise ValueError("Current password and new password are required")
    if not verify_password(user.password_hash, current_password):
        raise ValueError("Current password is incorrect")
    validate_password(new_password)
    user.password_hash = hash_password(new_password)
    db.session.commit()

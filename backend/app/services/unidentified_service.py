from app.constants import UNIDENTIFIED_HOLDER_EMAIL, UNIDENTIFIED_HOLDER_SHIPPING_ID
from app.extensions import db
from app.models.user import User
from app.services.auth_service import hash_password
from app.services.trn_service import encrypt_trn, hash_trn


def is_unidentified_holder(user: User | None) -> bool:
    return bool(user and user.shipping_id == UNIDENTIFIED_HOLDER_SHIPPING_ID)


def ensure_unidentified_holder() -> User:
    user = User.query.filter_by(shipping_id=UNIDENTIFIED_HOLDER_SHIPPING_ID).first()
    if user:
        return user

    user = User(
        email=UNIDENTIFIED_HOLDER_EMAIL,
        password_hash=hash_password("not-a-login-account"),
        first_name="Unidentified",
        last_name="Packages",
        contact_number="+18760000000",
        parish="Kingston",
        trn_encrypted=encrypt_trn("000000000"),
        trn_hash=hash_trn("000000000"),
        shipping_id=UNIDENTIFIED_HOLDER_SHIPPING_ID,
        role="customer",
    )
    db.session.add(user)
    db.session.commit()
    return user


def customer_query():
    return User.query.filter(
        User.role == "customer",
        User.shipping_id != UNIDENTIFIED_HOLDER_SHIPPING_ID,
    )

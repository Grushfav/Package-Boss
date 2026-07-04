from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models.user import User


def access_token_for_user(user: User) -> str:
    return create_access_token(
        identity=str(user.id),
        additional_claims={"tv": user.token_version or 0},
    )


def bump_token_version(user: User, *, commit: bool = True) -> None:
    user.token_version = (user.token_version or 0) + 1
    if commit:
        db.session.commit()


def token_version_matches(user: User, claim_version: object) -> bool:
    if claim_version is None:
        claim_version = 0
    try:
        return int(claim_version) == int(user.token_version or 0)
    except (TypeError, ValueError):
        return False

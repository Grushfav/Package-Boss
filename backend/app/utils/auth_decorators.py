import uuid

from functools import wraps

from typing import Any



from flask import jsonify

from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required



from app.constants import ADMIN_ROLES, WAREHOUSE_ROLES

from app.models.user import User

from app.services.token_service import token_version_matches



AuthErrorResponse = tuple[Any, int] | None





def _load_user_from_jwt() -> User | None:

    user_id = get_jwt_identity()

    try:

        uid = uuid.UUID(user_id)

    except (TypeError, ValueError):

        return None

    return User.query.get(uid)





def resolve_jwt_user(*, require_active: bool = True) -> tuple[User | None, AuthErrorResponse]:

    user = _load_user_from_jwt()

    if not user:

        return None, (jsonify({"error": "User not found"}), 404)



    claims = get_jwt()

    if not token_version_matches(user, claims.get("tv")):

        return None, (jsonify({"error": "Token has been revoked"}), 401)



    if require_active and not user.is_active:

        return None, (jsonify({"error": "Account deactivated"}), 403)

    return user, None





def get_user_from_jwt(*, require_active: bool = True) -> User | None:

    user, auth_err = resolve_jwt_user(require_active=require_active)

    if auth_err:

        return None

    return user





def warehouse_required():

    def decorator(fn):

        @wraps(fn)

        @jwt_required()

        def wrapper(*args, **kwargs):

            user, auth_err = resolve_jwt_user()

            if auth_err:

                return auth_err

            if user.role not in WAREHOUSE_ROLES:

                return jsonify({"error": "Clerk access required"}), 403

            return fn(*args, **kwargs)



        return wrapper



    return decorator





def admin_required():

    def decorator(fn):

        @wraps(fn)

        @jwt_required()

        def wrapper(*args, **kwargs):

            user, auth_err = resolve_jwt_user()

            if auth_err:

                return auth_err

            if user.role not in ADMIN_ROLES:

                return jsonify({"error": "Admin access required"}), 403

            return fn(*args, **kwargs)



        return wrapper



    return decorator





def permission_required(*required_perms: str):

    def decorator(fn):

        @wraps(fn)

        @jwt_required()

        def wrapper(*args, **kwargs):

            user, auth_err = resolve_jwt_user()

            if auth_err:

                return auth_err

            if user.role not in WAREHOUSE_ROLES:

                return jsonify({"error": "Clerk access required"}), 403

            if user.role == "admin":

                return fn(*args, **kwargs)

            from app.services.clerk_permission_service import clerk_has_any_permission



            if not clerk_has_any_permission(user, required_perms):

                return jsonify({"error": "Permission denied"}), 403

            return fn(*args, **kwargs)



        return wrapper



    return decorator





# Backwards-compatible alias

def staff_required():

    return warehouse_required()



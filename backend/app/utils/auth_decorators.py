import uuid
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.constants import ADMIN_ROLES, WAREHOUSE_ROLES
from app.models.user import User


def get_user_from_jwt() -> User | None:
    user_id = get_jwt_identity()
    try:
        uid = uuid.UUID(user_id)
    except (TypeError, ValueError):
        return None
    return User.query.get(uid)


def warehouse_required():
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = get_user_from_jwt()
            if not user or user.role not in WAREHOUSE_ROLES:
                return jsonify({"error": "Clerk access required"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def admin_required():
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = get_user_from_jwt()
            if not user or user.role not in ADMIN_ROLES:
                return jsonify({"error": "Admin access required"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


# Backwards-compatible alias
def staff_required():
    return warehouse_required()

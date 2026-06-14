import uuid

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.user import User
from app.services.warehouse_service import build_shipping_address

me_bp = Blueprint("me", __name__)


def _get_current_user():
    user_id = get_jwt_identity()
    try:
        uid = uuid.UUID(user_id)
    except (TypeError, ValueError):
        return None
    return User.query.get(uid)


@me_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"user": user.to_dict(include_trn_masked=True)})


@me_bp.route("/me/shipping-address", methods=["GET"])
@jwt_required()
def get_shipping_address():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(
        {
            "shipping_id": user.shipping_id,
            "shipping_address": build_shipping_address(user.shipping_id),
        }
    )

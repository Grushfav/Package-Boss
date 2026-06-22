import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.constants import MAX_DELIVERY_ADDRESSES
from app.models.user import User
from app.services.delivery_address_service import (
    create_delivery_address,
    delete_delivery_address,
    get_delivery_address,
    list_delivery_addresses,
    set_default_delivery_address,
    update_delivery_address,
)
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


@me_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_me():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    if "whatsapp_opt_in" in data:
        user.whatsapp_opt_in = bool(data["whatsapp_opt_in"])

    from app.extensions import db

    db.session.commit()
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


@me_bp.route("/me/delivery-addresses", methods=["GET"])
@jwt_required()
def get_delivery_addresses():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    addresses = list_delivery_addresses(user)
    return jsonify(
        {
            "addresses": [a.to_dict() for a in addresses],
            "max_addresses": MAX_DELIVERY_ADDRESSES,
        }
    )


@me_bp.route("/me/delivery-addresses", methods=["POST"])
@jwt_required()
def create_my_delivery_address():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        address = create_delivery_address(user, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"address": address.to_dict()}), 201


@me_bp.route("/me/delivery-addresses/<address_id>", methods=["PATCH"])
@jwt_required()
def update_my_delivery_address(address_id: str):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        aid = uuid.UUID(address_id)
    except ValueError:
        return jsonify({"error": "Invalid address ID"}), 400

    address = get_delivery_address(user, aid)
    if not address:
        return jsonify({"error": "Address not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        address = update_delivery_address(address, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"address": address.to_dict()})


@me_bp.route("/me/delivery-addresses/<address_id>", methods=["DELETE"])
@jwt_required()
def delete_my_delivery_address(address_id: str):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        aid = uuid.UUID(address_id)
    except ValueError:
        return jsonify({"error": "Invalid address ID"}), 400

    address = get_delivery_address(user, aid)
    if not address:
        return jsonify({"error": "Address not found"}), 404

    delete_delivery_address(address)
    return jsonify({"message": "Address deleted"})


@me_bp.route("/me/delivery-addresses/<address_id>/set-default", methods=["POST"])
@jwt_required()
def set_my_default_delivery_address(address_id: str):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        aid = uuid.UUID(address_id)
    except ValueError:
        return jsonify({"error": "Invalid address ID"}), 400

    address = get_delivery_address(user, aid)
    if not address:
        return jsonify({"error": "Address not found"}), 404

    address = set_default_delivery_address(address)
    return jsonify({"address": address.to_dict()})

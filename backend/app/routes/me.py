import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.constants import (
    MAX_AUTHORIZED_PICKUPS,
    MAX_DELIVERY_ADDRESSES,
    PICKUP_ID_TYPE_LABELS,
    PICKUP_ID_TYPES,
)
from app.models.user import User
from app.services.authorized_pickup_service import (
    create_authorized_pickup,
    delete_authorized_pickup,
    get_authorized_pickup,
    list_authorized_pickups,
    update_authorized_pickup,
)
from app.services.delivery_address_service import (
    create_delivery_address,
    delete_delivery_address,
    get_delivery_address,
    list_delivery_addresses,
    set_default_delivery_address,
    update_delivery_address,
)
from app.services.profile_service import change_password, update_profile
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

    return jsonify(
        {
            "user": user.to_dict(
                include_trn=user.role == "customer",
                include_clerk_fields=user.role in ("clerk", "admin"),
            )
        }
    )


@me_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_me():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        user = update_profile(user, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"user": user.to_dict(include_trn=True)})


@me_bp.route("/me/change-password", methods=["POST"])
@jwt_required()
def change_my_password():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        change_password(
            user,
            data.get("current_password") or "",
            data.get("new_password") or "",
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"message": "Password updated"})


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


@me_bp.route("/me/authorized-pickups", methods=["GET"])
@jwt_required()
def get_authorized_pickups():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    pickups = list_authorized_pickups(user)
    return jsonify(
        {
            "pickups": [p.to_dict() for p in pickups],
            "max_pickups": MAX_AUTHORIZED_PICKUPS,
            "id_types": [
                {"value": t, "label": PICKUP_ID_TYPE_LABELS[t]} for t in PICKUP_ID_TYPES
            ],
        }
    )


@me_bp.route("/me/authorized-pickups", methods=["POST"])
@jwt_required()
def create_my_authorized_pickup():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        pickup = create_authorized_pickup(user, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"pickup": pickup.to_dict()}), 201


@me_bp.route("/me/authorized-pickups/<pickup_id>", methods=["PATCH"])
@jwt_required()
def update_my_authorized_pickup(pickup_id: str):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        pid = uuid.UUID(pickup_id)
    except ValueError:
        return jsonify({"error": "Invalid pickup ID"}), 400

    pickup = get_authorized_pickup(user, pid)
    if not pickup:
        return jsonify({"error": "Authorized pickup person not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        pickup = update_authorized_pickup(pickup, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"pickup": pickup.to_dict()})


@me_bp.route("/me/authorized-pickups/<pickup_id>", methods=["DELETE"])
@jwt_required()
def delete_my_authorized_pickup(pickup_id: str):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        pid = uuid.UUID(pickup_id)
    except ValueError:
        return jsonify({"error": "Invalid pickup ID"}), 400

    pickup = get_authorized_pickup(user, pid)
    if not pickup:
        return jsonify({"error": "Authorized pickup person not found"}), 404

    delete_authorized_pickup(pickup)
    return jsonify({"message": "Authorized pickup person removed"})

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.delivery_request_service import (
    cancel_delivery_request,
    create_delivery_request,
    get_delivery_request,
    list_customer_delivery_requests,
)
from app.utils.auth_decorators import resolve_jwt_user

delivery_requests_bp = Blueprint("delivery_requests", __name__)


@delivery_requests_bp.route("/me/delivery-requests", methods=["GET"])
@jwt_required()
def list_my_delivery_requests():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    requests = list_customer_delivery_requests(user)
    return jsonify({"delivery_requests": [item.to_dict(include_packages=True) for item in requests]})


@delivery_requests_bp.route("/me/delivery-requests", methods=["POST"])
@jwt_required()
def create_my_delivery_request():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    data = request.get_json(silent=True) or {}
    package_ids = data.get("package_ids") or []
    if not isinstance(package_ids, list):
        return jsonify({"error": "package_ids must be an array"}), 400

    delivery_address_id = data.get("delivery_address_id")
    if not delivery_address_id:
        return jsonify({"error": "delivery_address_id is required"}), 400

    try:
        delivery_request = create_delivery_request(
            user,
            package_ids=package_ids,
            delivery_address_id=delivery_address_id,
            notes=data.get("notes"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"delivery_request": delivery_request.to_dict(include_packages=True)}), 201


@delivery_requests_bp.route("/me/delivery-requests/<request_id>", methods=["DELETE"])
@jwt_required()
def cancel_my_delivery_request(request_id: str):
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    delivery_request = get_delivery_request(request_id)
    if not delivery_request or delivery_request.customer_id != user.id:
        return jsonify({"error": "Delivery request not found"}), 404

    try:
        delivery_request = cancel_delivery_request(delivery_request, by_customer=True)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"delivery_request": delivery_request.to_dict(include_packages=True)})


@delivery_requests_bp.route("/me/payment-total", methods=["POST"])
@jwt_required()
def compute_my_payment_total():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    data = request.get_json(silent=True) or {}
    package_ids = data.get("package_ids") or []
    if not isinstance(package_ids, list):
        return jsonify({"error": "package_ids must be an array"}), 400

    from app.services.delivery_request_service import compute_payment_total_with_delivery

    try:
        totals = compute_payment_total_with_delivery(user, package_ids)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(totals)

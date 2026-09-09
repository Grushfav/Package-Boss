from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.logistics_job_service import (
    cancel_logistics_job,
    confirm_customer_logistics_receipt,
    create_logistics_job,
    get_logistics_job,
    list_customer_logistics_jobs,
    update_customer_logistics_notes,
)
from app.utils.auth_decorators import resolve_jwt_user

logistics_jobs_bp = Blueprint("logistics_jobs", __name__)


@logistics_jobs_bp.route("/me/logistics-jobs", methods=["GET"])
@jwt_required()
def list_my_logistics_jobs():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    jobs = list_customer_logistics_jobs(user)
    return jsonify({"logistics_jobs": [job.to_dict() for job in jobs]})


@logistics_jobs_bp.route("/me/logistics-jobs", methods=["POST"])
@jwt_required()
def create_my_logistics_job():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    data = request.get_json(silent=True) or {}
    try:
        job = create_logistics_job(
            user,
            pickup_address_id=data.get("pickup_address_id"),
            pickup_address=data.get("pickup_address"),
            dropoff_address_id=data.get("dropoff_address_id"),
            dropoff_address=data.get("dropoff_address"),
            item_category=data.get("item_category"),
            item_other_detail=data.get("item_other_detail"),
            item_description=data.get("item_description"),
            vehicle_type=data.get("vehicle_type"),
            delivery_speed=data.get("delivery_speed"),
            payment_method=data.get("payment_method"),
            weight_lbs=data.get("weight_lbs"),
            notes=data.get("notes"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"logistics_job": job.to_dict()}), 201


@logistics_jobs_bp.route("/me/logistics-jobs/<job_id>", methods=["DELETE"])
@jwt_required()
def cancel_my_logistics_job(job_id: str):
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    job = get_logistics_job(job_id)
    if not job or job.customer_id != user.id:
        return jsonify({"error": "Local delivery request not found"}), 404

    try:
        job = cancel_logistics_job(job, by_customer=True)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"logistics_job": job.to_dict()})


@logistics_jobs_bp.route("/me/logistics-jobs/<job_id>/notes", methods=["PATCH"])
@jwt_required()
def update_my_logistics_job_notes(job_id: str):
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    job = get_logistics_job(job_id)
    if not job or job.customer_id != user.id:
        return jsonify({"error": "Local delivery request not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        job = update_customer_logistics_notes(job, user, data.get("notes") or "")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"logistics_job": job.to_dict()})


@logistics_jobs_bp.route("/me/logistics-jobs/<job_id>/confirm-receipt", methods=["POST"])
@jwt_required()
def confirm_my_logistics_receipt(job_id: str):
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    job = get_logistics_job(job_id)
    if not job or job.customer_id != user.id:
        return jsonify({"error": "Local delivery request not found"}), 404

    try:
        job = confirm_customer_logistics_receipt(job, user)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"logistics_job": job.to_dict()})

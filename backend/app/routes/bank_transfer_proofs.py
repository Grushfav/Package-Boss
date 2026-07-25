from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.constants import ALLOWED_IMAGE_TYPES
from app.services.bank_transfer_proof_service import (
    list_customer_proofs,
    submit_bank_transfer_proof,
)
from app.services.image_upload_service import (
    ImageUploadError,
    create_upload_presign,
    is_storage_configured,
    parse_presign_fields,
)
from app.services.rate_limit_service import RateLimitExceeded, assert_upload_presign_allowed
from app.utils.auth_decorators import resolve_jwt_user

bank_transfer_proofs_bp = Blueprint("bank_transfer_proofs", __name__)


@bank_transfer_proofs_bp.route("/me/bank-transfer-proofs", methods=["GET"])
@jwt_required()
def list_my_bank_transfer_proofs():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    proofs = list_customer_proofs(user)
    return jsonify({"proofs": [p.to_dict(include_packages=True) for p in proofs]})


@bank_transfer_proofs_bp.route("/me/bank-transfer-proofs/presign", methods=["POST"])
@jwt_required()
def presign_bank_transfer_proof():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    try:
        assert_upload_presign_allowed(str(user.id))
    except RateLimitExceeded as exc:
        return jsonify({"error": str(exc)}), 429

    if not is_storage_configured():
        return jsonify({"error": "File storage is not configured"}), 503

    data = request.get_json(silent=True) or {}
    try:
        _, content_type, content_length = parse_presign_fields(
            data,
            default_filename="transfer-proof.jpg",
            default_content_type="image/jpeg",
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if content_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400

    try:
        return jsonify(
            create_upload_presign(
                content_type=content_type,
                content_length=content_length,
                prefix="transfer-proofs",
            )
        )
    except ImageUploadError as exc:
        return jsonify({"error": str(exc)}), exc.status_code or 503
    except Exception as exc:
        return jsonify({"error": f"Failed to generate upload URL: {exc}"}), 500


@bank_transfer_proofs_bp.route("/me/bank-transfer-proofs", methods=["POST"])
@jwt_required()
def submit_my_bank_transfer_proof():
    user, auth_err = resolve_jwt_user()
    if auth_err:
        return auth_err

    data = request.get_json(silent=True) or {}
    proof_key = (data.get("proof_object_key") or "").strip()
    package_ids = data.get("package_ids") or []
    if package_ids is not None and not isinstance(package_ids, list):
        return jsonify({"error": "package_ids must be an array"}), 400

    try:
        proof = submit_bank_transfer_proof(
            user,
            proof_object_key=proof_key,
            package_ids=package_ids,
            transfer_reference=data.get("transfer_reference"),
            sender_bank=data.get("sender_bank"),
            amount_jmd=data.get("amount_jmd"),
            include_delivery_fee=bool(data.get("include_delivery_fee")),
            notes=data.get("notes"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"proof": proof.to_dict(include_packages=True)}), 201

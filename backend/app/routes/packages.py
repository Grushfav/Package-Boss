import uuid

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.package import Package
from app.models.user import User

packages_bp = Blueprint("packages", __name__)


def _get_current_user():
    user_id = get_jwt_identity()
    try:
        uid = uuid.UUID(user_id)
    except (TypeError, ValueError):
        return None
    return User.query.get(uid)


@packages_bp.route("/me/packages", methods=["GET"])
@jwt_required()
def list_my_packages():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    packages = (
        Package.query.filter_by(customer_id=user.id)
        .order_by(Package.created_at.desc())
        .all()
    )
    return jsonify({"packages": [p.to_dict() for p in packages]})


@packages_bp.route("/me/packages/<package_id>", methods=["GET"])
@jwt_required()
def get_my_package(package_id: str):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        pid = uuid.UUID(package_id)
    except ValueError:
        return jsonify({"error": "Invalid package ID"}), 400

    package = Package.query.filter_by(id=pid, customer_id=user.id).first()
    if not package:
        return jsonify({"error": "Package not found"}), 404

    from app.services.package_service import get_tracking_timeline

    data = package.to_dict(include_events=True, include_photos=True)
    data["timeline"] = get_tracking_timeline(package)
    return jsonify({"package": data})

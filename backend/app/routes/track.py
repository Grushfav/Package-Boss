from flask import Blueprint, current_app, jsonify

from app.models.package import Package
from app.services.package_service import get_tracking_timeline
from app.services.rate_limit_service import RateLimitExceeded, assert_track_lookup_allowed

track_bp = Blueprint("track", __name__)


@track_bp.route("/track/<tracking_number>", methods=["GET"])
def track_package(tracking_number: str):
    try:
        assert_track_lookup_allowed()
    except RateLimitExceeded as exc:
        return jsonify({"error": str(exc)}), 429

    tracking_number = tracking_number.strip().upper()
    package = Package.query.filter_by(tracking_number=tracking_number).first()

    if not package:
        return jsonify({"error": "Tracking number not found"}), 404

    data = package.to_dict(include_events=True, include_photos=True)
    data["timeline"] = get_tracking_timeline(package)
    data["destination"] = "Kingston, Jamaica"
    data["origin"] = f"{current_app.config['WAREHOUSE_CITY']}, {current_app.config['WAREHOUSE_STATE']}"

    return jsonify({"package": data})

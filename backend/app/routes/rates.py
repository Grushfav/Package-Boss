from flask import Blueprint, jsonify, request

from app.models.shipping_rate_tier import ShippingRateTier
from app.services.shipping_service import calculate_shipping_cost

rates_bp = Blueprint("rates", __name__)


@rates_bp.route("/rates", methods=["GET"])
def list_rates():
    tiers = (
        ShippingRateTier.query.filter_by(is_active=True)
        .order_by(ShippingRateTier.sort_order)
        .all()
    )
    return jsonify(
        {
            "currency": "USD",
            "rounding_note": "All weights are rounded up to the nearest whole pound before rating.",
            "tiers": [t.to_dict() for t in tiers],
        }
    )


@rates_bp.route("/rates/estimate", methods=["GET"])
def estimate_rate():
    weight_raw = request.args.get("weight_lbs")
    if weight_raw is None:
        return jsonify({"error": "weight_lbs query parameter is required"}), 400

    try:
        weight = float(weight_raw)
        result = calculate_shipping_cost(weight)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

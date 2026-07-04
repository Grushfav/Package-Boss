from flask import Blueprint, jsonify, make_response, request

from app.services.rate_limit_service import RateLimitExceeded, assert_rates_estimate_allowed
from app.services.shipping_service import (
    JMD_PER_USD,
    MAX_AUTO_RATE_LBS,
    QUOTE_MESSAGE,
    RATES_REVISION,
    build_rate_table,
    calculate_shipping_cost,
)

rates_bp = Blueprint("rates", __name__)


@rates_bp.route("/rates", methods=["GET"])
def list_rates():
    payload = {
        "currency": "USD",
        "jmd_per_usd": JMD_PER_USD,
        "max_auto_rate_lbs": MAX_AUTO_RATE_LBS,
        "rates_revision": RATES_REVISION,
        "quote_note": QUOTE_MESSAGE,
        "rounding_note": "All weights are rounded up to the nearest whole pound before rating.",
        "formula_note": (
            f"Published tier rates by billable weight (1–{MAX_AUTO_RATE_LBS} lbs). "
            f"JMD shown at {JMD_PER_USD} JMD = 1 USD."
        ),
        "billing_disclaimer": (
            "Published rates are freight estimates only. Final bills may include customs duties "
            "(items over $100 USD), handling fees, and other charges after invoice review."
        ),
        "tiers": build_rate_table(),
    }
    response = make_response(jsonify(payload))
    response.headers["Cache-Control"] = "public, max-age=300"
    return response


@rates_bp.route("/rates/estimate", methods=["GET"])
def estimate_rate():
    try:
        assert_rates_estimate_allowed()
    except RateLimitExceeded as exc:
        return jsonify({"error": str(exc)}), 429

    weight_raw = request.args.get("weight_lbs")
    if weight_raw is None:
        return jsonify({"error": "weight_lbs query parameter is required"}), 400

    try:
        weight = float(weight_raw)
        result = calculate_shipping_cost(weight)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc), "requires_quote": "custom quote" in str(exc).lower()}), 400

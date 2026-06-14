from decimal import Decimal, ROUND_CEILING

from app.models.shipping_rate_tier import ShippingRateTier

MAX_WEIGHT_LBS = 150


def billable_weight_lbs(actual_weight: Decimal | float) -> int:
    weight = Decimal(str(actual_weight))
    if weight <= 0:
        raise ValueError("Weight must be positive")
    return int(weight.to_integral_value(rounding=ROUND_CEILING))


def _find_tier(billable: int) -> ShippingRateTier:
    tier = (
        ShippingRateTier.query.filter(
            ShippingRateTier.is_active.is_(True),
            ShippingRateTier.min_weight_lbs <= billable,
            ShippingRateTier.max_weight_lbs >= billable,
        )
        .order_by(ShippingRateTier.sort_order)
        .first()
    )
    if not tier:
        raise ValueError(f"No rate tier found for {billable} lbs")
    return tier


def calculate_shipping_cost(actual_weight_lbs: Decimal | float) -> dict:
    billable = billable_weight_lbs(actual_weight_lbs)

    if billable > MAX_WEIGHT_LBS:
        raise ValueError("Packages over 150 lbs require a custom quote")

    tier = _find_tier(billable)

    if tier.pricing_type == "flat":
        cost = Decimal(str(tier.flat_rate_usd))
    else:
        cost = Decimal(billable) * Decimal(str(tier.rate_per_lb_usd))

    cost = cost.quantize(Decimal("0.01"))

    return {
        "actual_weight_lbs": float(actual_weight_lbs),
        "billable_weight_lbs": billable,
        "cost_usd": float(cost),
        "tier_label": tier.display_label,
        "pricing_type": tier.pricing_type,
        "route": "Miami → Kingston Doorstep",
        "currency": "USD",
        "rounding_note": "Weights are rounded up to the nearest whole pound.",
    }

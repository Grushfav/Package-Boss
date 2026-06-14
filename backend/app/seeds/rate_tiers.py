from decimal import Decimal

from app.extensions import db
from app.models.shipping_rate_tier import ShippingRateTier

RATE_TIER_SEED = [
    ("Up to 1 lb", 1, 1, "flat", Decimal("6.00"), None),
    ("1 to 2 lbs", 2, 2, "flat", Decimal("9.00"), None),
    ("2 to 3 lbs", 3, 3, "flat", Decimal("12.00"), None),
    ("3 to 4 lbs", 4, 4, "flat", Decimal("15.00"), None),
    ("4 to 5 lbs", 5, 5, "flat", Decimal("18.00"), None),
    ("5 to 6 lbs", 6, 6, "flat", Decimal("21.00"), None),
    ("6 to 7 lbs", 7, 7, "flat", Decimal("24.00"), None),
    ("7 to 8 lbs", 8, 8, "flat", Decimal("27.00"), None),
    ("8 to 9 lbs", 9, 9, "flat", Decimal("30.00"), None),
    ("9 to 10 lbs", 10, 10, "flat", Decimal("32.50"), None),
    ("11 to 20 lbs", 11, 20, "per_lb", None, Decimal("2.50")),
    ("21 to 150 lbs", 21, 150, "per_lb", None, Decimal("2.25")),
]


def seed_rate_tiers():
    if ShippingRateTier.query.count() > 0:
        return

    for i, (label, min_w, max_w, ptype, flat, per_lb) in enumerate(RATE_TIER_SEED, start=1):
        tier = ShippingRateTier(
            display_label=label,
            min_weight_lbs=min_w,
            max_weight_lbs=max_w,
            pricing_type=ptype,
            flat_rate_usd=flat,
            rate_per_lb_usd=per_lb,
            sort_order=i,
            is_active=True,
        )
        db.session.add(tier)

    db.session.commit()

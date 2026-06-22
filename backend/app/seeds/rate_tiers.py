from decimal import Decimal

from app.extensions import db
from app.models.shipping_rate_tier import ShippingRateTier
from app.services.shipping_service import usd_for_billable_lbs

RATE_TIER_SEED = [
    (f"{lbs} lb" if lbs == 1 else f"{lbs} lbs", lbs, lbs, "flat", usd_for_billable_lbs(lbs), None)
    for lbs in range(1, 31)
]


def seed_rate_tiers():
    if ShippingRateTier.query.count() > 0:
        return

    _insert_rate_tiers()


def replace_rate_tiers():
    ShippingRateTier.query.delete()
    db.session.commit()
    _insert_rate_tiers()


def _insert_rate_tiers():
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

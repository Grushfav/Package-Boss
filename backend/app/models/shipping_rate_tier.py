import uuid

from app.extensions import db


class ShippingRateTier(db.Model):
    __tablename__ = "shipping_rate_tiers"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_label = db.Column(db.String(50), nullable=False)
    min_weight_lbs = db.Column(db.Integer, nullable=False)
    max_weight_lbs = db.Column(db.Integer, nullable=False)
    pricing_type = db.Column(db.String(20), nullable=False)  # flat | per_lb
    flat_rate_usd = db.Column(db.Numeric(10, 2))
    rate_per_lb_usd = db.Column(db.Numeric(10, 2))
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def rate_display(self) -> str:
        if self.pricing_type == "flat":
            return f"${float(self.flat_rate_usd):.2f}"
        return f"${float(self.rate_per_lb_usd):.2f} per 1 lb"

    def to_dict(self) -> dict:
        return {
            "label": self.display_label,
            "min_weight_lbs": self.min_weight_lbs,
            "max_weight_lbs": self.max_weight_lbs,
            "pricing_type": self.pricing_type,
            "rate_display": self.rate_display(),
            "flat_rate_usd": float(self.flat_rate_usd) if self.flat_rate_usd else None,
            "rate_per_lb_usd": float(self.rate_per_lb_usd) if self.rate_per_lb_usd else None,
        }

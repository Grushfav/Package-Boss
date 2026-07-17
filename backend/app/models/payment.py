import uuid
from datetime import datetime

from app.extensions import db


class PaymentCheckout(db.Model):
    __tablename__ = "payment_checkouts"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    invoice_number = db.Column(db.String(40), unique=True, nullable=False, index=True)
    total_jmd = db.Column(db.Numeric(12, 2), nullable=False)
    method = db.Column(db.String(30), nullable=False)
    reference = db.Column(db.String(100))
    notes = db.Column(db.String(500))
    recorded_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    delivery_request_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("delivery_requests.id"))
    delivery_fee_jmd = db.Column(db.Numeric(12, 2))
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    customer = db.relationship("User", foreign_keys=[customer_id], backref="payment_checkouts")
    recorded_by = db.relationship("User", foreign_keys=[recorded_by_id])
    delivery_request = db.relationship("DeliveryRequest", backref="checkouts")
    items = db.relationship(
        "PaymentCheckoutItem",
        backref="checkout",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_items: bool = False) -> dict:
        from app.constants import PAYMENT_METHOD_LABELS

        data = {
            "id": str(self.id),
            "customer_id": str(self.customer_id),
            "invoice_number": self.invoice_number,
            "total_jmd": float(self.total_jmd),
            "method": self.method,
            "method_label": PAYMENT_METHOD_LABELS.get(self.method, self.method),
            "reference": self.reference,
            "notes": self.notes,
            "recorded_by_id": str(self.recorded_by_id) if self.recorded_by_id else None,
            "recorded_by_name": self.recorded_by.full_name if self.recorded_by else None,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
            "delivery_request_id": str(self.delivery_request_id) if self.delivery_request_id else None,
            "delivery_fee_jmd": float(self.delivery_fee_jmd) if self.delivery_fee_jmd is not None else None,
            "package_count": len(self.items),
        }
        if include_items:
            data["items"] = [item.to_dict(include_package=True) for item in self.items]
        return data


class PaymentCheckoutItem(db.Model):
    __tablename__ = "payment_checkout_items"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    checkout_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("payment_checkouts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    package_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("packages.id"), nullable=False, unique=True)
    amount_jmd = db.Column(db.Numeric(12, 2), nullable=False)

    package = db.relationship("Package", backref="checkout_item")

    def to_dict(self, include_package: bool = False) -> dict:
        data = {
            "id": str(self.id),
            "checkout_id": str(self.checkout_id),
            "package_id": str(self.package_id),
            "amount_jmd": float(self.amount_jmd),
        }
        if include_package and self.package:
            data["tracking_number"] = self.package.tracking_number
        return data

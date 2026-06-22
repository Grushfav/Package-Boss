import uuid
from datetime import datetime

from app.extensions import db


class DeliveryAddress(db.Model):
    __tablename__ = "delivery_addresses"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True
    )
    label = db.Column(db.String(50), nullable=False)
    recipient_name = db.Column(db.String(160))
    line1 = db.Column(db.String(255), nullable=False)
    line2 = db.Column(db.String(255))
    community = db.Column(db.String(100))
    parish = db.Column(db.String(50), nullable=False)
    contact_number = db.Column(db.String(20), nullable=False)
    delivery_notes = db.Column(db.String(500))
    is_default = db.Column(db.Boolean, default=False, nullable=False)
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    customer = db.relationship("User", backref="delivery_addresses")

    def formatted(self) -> str:
        lines = [self.line1]
        if self.line2:
            lines.append(self.line2)
        community_line = self.community or ""
        if community_line:
            lines.append(f"{community_line}, {self.parish}")
        else:
            lines.append(self.parish)
        return "\n".join(lines)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "label": self.label,
            "recipient_name": self.recipient_name,
            "line1": self.line1,
            "line2": self.line2,
            "community": self.community,
            "parish": self.parish,
            "contact_number": self.contact_number,
            "delivery_notes": self.delivery_notes,
            "is_default": self.is_default,
            "sort_order": self.sort_order,
            "formatted": self.formatted(),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

import uuid
from datetime import datetime

from app.extensions import db


class Package(db.Model):
    __tablename__ = "packages"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tracking_number = db.Column(db.String(30), unique=True, nullable=False, index=True)
    customer_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)

    carrier_tracking = db.Column(db.String(100))
    shipper = db.Column(db.String(30))
    actual_weight_lbs = db.Column(db.Numeric(8, 2))
    billable_weight_lbs = db.Column(db.Integer)
    shipping_cost_usd = db.Column(db.Numeric(10, 2))
    rate_tier_label = db.Column(db.String(50))

    status = db.Column(db.String(50), nullable=False, default="received_miami")
    received_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    customer = db.relationship("User", backref="packages")
    photos = db.relationship("PackagePhoto", backref="package", lazy=True, cascade="all, delete-orphan")
    events = db.relationship(
        "PackageEvent",
        backref="package",
        lazy=True,
        order_by="PackageEvent.created_at",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_events: bool = False, include_photos: bool = False) -> dict:
        from app.constants import SHIPPER_LABELS, STATUS_LABELS

        data = {
            "id": str(self.id),
            "tracking_number": self.tracking_number,
            "status": self.status,
            "status_label": STATUS_LABELS.get(self.status, self.status),
            "carrier_tracking": self.carrier_tracking,
            "shipper": self.shipper,
            "shipper_label": SHIPPER_LABELS.get(self.shipper, self.shipper) if self.shipper else None,
            "actual_weight_lbs": float(self.actual_weight_lbs) if self.actual_weight_lbs else None,
            "billable_weight_lbs": self.billable_weight_lbs,
            "shipping_cost_usd": float(self.shipping_cost_usd) if self.shipping_cost_usd else None,
            "rate_tier_label": self.rate_tier_label,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "created_at": self.created_at.isoformat(),
        }
        if include_events:
            data["events"] = [e.to_dict() for e in self.events]
        if include_photos:
            data["photos"] = [p.to_dict() for p in self.photos]
        return data


class PackageEvent(db.Model):
    __tablename__ = "package_events"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("packages.id"), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    note = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict:
        from app.constants import STATUS_LABELS

        return {
            "id": str(self.id),
            "status": self.status,
            "status_label": STATUS_LABELS.get(self.status, self.status),
            "note": self.note,
            "created_at": self.created_at.isoformat(),
        }


class PackagePhoto(db.Model):
    __tablename__ = "package_photos"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("packages.id"), nullable=False)
    r2_object_key = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict:
        from app.services.r2_service import get_public_url

        return {
            "id": str(self.id),
            "object_key": self.r2_object_key,
            "url": get_public_url(self.r2_object_key),
            "created_at": self.created_at.isoformat(),
        }

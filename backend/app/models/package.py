import uuid
from datetime import datetime

from app.extensions import db


class Package(db.Model):
    __tablename__ = "packages"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tracking_number = db.Column(db.String(30), unique=True, nullable=False, index=True)
    customer_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)

    carrier_tracking = db.Column(db.String(100))
    label_name = db.Column(db.String(255))
    label_boss_id = db.Column(db.String(20))
    shipper = db.Column(db.String(30))
    actual_weight_lbs = db.Column(db.Numeric(8, 2))
    billable_weight_lbs = db.Column(db.Integer)
    shipping_cost_usd = db.Column(db.Numeric(10, 2))
    estimated_freight_usd = db.Column(db.Numeric(10, 2))
    duties_usd = db.Column(db.Numeric(10, 2))
    handling_usd = db.Column(db.Numeric(10, 2))
    other_fees_usd = db.Column(db.Numeric(10, 2))
    total_due_usd = db.Column(db.Numeric(10, 2))
    billing_status = db.Column(db.String(20), nullable=False, default="pending")
    invoice_status = db.Column(db.String(20), nullable=False, default="pending")
    invoice_object_key = db.Column(db.String(500))
    declared_value_usd = db.Column(db.Numeric(10, 2))
    invoice_requested_at = db.Column(db.DateTime)
    invoice_requested_via = db.Column(db.String(20))
    invoice_request_note = db.Column(db.String(500))
    invoice_received_at = db.Column(db.DateTime)
    delivery_address_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("delivery_addresses.id"))
    rate_tier_label = db.Column(db.String(50))

    status = db.Column(db.String(50), nullable=False, default="received_miami")
    label_printed_at = db.Column(db.DateTime, nullable=True)
    received_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    customer = db.relationship("User", backref="packages")
    delivery_address = db.relationship("DeliveryAddress", backref="packages")
    photos = db.relationship("PackagePhoto", backref="package", lazy=True, cascade="all, delete-orphan")
    events = db.relationship(
        "PackageEvent",
        backref="package",
        lazy=True,
        order_by="PackageEvent.created_at",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_events: bool = False, include_photos: bool = False) -> dict:
        from app.constants import BILLING_STATUS_LABELS, INVOICE_STATUS_LABELS, SHIPPER_LABELS, STATUS_LABELS
        from app.services.image_upload_service import resolve_stored_url

        data = {
            "id": str(self.id),
            "tracking_number": self.tracking_number,
            "status": self.status,
            "status_label": STATUS_LABELS.get(self.status, self.status),
            "carrier_tracking": self.carrier_tracking,
            "label_name": self.label_name,
            "label_boss_id": self.label_boss_id,
            "is_unidentified": self.status == "unidentified",
            "shipper": self.shipper,
            "shipper_label": SHIPPER_LABELS.get(self.shipper, self.shipper) if self.shipper else None,
            "actual_weight_lbs": float(self.actual_weight_lbs) if self.actual_weight_lbs else None,
            "billable_weight_lbs": self.billable_weight_lbs,
            "estimated_freight_usd": float(self.estimated_freight_usd)
            if self.estimated_freight_usd is not None
            else None,
            "duties_usd": float(self.duties_usd) if self.duties_usd is not None else None,
            "handling_usd": float(self.handling_usd) if self.handling_usd is not None else None,
            "other_fees_usd": float(self.other_fees_usd) if self.other_fees_usd is not None else None,
            "total_due_usd": float(self.total_due_usd) if self.total_due_usd is not None else None,
            "billing_status": self.billing_status,
            "billing_status_label": BILLING_STATUS_LABELS.get(self.billing_status, self.billing_status),
            "invoice_status": self.invoice_status,
            "invoice_status_label": INVOICE_STATUS_LABELS.get(self.invoice_status, self.invoice_status),
            "invoice_object_key": self.invoice_object_key,
            "invoice_url": resolve_stored_url(self.invoice_object_key) if self.invoice_object_key else None,
            "declared_value_usd": float(self.declared_value_usd) if self.declared_value_usd else None,
            "invoice_requested_at": self.invoice_requested_at.isoformat()
            if self.invoice_requested_at
            else None,
            "invoice_requested_via": self.invoice_requested_via,
            "invoice_request_note": self.invoice_request_note,
            "invoice_received_at": self.invoice_received_at.isoformat()
            if self.invoice_received_at
            else None,
            "delivery_address_id": str(self.delivery_address_id) if self.delivery_address_id else None,
            "delivery_address": self.delivery_address.to_dict() if self.delivery_address else None,
            "rate_tier_label": self.rate_tier_label,
            "label_printed_at": self.label_printed_at.isoformat() if self.label_printed_at else None,
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
        from app.services.image_upload_service import resolve_stored_url

        return {
            "id": str(self.id),
            "object_key": self.r2_object_key,
            "url": resolve_stored_url(self.r2_object_key),
            "created_at": self.created_at.isoformat(),
        }

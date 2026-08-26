import uuid
from datetime import datetime

from app.extensions import db
from app.utils.datetime_format import utc_isoformat


class PreAlert(db.Model):
    __tablename__ = "pre_alerts"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    carrier_tracking = db.Column(db.String(100), nullable=False, index=True)
    merchant = db.Column(db.String(100))
    description = db.Column(db.String(255))
    declared_value_usd = db.Column(db.Numeric(10, 2))
    invoice_object_key = db.Column(db.String(500))
    status = db.Column(db.String(20), nullable=False, default="pending")
    package_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("packages.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    customer = db.relationship("User", backref="pre_alerts")
    package = db.relationship("Package", backref="pre_alert", uselist=False)

    def to_dict(self) -> dict:
        from app.constants import PRE_ALERT_STATUS_LABELS, SHIPPER_LABELS
        from app.services.image_upload_service import resolve_stored_url

        merchant = self.merchant
        return {
            "id": str(self.id),
            "carrier_tracking": self.carrier_tracking,
            "merchant": merchant,
            "merchant_label": SHIPPER_LABELS.get(merchant, merchant) if merchant else None,
            "description": self.description,
            "declared_value_usd": float(self.declared_value_usd) if self.declared_value_usd else None,
            "invoice_object_key": self.invoice_object_key,
            "invoice_url": resolve_stored_url(self.invoice_object_key) if self.invoice_object_key else None,
            "status": self.status,
            "status_label": PRE_ALERT_STATUS_LABELS.get(self.status, self.status),
            "package_id": str(self.package_id) if self.package_id else None,
            "created_at": utc_isoformat(self.created_at),
            "updated_at": utc_isoformat(self.updated_at),
        }

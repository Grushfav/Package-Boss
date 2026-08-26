import uuid
from datetime import datetime

from app.extensions import db
from app.utils.datetime_format import utc_isoformat


class DeliveryRequest(db.Model):
    __tablename__ = "delivery_requests"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    delivery_address_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("delivery_addresses.id"), nullable=False
    )
    status = db.Column(db.String(20), nullable=False, default="pending", index=True)
    delivery_fee_jmd = db.Column(db.Numeric(12, 2), nullable=False)
    notes = db.Column(db.String(500))
    requested_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    completed_at = db.Column(db.DateTime)
    completed_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    in_progress_at = db.Column(db.DateTime)
    in_progress_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    cancelled_at = db.Column(db.DateTime)

    customer = db.relationship("User", foreign_keys=[customer_id], backref="delivery_requests")
    delivery_address = db.relationship("DeliveryAddress", backref="delivery_requests")
    completed_by = db.relationship("User", foreign_keys=[completed_by_id])
    in_progress_by = db.relationship("User", foreign_keys=[in_progress_by_id])
    package_links = db.relationship(
        "DeliveryRequestPackage",
        backref="delivery_request",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_packages: bool = False, include_address: bool = True) -> dict:
        from app.constants import DELIVERY_REQUEST_STATUS_LABELS

        data = {
            "id": str(self.id),
            "customer_id": str(self.customer_id),
            "delivery_address_id": str(self.delivery_address_id),
            "status": self.status,
            "status_label": DELIVERY_REQUEST_STATUS_LABELS.get(self.status, self.status),
            "delivery_fee_jmd": float(self.delivery_fee_jmd),
            "notes": self.notes,
            "requested_at": utc_isoformat(self.requested_at),
            "completed_at": utc_isoformat(self.completed_at),
            "completed_by_name": self.completed_by.full_name if self.completed_by else None,
            "in_progress_at": utc_isoformat(self.in_progress_at),
            "in_progress_by_name": self.in_progress_by.full_name if self.in_progress_by else None,
            "cancelled_at": utc_isoformat(self.cancelled_at),
            "package_count": len(self.package_links),
        }
        if include_address and self.delivery_address:
            data["delivery_address"] = self.delivery_address.to_dict()
        if include_packages:
            data["packages"] = [link.to_dict(include_package=True) for link in self.package_links]
        if self.customer:
            data["customer_name"] = self.customer.full_name
            data["shipping_id"] = self.customer.shipping_id
        return data


class DeliveryRequestPackage(db.Model):
    __tablename__ = "delivery_request_packages"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    delivery_request_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("delivery_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    package_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("packages.id"), nullable=False, unique=True)

    package = db.relationship("Package", backref="delivery_request_links")

    def to_dict(self, include_package: bool = False) -> dict:
        data = {
            "id": str(self.id),
            "delivery_request_id": str(self.delivery_request_id),
            "package_id": str(self.package_id),
        }
        if include_package and self.package:
            from app.constants import STATUS_LABELS

            data["tracking_number"] = self.package.tracking_number
            data["total_due_jmd"] = (
                float(self.package.total_due_jmd) if self.package.total_due_jmd is not None else None
            )
            data["billing_status"] = self.package.billing_status
            data["status"] = self.package.status
            data["status_label"] = STATUS_LABELS.get(self.package.status, self.package.status)
        return data

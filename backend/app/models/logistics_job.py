import uuid
from datetime import datetime

from app.extensions import db
from app.utils.datetime_format import utc_isoformat


class LogisticsJob(db.Model):
    __tablename__ = "logistics_jobs"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference = db.Column(db.String(20), nullable=False, unique=True, index=True)
    customer_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    pickup_address_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("delivery_addresses.id"), nullable=False
    )
    dropoff_address_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("delivery_addresses.id"), nullable=False
    )
    item_description = db.Column(db.String(500), nullable=False)
    vehicle_type = db.Column(db.String(20))
    delivery_speed = db.Column(db.String(20))
    weight_lbs = db.Column(db.Numeric(8, 2))
    notes = db.Column(db.String(500))
    status = db.Column(db.String(20), nullable=False, default="pending", index=True)
    quoted_fee_jmd = db.Column(db.Numeric(12, 2))
    fee_pending_quote = db.Column(db.Boolean, nullable=False, default=False)
    requested_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    in_progress_at = db.Column(db.DateTime)
    in_progress_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    picked_up_at = db.Column(db.DateTime)
    picked_up_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    in_transit_at = db.Column(db.DateTime)
    in_transit_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    completed_at = db.Column(db.DateTime)
    completed_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    driver_name = db.Column(db.String(160))
    driver_contact_number = db.Column(db.String(20))
    driver_confirmed_at = db.Column(db.DateTime)
    driver_confirmed_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    payment_method = db.Column(db.String(20), nullable=False, default="cash")
    assigned_clerk_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    assigned_at = db.Column(db.DateTime)
    assigned_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    rejected_at = db.Column(db.DateTime)
    rejected_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))
    rejection_reason = db.Column(db.String(500))
    customer_receipt_confirmed_at = db.Column(db.DateTime)
    cancelled_at = db.Column(db.DateTime)

    customer = db.relationship("User", foreign_keys=[customer_id], backref="logistics_jobs")
    pickup_address = db.relationship("DeliveryAddress", foreign_keys=[pickup_address_id])
    dropoff_address = db.relationship("DeliveryAddress", foreign_keys=[dropoff_address_id])
    in_progress_by = db.relationship("User", foreign_keys=[in_progress_by_id])
    picked_up_by = db.relationship("User", foreign_keys=[picked_up_by_id])
    in_transit_by = db.relationship("User", foreign_keys=[in_transit_by_id])
    completed_by = db.relationship("User", foreign_keys=[completed_by_id])
    driver_confirmed_by = db.relationship("User", foreign_keys=[driver_confirmed_by_id])
    assigned_clerk = db.relationship("User", foreign_keys=[assigned_clerk_id])
    assigned_by = db.relationship("User", foreign_keys=[assigned_by_id])
    rejected_by = db.relationship("User", foreign_keys=[rejected_by_id])

    def handler_name(self) -> str | None:
        if self.assigned_clerk:
            return self.assigned_clerk.full_name
        return self.driver_name

    def display_status_label(self) -> str:
        if self.status == "pending" and self.handler_name():
            return "Driver assigned"
        if self.status == "completed" and not self.customer_receipt_confirmed_at:
            return "Delivered — confirm receipt"
        from app.constants import LOGISTICS_JOB_STATUS_LABELS

        return LOGISTICS_JOB_STATUS_LABELS.get(self.status, self.status)

    def to_dict(self, include_addresses: bool = True) -> dict:
        from app.constants import (
            LOGISTICS_DELIVERY_SPEED_LABELS,
            LOGISTICS_JOB_STATUS_LABELS,
            LOGISTICS_PAYMENT_METHOD_LABELS,
            LOGISTICS_VEHICLE_TYPE_LABELS,
            LOGISTICS_VEHICLE_TYPE_WEIGHT_LABELS,
        )

        data = {
            "id": str(self.id),
            "reference": self.reference,
            "customer_id": str(self.customer_id),
            "pickup_address_id": str(self.pickup_address_id),
            "dropoff_address_id": str(self.dropoff_address_id),
            "item_description": self.item_description,
            "vehicle_type": self.vehicle_type,
            "vehicle_type_label": LOGISTICS_VEHICLE_TYPE_LABELS.get(self.vehicle_type or "", self.vehicle_type),
            "vehicle_weight_label": LOGISTICS_VEHICLE_TYPE_WEIGHT_LABELS.get(self.vehicle_type or ""),
            "delivery_speed": self.delivery_speed,
            "delivery_speed_label": LOGISTICS_DELIVERY_SPEED_LABELS.get(
                self.delivery_speed or "", self.delivery_speed
            ),
            "weight_lbs": float(self.weight_lbs) if self.weight_lbs is not None else None,
            "notes": self.notes,
            "driver_name": self.driver_name,
            "driver_contact_number": self.driver_contact_number,
            "driver_confirmed_at": utc_isoformat(self.driver_confirmed_at),
            "payment_method": self.payment_method,
            "payment_method_label": LOGISTICS_PAYMENT_METHOD_LABELS.get(
                self.payment_method or "", self.payment_method
            ),
            "assigned_clerk_id": str(self.assigned_clerk_id) if self.assigned_clerk_id else None,
            "assigned_clerk_name": self.handler_name(),
            "assigned_at": utc_isoformat(self.assigned_at),
            "assigned_by_name": self.assigned_by.full_name if self.assigned_by else None,
            "rejected_at": utc_isoformat(self.rejected_at),
            "rejected_by_name": self.rejected_by.full_name if self.rejected_by else None,
            "rejection_reason": self.rejection_reason,
            "status": self.status,
            "status_label": self.display_status_label(),
            "quoted_fee_jmd": float(self.quoted_fee_jmd) if self.quoted_fee_jmd is not None else None,
            "fee_pending_quote": self.fee_pending_quote,
            "requested_at": utc_isoformat(self.requested_at),
            "in_progress_at": utc_isoformat(self.in_progress_at),
            "in_progress_by_name": self.in_progress_by.full_name if self.in_progress_by else None,
            "picked_up_at": utc_isoformat(self.picked_up_at),
            "picked_up_by_name": self.picked_up_by.full_name if self.picked_up_by else None,
            "in_transit_at": utc_isoformat(self.in_transit_at),
            "in_transit_by_name": self.in_transit_by.full_name if self.in_transit_by else None,
            "completed_at": utc_isoformat(self.completed_at),
            "completed_by_name": self.completed_by.full_name if self.completed_by else None,
            "customer_receipt_confirmed_at": utc_isoformat(self.customer_receipt_confirmed_at),
            "cancelled_at": utc_isoformat(self.cancelled_at),
        }
        if self.customer:
            data["customer_name"] = self.customer.full_name
            data["shipping_id"] = self.customer.shipping_id
        if include_addresses:
            if self.pickup_address:
                data["pickup_address"] = self.pickup_address.to_dict()
            if self.dropoff_address:
                data["dropoff_address"] = self.dropoff_address.to_dict()
        return data

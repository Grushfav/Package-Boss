import uuid
from datetime import date, datetime

from app.extensions import db


class Shipment(db.Model):
    __tablename__ = "shipments"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference = db.Column(db.String(100), nullable=False)
    departure_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="open", index=True)
    note = db.Column(db.String(500))
    created_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    departed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    created_by = db.relationship("User", backref="shipments")
    packages = db.relationship(
        "Package",
        back_populates="shipment",
        lazy=True,
        order_by="Package.received_at",
    )

    def package_count(self) -> int:
        return len(self.packages)

    def total_weight_lbs(self) -> float:
        total = 0.0
        for package in self.packages:
            if package.actual_weight_lbs is not None:
                total += float(package.actual_weight_lbs)
        return round(total, 2)

    def to_dict(self, *, include_packages: bool = False) -> dict:
        from app.constants import SHIPMENT_STATUS_LABELS

        data = {
            "id": str(self.id),
            "reference": self.reference,
            "departure_date": self.departure_date.isoformat(),
            "status": self.status,
            "status_label": SHIPMENT_STATUS_LABELS.get(self.status, self.status),
            "note": self.note,
            "created_by_id": str(self.created_by_id) if self.created_by_id else None,
            "created_by_name": self.created_by.full_name if self.created_by else None,
            "departed_at": self.departed_at.isoformat() if self.departed_at else None,
            "package_count": self.package_count(),
            "total_weight_lbs": self.total_weight_lbs(),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_packages:
            from app.services.package_service import warehouse_package_to_dict

            data["packages"] = [warehouse_package_to_dict(p) for p in self.packages]
        return data

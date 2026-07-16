import uuid
from datetime import datetime

from app.extensions import db


class ReceiveBatch(db.Model):
    __tablename__ = "receive_batches"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    reference = db.Column(db.String(100), nullable=False)
    receive_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="open", index=True)
    note = db.Column(db.String(500))
    created_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    closed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    created_by = db.relationship("User", backref="receive_batches")
    packages = db.relationship(
        "Package",
        back_populates="receive_batch",
        lazy=True,
        order_by="Package.received_at",
    )

    def package_count(self) -> int:
        return len(self.packages)

    def to_dict(self, *, include_packages: bool = False) -> dict:
        from app.constants import RECEIVE_BATCH_STATUS_LABELS

        data = {
            "id": str(self.id),
            "batch_code": self.batch_code,
            "reference": self.reference,
            "receive_date": self.receive_date.isoformat(),
            "status": self.status,
            "status_label": RECEIVE_BATCH_STATUS_LABELS.get(self.status, self.status),
            "note": self.note,
            "created_by_id": str(self.created_by_id) if self.created_by_id else None,
            "created_by_name": self.created_by.full_name if self.created_by else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "package_count": self.package_count(),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_packages:
            from app.services.package_service import warehouse_package_to_dict

            data["packages"] = [warehouse_package_to_dict(p) for p in self.packages]
        return data

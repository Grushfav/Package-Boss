import uuid
from datetime import datetime

from app.constants import PICKUP_ID_TYPE_LABELS
from app.extensions import db


class AuthorizedPickupPerson(db.Model):
    __tablename__ = "authorized_pickup_persons"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True
    )
    full_name = db.Column(db.String(160), nullable=False)
    relationship = db.Column(db.String(30), nullable=False)
    contact_number = db.Column(db.String(20), nullable=False)
    id_type = db.Column(db.String(30), nullable=False)
    id_last_four = db.Column(db.String(4))
    notes = db.Column(db.String(500))
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    customer = db.relationship("User", backref="authorized_pickups")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "full_name": self.full_name,
            "contact_number": self.contact_number,
            "id_type": self.id_type,
            "id_type_label": PICKUP_ID_TYPE_LABELS.get(self.id_type, self.id_type),
            "notes": self.notes,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

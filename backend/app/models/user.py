import uuid
from datetime import datetime

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    contact_number = db.Column(db.String(20), nullable=False)
    parish = db.Column(db.String(50), nullable=False)

    trn_encrypted = db.Column(db.Text, nullable=False)
    trn_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)

    shipping_id = db.Column(db.String(20), unique=True, nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False, default="customer")

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def to_dict(self, include_trn_masked: bool = False) -> dict:
        data = {
            "id": str(self.id),
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "contact_number": self.contact_number,
            "parish": self.parish,
            "shipping_id": self.shipping_id,
            "role": self.role,
            "created_at": self.created_at.isoformat(),
        }
        if include_trn_masked:
            from app.services.trn_service import get_trn_masked

            data["trn_masked"] = get_trn_masked(self)
            data["trn_on_file"] = True
        return data

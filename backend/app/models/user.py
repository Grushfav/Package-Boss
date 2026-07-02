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
    parish = db.Column(db.String(50), nullable=True)

    trn = db.Column(db.String(11), nullable=True, index=True)

    shipping_id = db.Column(db.String(20), unique=True, nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False, default="customer")

    clerk_permissions = db.Column(db.JSON, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    must_set_password = db.Column(db.Boolean, default=False, nullable=False)

    terms_accepted_at = db.Column(db.DateTime, nullable=True)
    whatsapp_opt_in = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def to_dict(self, include_trn: bool = False, include_clerk_fields: bool = False) -> dict:
        from app.services.clerk_permission_service import get_clerk_permissions

        data = {
            "id": str(self.id),
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "contact_number": self.contact_number,
            "parish": self.parish or "",
            "shipping_id": self.shipping_id,
            "role": self.role,
            "whatsapp_opt_in": self.whatsapp_opt_in,
            "created_at": self.created_at.isoformat(),
        }
        if include_trn and self.trn:
            data["trn"] = self.trn
        if include_clerk_fields or self.role in ("clerk", "admin"):
            data["permissions"] = get_clerk_permissions(self)
            data["is_active"] = self.is_active
            if self.role == "clerk":
                data["must_set_password"] = self.must_set_password
                data["clerk_permissions"] = get_clerk_permissions(self)
        return data

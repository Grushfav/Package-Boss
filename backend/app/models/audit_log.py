import uuid
from datetime import datetime

from app.extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True, index=True)
    actor_name = db.Column(db.String(160))
    actor_role = db.Column(db.String(20), nullable=False)
    action = db.Column(db.String(50), nullable=False, index=True)
    entity_type = db.Column(db.String(30), nullable=False, default="package")
    entity_id = db.Column(db.String(36), index=True)
    summary = db.Column(db.String(500), nullable=False)
    metadata_json = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    actor = db.relationship("User", backref="audit_logs")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "actor_id": str(self.actor_id) if self.actor_id else None,
            "actor_name": self.actor_name,
            "actor_role": self.actor_role,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "summary": self.summary,
            "metadata": self.metadata_json or {},
            "created_at": self.created_at.isoformat(),
        }

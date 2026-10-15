from datetime import datetime

from app.extensions import db


class DataDeletionRequest(db.Model):
    __tablename__ = "data_deletion_requests"

    confirmation_code = db.Column(db.String(64), primary_key=True)
    facebook_user_id = db.Column(db.String(255), nullable=True, index=True)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    status = db.Column(db.String(32), nullable=False, default="completed")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.String(500), nullable=True)

    def to_dict(self) -> dict:
        return {
            "confirmation_code": self.confirmation_code,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }

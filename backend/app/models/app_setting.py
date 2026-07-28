from datetime import datetime

from app.extensions import db

CUSTOMER_EMAIL_NOTIFICATIONS_KEY = "customer_email_notifications_enabled"


class AppSetting(db.Model):
    __tablename__ = "app_settings"

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)

    updated_by = db.relationship("User", foreign_keys=[updated_by_id])

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "value": self.value,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updated_by_id": str(self.updated_by_id) if self.updated_by_id else None,
        }

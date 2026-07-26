import uuid
from datetime import datetime

from app.extensions import db

ANNOUNCEMENT_AUDIENCES = ("public", "customers", "staff", "all")
ANNOUNCEMENT_SEVERITIES = ("info", "warning", "urgent")
ANNOUNCEMENT_DISPLAY_TYPES = ("banner", "modal", "inbox_only")
BROADCAST_CHANNELS = ("in_app", "email")
BROADCAST_STATUSES = ("pending", "running", "completed", "failed")

SEVERITY_ORDER = {"urgent": 3, "warning": 2, "info": 1}


class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = db.Column(db.String(120), nullable=False)
    body = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), nullable=False, default="info")
    audience = db.Column(db.String(20), nullable=False, default="customers")
    display_as = db.Column(db.String(20), nullable=False, default="banner")
    starts_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    ends_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    dismissible = db.Column(db.Boolean, default=True, nullable=False)
    broadcast_at = db.Column(db.DateTime, nullable=True)
    created_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    created_by = db.relationship("User", foreign_keys=[created_by_id])
    broadcast_jobs = db.relationship(
        "BroadcastJob", back_populates="announcement", cascade="all, delete-orphan"
    )

    def to_dict(self, *, include_body: bool = True, job: "BroadcastJob | None" = None) -> dict:
        data = {
            "id": str(self.id),
            "title": self.title,
            "severity": self.severity,
            "audience": self.audience,
            "display_as": self.display_as,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
            "is_active": self.is_active,
            "dismissible": self.dismissible,
            "broadcast_at": self.broadcast_at.isoformat() if self.broadcast_at else None,
            "created_by_id": str(self.created_by_id) if self.created_by_id else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_body:
            data["body"] = self.body
        if job:
            data["latest_broadcast"] = job.to_dict()
        return data

    def to_banner_dict(self) -> dict:
        return {
            "id": str(self.id),
            "title": self.title,
            "body": self.body,
            "severity": self.severity,
            "display_as": self.display_as,
            "dismissible": self.dismissible,
        }


class AnnouncementDismissal(db.Model):
    __tablename__ = "announcement_dismissals"
    __table_args__ = (
        db.UniqueConstraint("user_id", "announcement_id", name="uq_announcement_dismissal"),
    )

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    announcement_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False
    )
    dismissed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User", backref="announcement_dismissals")
    announcement = db.relationship("Announcement", backref="dismissals")


class AnnouncementRead(db.Model):
    __tablename__ = "announcement_reads"
    __table_args__ = (
        db.UniqueConstraint("user_id", "announcement_id", name="uq_announcement_read"),
    )

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    announcement_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False
    )
    read_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User", backref="announcement_reads")
    announcement = db.relationship("Announcement", backref="reads")


class BroadcastJob(db.Model):
    __tablename__ = "broadcast_jobs"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    announcement_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False
    )
    channels = db.Column(db.JSON, nullable=False, default=list)
    status = db.Column(db.String(20), nullable=False, default="pending")
    sent_count = db.Column(db.Integer, default=0, nullable=False)
    failed_count = db.Column(db.Integer, default=0, nullable=False)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    announcement = db.relationship("Announcement", back_populates="broadcast_jobs")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "announcement_id": str(self.announcement_id),
            "channels": self.channels or [],
            "status": self.status,
            "sent_count": self.sent_count,
            "failed_count": self.failed_count,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat(),
        }

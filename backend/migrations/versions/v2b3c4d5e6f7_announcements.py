"""Add announcements and broadcast tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "v2b3c4d5e6f7"
down_revision = "u1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "announcements" not in tables:
        op.create_table(
            "announcements",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("title", sa.String(length=120), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("severity", sa.String(length=20), nullable=False),
            sa.Column("audience", sa.String(length=20), nullable=False),
            sa.Column("display_as", sa.String(length=20), nullable=False),
            sa.Column("starts_at", sa.DateTime(), nullable=False),
            sa.Column("ends_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("dismissible", sa.Boolean(), nullable=False),
            sa.Column("broadcast_at", sa.DateTime(), nullable=True),
            sa.Column("created_by_id", sa.UUID(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_announcements_starts_at", "announcements", ["starts_at"])
        op.create_index("ix_announcements_is_active", "announcements", ["is_active"])

    if "announcement_dismissals" not in tables:
        op.create_table(
            "announcement_dismissals",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("announcement_id", sa.UUID(), nullable=False),
            sa.Column("dismissed_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["announcement_id"], ["announcements.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "announcement_id", name="uq_announcement_dismissal"),
        )
        op.create_index(
            "ix_announcement_dismissals_user_id", "announcement_dismissals", ["user_id"]
        )

    if "announcement_reads" not in tables:
        op.create_table(
            "announcement_reads",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("announcement_id", sa.UUID(), nullable=False),
            sa.Column("read_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["announcement_id"], ["announcements.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "announcement_id", name="uq_announcement_read"),
        )
        op.create_index("ix_announcement_reads_user_id", "announcement_reads", ["user_id"])

    if "broadcast_jobs" not in tables:
        op.create_table(
            "broadcast_jobs",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("announcement_id", sa.UUID(), nullable=False),
            sa.Column("channels", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("sent_count", sa.Integer(), nullable=False),
            sa.Column("failed_count", sa.Integer(), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["announcement_id"], ["announcements.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "broadcast_jobs" in tables:
        op.drop_table("broadcast_jobs")
    if "announcement_reads" in tables:
        op.drop_index("ix_announcement_reads_user_id", table_name="announcement_reads")
        op.drop_table("announcement_reads")
    if "announcement_dismissals" in tables:
        op.drop_index("ix_announcement_dismissals_user_id", table_name="announcement_dismissals")
        op.drop_table("announcement_dismissals")
    if "announcements" in tables:
        op.drop_index("ix_announcements_is_active", table_name="announcements")
        op.drop_index("ix_announcements_starts_at", table_name="announcements")
        op.drop_table("announcements")

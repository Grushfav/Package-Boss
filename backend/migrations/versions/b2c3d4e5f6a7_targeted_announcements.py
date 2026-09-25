"""Add targeted announcement support."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "b2c3d4e5f6a7"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "announcements" in tables:
        cols = {col["name"] for col in inspector.get_columns("announcements")}
        if "target_mode" not in cols:
            op.add_column(
                "announcements",
                sa.Column("target_mode", sa.String(length=20), nullable=False, server_default="broadcast"),
            )
        if "target_criteria" not in cols:
            op.add_column(
                "announcements",
                sa.Column("target_criteria", sa.JSON(), nullable=True),
            )

    if "announcement_recipients" not in tables:
        op.create_table(
            "announcement_recipients",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("announcement_id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("package_ids", sa.JSON(), nullable=False),
            sa.Column("tracking_numbers", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["announcement_id"], ["announcements.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("announcement_id", "user_id", name="uq_announcement_recipient"),
        )
        op.create_index(
            "ix_announcement_recipients_user_id",
            "announcement_recipients",
            ["user_id"],
        )
        op.create_index(
            "ix_announcement_recipients_announcement_id",
            "announcement_recipients",
            ["announcement_id"],
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "announcement_recipients" in tables:
        op.drop_index("ix_announcement_recipients_announcement_id", table_name="announcement_recipients")
        op.drop_index("ix_announcement_recipients_user_id", table_name="announcement_recipients")
        op.drop_table("announcement_recipients")

    if "announcements" in tables:
        cols = {col["name"] for col in inspector.get_columns("announcements")}
        if "target_criteria" in cols:
            op.drop_column("announcements", "target_criteria")
        if "target_mode" in cols:
            op.drop_column("announcements", "target_mode")

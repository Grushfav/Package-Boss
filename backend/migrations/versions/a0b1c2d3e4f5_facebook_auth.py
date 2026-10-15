"""Add facebook_id and data deletion request tracking."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "a0b1c2d3e4f5"
down_revision = "b9c0d1e2f3a4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "users" in tables:
        columns = {col["name"] for col in inspector.get_columns("users")}
        if "facebook_id" not in columns:
            op.add_column("users", sa.Column("facebook_id", sa.String(length=255), nullable=True))
            op.create_index("ix_users_facebook_id", "users", ["facebook_id"], unique=True)

    if "data_deletion_requests" not in tables:
        op.create_table(
            "data_deletion_requests",
            sa.Column("confirmation_code", sa.String(length=64), primary_key=True),
            sa.Column("facebook_user_id", sa.String(length=255), nullable=True, index=True),
            sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="completed"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("notes", sa.String(length=500), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "data_deletion_requests" in tables:
        op.drop_table("data_deletion_requests")

    if "users" in tables:
        columns = {col["name"] for col in inspector.get_columns("users")}
        if "facebook_id" in columns:
            op.drop_index("ix_users_facebook_id", table_name="users")
            op.drop_column("users", "facebook_id")

"""Add app_settings table for admin toggles."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "x4d5e6f7a8b9"
down_revision = "w3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "app_settings" not in inspector.get_table_names():
        op.create_table(
            "app_settings",
            sa.Column("key", sa.String(length=100), nullable=False),
            sa.Column("value", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("updated_by_id", sa.UUID(), nullable=True),
            sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("key"),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "app_settings" in inspector.get_table_names():
        op.drop_table("app_settings")

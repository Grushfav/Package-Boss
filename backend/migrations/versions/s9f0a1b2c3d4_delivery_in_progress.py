"""Add in-progress tracking for delivery requests."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "s9f0a1b2c3d4"
down_revision = "r8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "delivery_requests" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("delivery_requests")}
    if "in_progress_at" not in cols:
        op.add_column("delivery_requests", sa.Column("in_progress_at", sa.DateTime(), nullable=True))
    if "in_progress_by_id" not in cols:
        op.add_column("delivery_requests", sa.Column("in_progress_by_id", sa.UUID(), nullable=True))
        op.create_foreign_key(
            "fk_delivery_requests_in_progress_by_id",
            "delivery_requests",
            "users",
            ["in_progress_by_id"],
            ["id"],
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "delivery_requests" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("delivery_requests")}
    if "in_progress_by_id" in cols:
        op.drop_constraint("fk_delivery_requests_in_progress_by_id", "delivery_requests", type_="foreignkey")
        op.drop_column("delivery_requests", "in_progress_by_id")
    if "in_progress_at" in cols:
        op.drop_column("delivery_requests", "in_progress_at")

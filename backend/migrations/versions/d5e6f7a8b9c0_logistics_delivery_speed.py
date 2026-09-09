"""Add delivery_speed to logistics_jobs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "d5e6f7a8b9c0"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}
    if "delivery_speed" not in cols:
        op.add_column(
            "logistics_jobs",
            sa.Column("delivery_speed", sa.String(length=20), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}
    if "delivery_speed" in cols:
        op.drop_column("logistics_jobs", "delivery_speed")

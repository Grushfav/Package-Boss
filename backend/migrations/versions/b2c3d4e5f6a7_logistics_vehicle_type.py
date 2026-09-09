"""Add vehicle_type to logistics_jobs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}
    if "vehicle_type" not in cols:
        op.add_column(
            "logistics_jobs",
            sa.Column("vehicle_type", sa.String(length=20), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}
    if "vehicle_type" in cols:
        op.drop_column("logistics_jobs", "vehicle_type")

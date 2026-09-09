"""Add driver assignment fields to logistics_jobs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "f7a8b9c0d1e2"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    if "driver_name" not in cols:
        op.add_column("logistics_jobs", sa.Column("driver_name", sa.String(length=160), nullable=True))
    if "driver_contact_number" not in cols:
        op.add_column(
            "logistics_jobs",
            sa.Column("driver_contact_number", sa.String(length=20), nullable=True),
        )
    if "driver_confirmed_at" not in cols:
        op.add_column("logistics_jobs", sa.Column("driver_confirmed_at", sa.DateTime(), nullable=True))
    if "driver_confirmed_by_id" not in cols:
        op.add_column("logistics_jobs", sa.Column("driver_confirmed_by_id", sa.UUID(), nullable=True))
        op.create_foreign_key(
            "fk_logistics_jobs_driver_confirmed_by_id",
            "logistics_jobs",
            "users",
            ["driver_confirmed_by_id"],
            ["id"],
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    if "driver_confirmed_by_id" in cols:
        op.drop_constraint("fk_logistics_jobs_driver_confirmed_by_id", "logistics_jobs", type_="foreignkey")
        op.drop_column("logistics_jobs", "driver_confirmed_by_id")
    if "driver_confirmed_at" in cols:
        op.drop_column("logistics_jobs", "driver_confirmed_at")
    if "driver_contact_number" in cols:
        op.drop_column("logistics_jobs", "driver_contact_number")
    if "driver_name" in cols:
        op.drop_column("logistics_jobs", "driver_name")

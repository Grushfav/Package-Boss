"""Add logistics job pickup/transit tracking columns and migrate statuses."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    if "picked_up_at" not in cols:
        op.add_column("logistics_jobs", sa.Column("picked_up_at", sa.DateTime(), nullable=True))
    if "picked_up_by_id" not in cols:
        op.add_column("logistics_jobs", sa.Column("picked_up_by_id", sa.UUID(), nullable=True))
        op.create_foreign_key(
            "fk_logistics_jobs_picked_up_by_id",
            "logistics_jobs",
            "users",
            ["picked_up_by_id"],
            ["id"],
        )
    if "in_transit_at" not in cols:
        op.add_column("logistics_jobs", sa.Column("in_transit_at", sa.DateTime(), nullable=True))
    if "in_transit_by_id" not in cols:
        op.add_column("logistics_jobs", sa.Column("in_transit_by_id", sa.UUID(), nullable=True))
        op.create_foreign_key(
            "fk_logistics_jobs_in_transit_by_id",
            "logistics_jobs",
            "users",
            ["in_transit_by_id"],
            ["id"],
        )

    op.execute(
        """
        UPDATE logistics_jobs
        SET status = 'picked_up',
            picked_up_at = in_progress_at,
            picked_up_by_id = in_progress_by_id
        WHERE status = 'in_progress'
        """
    )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    op.execute(
        """
        UPDATE logistics_jobs
        SET status = 'in_progress',
            in_progress_at = picked_up_at,
            in_progress_by_id = picked_up_by_id
        WHERE status IN ('picked_up', 'in_transit')
        """
    )

    if "in_transit_by_id" in cols:
        op.drop_constraint("fk_logistics_jobs_in_transit_by_id", "logistics_jobs", type_="foreignkey")
        op.drop_column("logistics_jobs", "in_transit_by_id")
    if "in_transit_at" in cols:
        op.drop_column("logistics_jobs", "in_transit_at")
    if "picked_up_by_id" in cols:
        op.drop_constraint("fk_logistics_jobs_picked_up_by_id", "logistics_jobs", type_="foreignkey")
        op.drop_column("logistics_jobs", "picked_up_by_id")
    if "picked_up_at" in cols:
        op.drop_column("logistics_jobs", "picked_up_at")

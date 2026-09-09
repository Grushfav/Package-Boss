"""Add clerk assignment and rejection fields to logistics_jobs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "h9c0d1e2f3a4"
down_revision = "g8b9c0d1e2f3"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    if "assigned_clerk_id" not in cols:
        op.add_column("logistics_jobs", sa.Column("assigned_clerk_id", sa.UUID(), nullable=True))
        op.create_foreign_key(
            "fk_logistics_jobs_assigned_clerk_id",
            "logistics_jobs",
            "users",
            ["assigned_clerk_id"],
            ["id"],
        )
    if "assigned_at" not in cols:
        op.add_column("logistics_jobs", sa.Column("assigned_at", sa.DateTime(), nullable=True))
    if "assigned_by_id" not in cols:
        op.add_column("logistics_jobs", sa.Column("assigned_by_id", sa.UUID(), nullable=True))
        op.create_foreign_key(
            "fk_logistics_jobs_assigned_by_id",
            "logistics_jobs",
            "users",
            ["assigned_by_id"],
            ["id"],
        )
    if "rejected_at" not in cols:
        op.add_column("logistics_jobs", sa.Column("rejected_at", sa.DateTime(), nullable=True))
    if "rejected_by_id" not in cols:
        op.add_column("logistics_jobs", sa.Column("rejected_by_id", sa.UUID(), nullable=True))
        op.create_foreign_key(
            "fk_logistics_jobs_rejected_by_id",
            "logistics_jobs",
            "users",
            ["rejected_by_id"],
            ["id"],
        )
    if "rejection_reason" not in cols:
        op.add_column("logistics_jobs", sa.Column("rejection_reason", sa.String(length=500), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    if "rejection_reason" in cols:
        op.drop_column("logistics_jobs", "rejection_reason")
    if "rejected_by_id" in cols:
        op.drop_constraint("fk_logistics_jobs_rejected_by_id", "logistics_jobs", type_="foreignkey")
        op.drop_column("logistics_jobs", "rejected_by_id")
    if "rejected_at" in cols:
        op.drop_column("logistics_jobs", "rejected_at")
    if "assigned_by_id" in cols:
        op.drop_constraint("fk_logistics_jobs_assigned_by_id", "logistics_jobs", type_="foreignkey")
        op.drop_column("logistics_jobs", "assigned_by_id")
    if "assigned_at" in cols:
        op.drop_column("logistics_jobs", "assigned_at")
    if "assigned_clerk_id" in cols:
        op.drop_constraint("fk_logistics_jobs_assigned_clerk_id", "logistics_jobs", type_="foreignkey")
        op.drop_column("logistics_jobs", "assigned_clerk_id")

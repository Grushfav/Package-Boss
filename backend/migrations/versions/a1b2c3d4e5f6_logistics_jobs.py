"""Add logistics_jobs table for islandwide local delivery."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "a1b2c3d4e5f6"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" in inspector.get_table_names():
        return

    op.create_table(
        "logistics_jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("reference", sa.String(length=20), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("pickup_address_id", sa.UUID(), nullable=False),
        sa.Column("dropoff_address_id", sa.UUID(), nullable=False),
        sa.Column("item_description", sa.String(length=500), nullable=False),
        sa.Column("weight_lbs", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("quoted_fee_jmd", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("fee_pending_quote", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
        sa.Column("in_progress_at", sa.DateTime(), nullable=True),
        sa.Column("in_progress_by_id", sa.UUID(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("completed_by_id", sa.UUID(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["completed_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["dropoff_address_id"], ["delivery_addresses.id"]),
        sa.ForeignKeyConstraint(["in_progress_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["pickup_address_id"], ["delivery_addresses.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("reference"),
    )
    op.create_index(op.f("ix_logistics_jobs_customer_id"), "logistics_jobs", ["customer_id"], unique=False)
    op.create_index(op.f("ix_logistics_jobs_reference"), "logistics_jobs", ["reference"], unique=True)
    op.create_index(op.f("ix_logistics_jobs_status"), "logistics_jobs", ["status"], unique=False)


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    op.drop_index(op.f("ix_logistics_jobs_status"), table_name="logistics_jobs")
    op.drop_index(op.f("ix_logistics_jobs_reference"), table_name="logistics_jobs")
    op.drop_index(op.f("ix_logistics_jobs_customer_id"), table_name="logistics_jobs")
    op.drop_table("logistics_jobs")

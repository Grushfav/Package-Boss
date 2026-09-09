"""Add customer receipt confirmation to logistics_jobs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "i0d1e2f3a4b5"
down_revision = "h9c0d1e2f3a4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    if "customer_receipt_confirmed_at" not in cols:
        op.add_column(
            "logistics_jobs",
            sa.Column("customer_receipt_confirmed_at", sa.DateTime(), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    if "customer_receipt_confirmed_at" in cols:
        op.drop_column("logistics_jobs", "customer_receipt_confirmed_at")

"""Add payment_method to logistics_jobs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "g8b9c0d1e2f3"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    if "payment_method" not in cols:
        op.add_column(
            "logistics_jobs",
            sa.Column("payment_method", sa.String(length=20), nullable=False, server_default="cash"),
        )
        op.alter_column("logistics_jobs", "payment_method", server_default=None)


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "logistics_jobs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("logistics_jobs")}

    if "payment_method" in cols:
        op.drop_column("logistics_jobs", "payment_method")

"""Add processing_fee_jmd to payment checkouts."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "y5e6f7a8b9c0"
down_revision = "x4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "payment_checkouts" in tables:
        checkout_cols = {c["name"] for c in inspector.get_columns("payment_checkouts")}
        if "processing_fee_jmd" not in checkout_cols:
            op.add_column(
                "payment_checkouts",
                sa.Column("processing_fee_jmd", sa.Numeric(precision=12, scale=2), nullable=True),
            )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "payment_checkouts" in tables:
        checkout_cols = {c["name"] for c in inspector.get_columns("payment_checkouts")}
        if "processing_fee_jmd" in checkout_cols:
            op.drop_column("payment_checkouts", "processing_fee_jmd")

"""Add include_delivery_fee to bank transfer proofs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "z6f7a8b9c0d1"
down_revision = "y5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "bank_transfer_proofs" in tables:
        cols = {c["name"] for c in inspector.get_columns("bank_transfer_proofs")}
        if "include_delivery_fee" not in cols:
            op.add_column(
                "bank_transfer_proofs",
                sa.Column("include_delivery_fee", sa.Boolean(), nullable=False, server_default=sa.false()),
            )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "bank_transfer_proofs" in tables:
        cols = {c["name"] for c in inspector.get_columns("bank_transfer_proofs")}
        if "include_delivery_fee" in cols:
            op.drop_column("bank_transfer_proofs", "include_delivery_fee")

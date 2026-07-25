"""Add sender_bank to bank transfer proofs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "u1a2b3c4d5e6"
down_revision = "t0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "bank_transfer_proofs" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("bank_transfer_proofs")}
    if "sender_bank" not in columns:
        op.add_column(
            "bank_transfer_proofs",
            sa.Column("sender_bank", sa.String(length=80), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "bank_transfer_proofs" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("bank_transfer_proofs")}
    if "sender_bank" in columns:
        op.drop_column("bank_transfer_proofs", "sender_bank")

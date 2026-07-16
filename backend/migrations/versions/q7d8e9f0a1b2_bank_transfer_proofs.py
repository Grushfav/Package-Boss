"""Add bank transfer proof uploads from customers."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "q7d8e9f0a1b2"
down_revision = "p6c7d8e9f0a1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "bank_transfer_proofs" not in tables:
        op.create_table(
            "bank_transfer_proofs",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("customer_id", sa.UUID(), nullable=False),
            sa.Column("proof_object_key", sa.String(length=500), nullable=False),
            sa.Column("transfer_reference", sa.String(length=100), nullable=True),
            sa.Column("amount_jmd", sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column("notes", sa.String(length=500), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("submitted_at", sa.DateTime(), nullable=False),
            sa.Column("reviewed_at", sa.DateTime(), nullable=True),
            sa.Column("reviewed_by_id", sa.UUID(), nullable=True),
            sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_bank_transfer_proofs_customer_id"),
            "bank_transfer_proofs",
            ["customer_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_bank_transfer_proofs_status"),
            "bank_transfer_proofs",
            ["status"],
            unique=False,
        )

    if "bank_transfer_proof_packages" not in tables:
        op.create_table(
            "bank_transfer_proof_packages",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("proof_id", sa.UUID(), nullable=False),
            sa.Column("package_id", sa.UUID(), nullable=False),
            sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
            sa.ForeignKeyConstraint(["proof_id"], ["bank_transfer_proofs.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_bank_transfer_proof_packages_proof_id"),
            "bank_transfer_proof_packages",
            ["proof_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_bank_transfer_proof_packages_package_id"),
            "bank_transfer_proof_packages",
            ["package_id"],
            unique=False,
        )


def downgrade():
    op.drop_index(
        op.f("ix_bank_transfer_proof_packages_package_id"),
        table_name="bank_transfer_proof_packages",
    )
    op.drop_index(
        op.f("ix_bank_transfer_proof_packages_proof_id"),
        table_name="bank_transfer_proof_packages",
    )
    op.drop_table("bank_transfer_proof_packages")
    op.drop_index(op.f("ix_bank_transfer_proofs_status"), table_name="bank_transfer_proofs")
    op.drop_index(op.f("ix_bank_transfer_proofs_customer_id"), table_name="bank_transfer_proofs")
    op.drop_table("bank_transfer_proofs")

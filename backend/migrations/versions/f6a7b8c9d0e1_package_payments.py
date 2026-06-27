"""Package payments and bill invoices.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""

import sqlalchemy as sa
from alembic import op

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "package_payments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("package_id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("invoice_number", sa.String(length=40), nullable=False),
        sa.Column("amount_usd", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("method", sa.String(length=30), nullable=False),
        sa.Column("reference", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("recorded_by_id", sa.UUID(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
        sa.ForeignKeyConstraint(["recorded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_number"),
    )
    op.create_index(
        op.f("ix_package_payments_invoice_number"),
        "package_payments",
        ["invoice_number"],
        unique=True,
    )
    op.create_index(
        op.f("ix_package_payments_package_id"),
        "package_payments",
        ["package_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_package_payments_customer_id"),
        "package_payments",
        ["customer_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_package_payments_customer_id"), table_name="package_payments")
    op.drop_index(op.f("ix_package_payments_package_id"), table_name="package_payments")
    op.drop_index(op.f("ix_package_payments_invoice_number"), table_name="package_payments")
    op.drop_table("package_payments")

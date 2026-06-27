"""JMD billing columns and multi-package payment checkouts.

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
"""

import sqlalchemy as sa
from alembic import op

revision = "g7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None

JMD_PER_USD = 160

BILLING_RENAMES = [
    ("estimated_freight_usd", "estimated_freight_jmd"),
    ("duties_usd", "duties_jmd"),
    ("handling_usd", "handling_jmd"),
    ("other_fees_usd", "other_fees_jmd"),
    ("total_due_usd", "total_due_jmd"),
]


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    for old, new in BILLING_RENAMES:
        if old in [c["name"] for c in inspector.get_columns("packages")]:
            op.alter_column("packages", old, new_column_name=new)

    for col in ("estimated_freight_jmd", "duties_jmd", "handling_jmd", "other_fees_jmd", "total_due_jmd"):
        op.execute(
            sa.text(
                f"UPDATE packages SET {col} = ROUND({col} * :rate) "
                f"WHERE {col} IS NOT NULL"
            ).bindparams(rate=JMD_PER_USD)
        )

    if "package_payments" in tables:
        op.drop_index("ix_package_payments_customer_id", table_name="package_payments")
        op.drop_index("ix_package_payments_package_id", table_name="package_payments")
        op.drop_index("ix_package_payments_invoice_number", table_name="package_payments")
        op.drop_table("package_payments")

    op.create_table(
        "payment_checkouts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("invoice_number", sa.String(length=40), nullable=False),
        sa.Column("total_jmd", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("method", sa.String(length=30), nullable=False),
        sa.Column("reference", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("recorded_by_id", sa.UUID(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["recorded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_number"),
    )
    op.create_index(
        op.f("ix_payment_checkouts_invoice_number"),
        "payment_checkouts",
        ["invoice_number"],
        unique=True,
    )
    op.create_index(
        op.f("ix_payment_checkouts_customer_id"),
        "payment_checkouts",
        ["customer_id"],
        unique=False,
    )

    op.create_table(
        "payment_checkout_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("checkout_id", sa.UUID(), nullable=False),
        sa.Column("package_id", sa.UUID(), nullable=False),
        sa.Column("amount_jmd", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["checkout_id"], ["payment_checkouts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("package_id"),
    )
    op.create_index(
        op.f("ix_payment_checkout_items_checkout_id"),
        "payment_checkout_items",
        ["checkout_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_payment_checkout_items_checkout_id"), table_name="payment_checkout_items")
    op.drop_table("payment_checkout_items")
    op.drop_index(op.f("ix_payment_checkouts_customer_id"), table_name="payment_checkouts")
    op.drop_index(op.f("ix_payment_checkouts_invoice_number"), table_name="payment_checkouts")
    op.drop_table("payment_checkouts")

    for col in ("estimated_freight_jmd", "duties_jmd", "handling_jmd", "other_fees_jmd", "total_due_jmd"):
        op.execute(
            sa.text(
                f"UPDATE packages SET {col} = ROUND({col} / :rate, 2) "
                f"WHERE {col} IS NOT NULL"
            ).bindparams(rate=JMD_PER_USD)
        )

    for old, new in reversed(BILLING_RENAMES):
        op.alter_column("packages", new, new_column_name=old)

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

"""Billing, invoice workflow, and delivery addresses.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""

import sqlalchemy as sa
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "delivery_addresses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("recipient_name", sa.String(length=160), nullable=True),
        sa.Column("line1", sa.String(length=255), nullable=False),
        sa.Column("line2", sa.String(length=255), nullable=True),
        sa.Column("community", sa.String(length=100), nullable=True),
        sa.Column("parish", sa.String(length=50), nullable=False),
        sa.Column("contact_number", sa.String(length=20), nullable=False),
        sa.Column("delivery_notes", sa.String(length=500), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("delivery_addresses", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_delivery_addresses_customer_id"), ["customer_id"], unique=False
        )

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "whatsapp_opt_in" not in user_columns:
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("whatsapp_opt_in", sa.Boolean(), nullable=False, server_default=sa.false())
            )

    package_columns = {col["name"] for col in inspector.get_columns("packages")}
    new_package_columns = [
        ("estimated_freight_usd", sa.Numeric(precision=10, scale=2)),
        ("duties_usd", sa.Numeric(precision=10, scale=2)),
        ("handling_usd", sa.Numeric(precision=10, scale=2)),
        ("other_fees_usd", sa.Numeric(precision=10, scale=2)),
        ("total_due_usd", sa.Numeric(precision=10, scale=2)),
        ("billing_status", sa.String(length=20)),
        ("invoice_status", sa.String(length=20)),
        ("invoice_object_key", sa.String(length=500)),
        ("declared_value_usd", sa.Numeric(precision=10, scale=2)),
        ("invoice_requested_at", sa.DateTime()),
        ("invoice_requested_via", sa.String(length=20)),
        ("invoice_request_note", sa.String(length=500)),
        ("invoice_received_at", sa.DateTime()),
        ("delivery_address_id", sa.UUID()),
    ]
    with op.batch_alter_table("packages", schema=None) as batch_op:
        for name, col_type in new_package_columns:
            if name not in package_columns:
                batch_op.add_column(sa.Column(name, col_type, nullable=True))
        if "delivery_address_id" not in package_columns:
            batch_op.create_foreign_key(
                "fk_packages_delivery_address_id",
                "delivery_addresses",
                ["delivery_address_id"],
                ["id"],
            )

    op.execute(
        """
        UPDATE packages
        SET estimated_freight_usd = shipping_cost_usd
        WHERE estimated_freight_usd IS NULL AND shipping_cost_usd IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE packages
        SET billing_status = 'pending'
        WHERE billing_status IS NULL
        """
    )
    op.execute(
        """
        UPDATE packages
        SET invoice_status = 'pending'
        WHERE invoice_status IS NULL
        """
    )


def downgrade():
    with op.batch_alter_table("packages", schema=None) as batch_op:
        batch_op.drop_constraint("fk_packages_delivery_address_id", type_="foreignkey")
        batch_op.drop_column("delivery_address_id")
        batch_op.drop_column("invoice_received_at")
        batch_op.drop_column("invoice_request_note")
        batch_op.drop_column("invoice_requested_via")
        batch_op.drop_column("invoice_requested_at")
        batch_op.drop_column("declared_value_usd")
        batch_op.drop_column("invoice_object_key")
        batch_op.drop_column("invoice_status")
        batch_op.drop_column("billing_status")
        batch_op.drop_column("total_due_usd")
        batch_op.drop_column("other_fees_usd")
        batch_op.drop_column("handling_usd")
        batch_op.drop_column("duties_usd")
        batch_op.drop_column("estimated_freight_usd")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("whatsapp_opt_in")

    with op.batch_alter_table("delivery_addresses", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_delivery_addresses_customer_id"))

    op.drop_table("delivery_addresses")

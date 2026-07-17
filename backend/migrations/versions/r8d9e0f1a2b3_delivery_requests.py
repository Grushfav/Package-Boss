"""Add customer delivery requests and checkout delivery fee."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "r8d9e0f1a2b3"
down_revision = "q7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "delivery_requests" not in tables:
        op.create_table(
            "delivery_requests",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("customer_id", sa.UUID(), nullable=False),
            sa.Column("delivery_address_id", sa.UUID(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("delivery_fee_jmd", sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column("notes", sa.String(length=500), nullable=True),
            sa.Column("requested_at", sa.DateTime(), nullable=False),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("completed_by_id", sa.UUID(), nullable=True),
            sa.Column("cancelled_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["completed_by_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["delivery_address_id"], ["delivery_addresses.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_delivery_requests_customer_id"),
            "delivery_requests",
            ["customer_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_delivery_requests_status"),
            "delivery_requests",
            ["status"],
            unique=False,
        )

    if "delivery_request_packages" not in tables:
        op.create_table(
            "delivery_request_packages",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("delivery_request_id", sa.UUID(), nullable=False),
            sa.Column("package_id", sa.UUID(), nullable=False),
            sa.ForeignKeyConstraint(["delivery_request_id"], ["delivery_requests.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("package_id"),
        )
        op.create_index(
            op.f("ix_delivery_request_packages_delivery_request_id"),
            "delivery_request_packages",
            ["delivery_request_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_delivery_request_packages_package_id"),
            "delivery_request_packages",
            ["package_id"],
            unique=False,
        )

    if "payment_checkouts" in tables:
        checkout_cols = {c["name"] for c in inspector.get_columns("payment_checkouts")}
        if "delivery_request_id" not in checkout_cols:
            op.add_column(
                "payment_checkouts",
                sa.Column("delivery_request_id", sa.UUID(), nullable=True),
            )
            op.create_foreign_key(
                "fk_payment_checkouts_delivery_request_id",
                "payment_checkouts",
                "delivery_requests",
                ["delivery_request_id"],
                ["id"],
            )
        if "delivery_fee_jmd" not in checkout_cols:
            op.add_column(
                "payment_checkouts",
                sa.Column("delivery_fee_jmd", sa.Numeric(precision=12, scale=2), nullable=True),
            )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "payment_checkouts" in tables:
        checkout_cols = {c["name"] for c in inspector.get_columns("payment_checkouts")}
        if "delivery_fee_jmd" in checkout_cols:
            op.drop_column("payment_checkouts", "delivery_fee_jmd")
        if "delivery_request_id" in checkout_cols:
            op.drop_constraint("fk_payment_checkouts_delivery_request_id", "payment_checkouts", type_="foreignkey")
            op.drop_column("payment_checkouts", "delivery_request_id")

    if "delivery_request_packages" in tables:
        op.drop_index(op.f("ix_delivery_request_packages_package_id"), table_name="delivery_request_packages")
        op.drop_index(
            op.f("ix_delivery_request_packages_delivery_request_id"),
            table_name="delivery_request_packages",
        )
        op.drop_table("delivery_request_packages")

    if "delivery_requests" in tables:
        op.drop_index(op.f("ix_delivery_requests_status"), table_name="delivery_requests")
        op.drop_index(op.f("ix_delivery_requests_customer_id"), table_name="delivery_requests")
        op.drop_table("delivery_requests")

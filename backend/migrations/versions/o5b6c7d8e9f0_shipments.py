"""Add shipments table and package shipment_id."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "o5b6c7d8e9f0"
down_revision = "n4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "shipments" not in tables:
        op.create_table(
            "shipments",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("reference", sa.String(length=100), nullable=False),
            sa.Column("departure_date", sa.Date(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("created_by_id", sa.UUID(), nullable=True),
            sa.Column("departed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_shipments_status"), "shipments", ["status"], unique=False)

    package_columns = {col["name"] for col in inspector.get_columns("packages")}
    if "shipment_id" not in package_columns:
        with op.batch_alter_table("packages", schema=None) as batch_op:
            batch_op.add_column(sa.Column("shipment_id", sa.UUID(), nullable=True))
            batch_op.create_foreign_key(
                "fk_packages_shipment_id",
                "shipments",
                ["shipment_id"],
                ["id"],
            )
            batch_op.create_index(
                batch_op.f("ix_packages_shipment_id"), ["shipment_id"], unique=False
            )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    package_columns = {col["name"] for col in inspector.get_columns("packages")}
    if "shipment_id" in package_columns:
        with op.batch_alter_table("packages", schema=None) as batch_op:
            batch_op.drop_index(batch_op.f("ix_packages_shipment_id"))
            batch_op.drop_constraint("fk_packages_shipment_id", type_="foreignkey")
            batch_op.drop_column("shipment_id")

    if "shipments" in inspector.get_table_names():
        op.drop_index(op.f("ix_shipments_status"), table_name="shipments")
        op.drop_table("shipments")

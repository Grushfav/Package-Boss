"""Add receive_batches table and package receive_batch_id."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "p6c7d8e9f0a1"
down_revision = "o5b6c7d8e9f0"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "receive_batches" not in tables:
        op.create_table(
            "receive_batches",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("batch_code", sa.String(length=20), nullable=False),
            sa.Column("reference", sa.String(length=100), nullable=False),
            sa.Column("receive_date", sa.Date(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("created_by_id", sa.UUID(), nullable=True),
            sa.Column("closed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("batch_code"),
        )
        op.create_index(
            op.f("ix_receive_batches_status"), "receive_batches", ["status"], unique=False
        )
        op.create_index(
            op.f("ix_receive_batches_batch_code"), "receive_batches", ["batch_code"], unique=True
        )

    package_columns = {col["name"] for col in inspector.get_columns("packages")}
    if "receive_batch_id" not in package_columns:
        with op.batch_alter_table("packages", schema=None) as batch_op:
            batch_op.add_column(sa.Column("receive_batch_id", sa.UUID(), nullable=True))
            batch_op.create_foreign_key(
                "fk_packages_receive_batch_id",
                "receive_batches",
                ["receive_batch_id"],
                ["id"],
            )
            batch_op.create_index(
                batch_op.f("ix_packages_receive_batch_id"), ["receive_batch_id"], unique=False
            )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    package_columns = {col["name"] for col in inspector.get_columns("packages")}
    if "receive_batch_id" in package_columns:
        with op.batch_alter_table("packages", schema=None) as batch_op:
            batch_op.drop_index(batch_op.f("ix_packages_receive_batch_id"))
            batch_op.drop_constraint("fk_packages_receive_batch_id", type_="foreignkey")
            batch_op.drop_column("receive_batch_id")

    if "receive_batches" in inspector.get_table_names():
        op.drop_index(op.f("ix_receive_batches_batch_code"), table_name="receive_batches")
        op.drop_index(op.f("ix_receive_batches_status"), table_name="receive_batches")
        op.drop_table("receive_batches")

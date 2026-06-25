"""Authorized pickup persons.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""

import sqlalchemy as sa
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "authorized_pickup_persons",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("relationship", sa.String(length=30), nullable=False),
        sa.Column("contact_number", sa.String(length=20), nullable=False),
        sa.Column("id_type", sa.String(length=30), nullable=False),
        sa.Column("id_last_four", sa.String(length=4), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("authorized_pickup_persons", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_authorized_pickup_persons_customer_id"),
            ["customer_id"],
            unique=False,
        )


def downgrade():
    with op.batch_alter_table("authorized_pickup_persons", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_authorized_pickup_persons_customer_id"))
    op.drop_table("authorized_pickup_persons")

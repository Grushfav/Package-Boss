"""Add label_printed_at to packages

Revision ID: b1c2d3e4f5a6
Revises: 8004a576854d
Create Date: 2026-06-14 02:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "b1c2d3e4f5a6"
down_revision = "8004a576854d"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("packages")}
    if "label_printed_at" not in columns:
        with op.batch_alter_table("packages", schema=None) as batch_op:
            batch_op.add_column(sa.Column("label_printed_at", sa.DateTime(), nullable=True))

    op.execute("UPDATE users SET role = 'clerk' WHERE role = 'staff'")


def downgrade():
    op.execute("UPDATE users SET role = 'staff' WHERE role = 'clerk'")
    with op.batch_alter_table("packages", schema=None) as batch_op:
        batch_op.drop_column("label_printed_at")

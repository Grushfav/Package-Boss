"""Add fulfillment_type to delivery requests (pickup vs home delivery)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "a8b9c0d1e2f3"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("delivery_requests")}

    if "fulfillment_type" not in cols:
        op.add_column(
            "delivery_requests",
            sa.Column("fulfillment_type", sa.String(length=20), nullable=False, server_default="delivery"),
        )
        op.alter_column("delivery_requests", "fulfillment_type", server_default=None)

    if "delivery_address_id" in cols:
        with op.batch_alter_table("delivery_requests") as batch_op:
            batch_op.alter_column("delivery_address_id", existing_type=sa.UUID(), nullable=True)


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("delivery_requests")}

    if "fulfillment_type" in cols:
        op.drop_column("delivery_requests", "fulfillment_type")

    if "delivery_address_id" in cols:
        with op.batch_alter_table("delivery_requests") as batch_op:
            batch_op.alter_column("delivery_address_id", existing_type=sa.UUID(), nullable=False)

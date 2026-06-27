"""Simplify package statuses and reset premature billing.

Revision ID: i9c0d1e2f3a4
Revises: h8c9d0e1f2a3
"""

import sqlalchemy as sa
from alembic import op

revision = "i9c0d1e2f3a4"
down_revision = "h8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("UPDATE packages SET status = 'received' WHERE status IN ('received_miami', 'processing')"))
    op.execute(sa.text("UPDATE packages SET status = 'customs' WHERE status = 'arrived_kingston'"))
    op.execute(sa.text("UPDATE packages SET status = 'ready_for_pickup' WHERE status = 'out_for_delivery'"))

    op.execute(
        sa.text(
            """
            UPDATE packages
            SET billing_status = 'pending', total_due_jmd = NULL
            WHERE status IN ('awaiting_receipt', 'received', 'in_transit', 'customs')
              AND billing_status = 'ready'
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE package_events SET status = 'received'
            WHERE status IN ('received_miami', 'processing')
            """
        )
    )
    op.execute(sa.text("UPDATE package_events SET status = 'customs' WHERE status = 'arrived_kingston'"))
    op.execute(
        sa.text("UPDATE package_events SET status = 'ready_for_pickup' WHERE status = 'out_for_delivery'")
    )


def downgrade():
    op.execute(sa.text("UPDATE packages SET status = 'received_miami' WHERE status = 'received'"))
    op.execute(sa.text("UPDATE packages SET status = 'arrived_kingston' WHERE status = 'customs'"))
    op.execute(sa.text("UPDATE packages SET status = 'out_for_delivery' WHERE status = 'ready_for_pickup'"))

    op.execute(
        sa.text("UPDATE package_events SET status = 'received_miami' WHERE status = 'received'")
    )
    op.execute(sa.text("UPDATE package_events SET status = 'arrived_kingston' WHERE status = 'customs'"))
    op.execute(
        sa.text("UPDATE package_events SET status = 'out_for_delivery' WHERE status = 'ready_for_pickup'")
    )

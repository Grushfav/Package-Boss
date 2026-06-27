"""Backfill shipping-only bills for packages received before auto-publish.

Revision ID: h8c9d0e1f2a3
Revises: g7b8c9d0e1f2
"""

import sqlalchemy as sa
from alembic import op

revision = "h8c9d0e1f2a3"
down_revision = "g7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            """
            UPDATE packages
            SET total_due_jmd = (
                COALESCE(estimated_freight_jmd, 0)
                + COALESCE(duties_jmd, 0)
                + COALESCE(handling_jmd, 0)
                + COALESCE(other_fees_jmd, 0)
            ),
            billing_status = 'ready'
            WHERE billing_status = 'pending'
              AND status != 'unidentified'
              AND estimated_freight_jmd IS NOT NULL
              AND estimated_freight_jmd > 0
            """
        )
    )


def downgrade():
    op.execute(
        sa.text(
            """
            UPDATE packages
            SET billing_status = 'pending'
            WHERE billing_status = 'ready'
              AND duties_jmd IS NULL
              AND handling_jmd IS NULL
              AND other_fees_jmd IS NULL
            """
        )
    )

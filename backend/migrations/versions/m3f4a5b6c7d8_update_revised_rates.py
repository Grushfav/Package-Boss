"""Apply updated tier rates from frontend/Revised Rates (1).xlsx.

Revision ID: m3f4a5b6c7d8
Revises: l2f3a4b5c6d7
"""

revision = "m3f4a5b6c7d8"
down_revision = "l2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade():
    from app.seeds.rate_tiers import replace_rate_tiers

    replace_rate_tiers()


def downgrade():
    pass

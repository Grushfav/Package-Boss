"""Apply revised tier rates (1–50 lbs) from Revised Rates.xlsx.

Revision ID: j0d1e2f3a4b5
Revises: i9c0d1e2f3a4
"""

revision = "j0d1e2f3a4b5"
down_revision = "i9c0d1e2f3a4"
branch_labels = None
depends_on = None


def upgrade():
    from app.seeds.rate_tiers import replace_rate_tiers

    replace_rate_tiers()


def downgrade():
    pass

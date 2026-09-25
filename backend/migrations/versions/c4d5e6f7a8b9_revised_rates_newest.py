"""Apply tier rates from frontend/Revised Rates Newest.xlsx (Sept 2026).

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7
"""

revision = "c4d5e6f7a8b9"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade():
    from app.seeds.rate_tiers import replace_rate_tiers

    replace_rate_tiers()


def downgrade():
    pass

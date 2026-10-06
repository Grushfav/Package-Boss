"""Add scheduled_for to broadcast jobs for deferred announcement sends."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "b9c0d1e2f3a4"
down_revision = "a8b9c0d1e2f3"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("broadcast_jobs")}

    if "scheduled_for" not in cols:
        op.add_column("broadcast_jobs", sa.Column("scheduled_for", sa.DateTime(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("broadcast_jobs")}

    if "scheduled_for" in cols:
        op.drop_column("broadcast_jobs", "scheduled_for")

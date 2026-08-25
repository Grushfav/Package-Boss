"""Add item_description to packages."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "a7b8c9d0e1f2"
down_revision = "z6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "packages" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("packages")}
    if "item_description" not in cols:
        op.add_column("packages", sa.Column("item_description", sa.String(length=255), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "packages" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("packages")}
    if "item_description" in cols:
        op.drop_column("packages", "item_description")

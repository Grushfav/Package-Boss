"""Add google_id for Google OAuth sign-in."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "w3c4d5e6f7a8"
down_revision = "v2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "users" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("users")}
    if "google_id" not in columns:
        op.add_column("users", sa.Column("google_id", sa.String(length=255), nullable=True))
        op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "users" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("users")}
    if "google_id" in columns:
        op.drop_index("ix_users_google_id", table_name="users")
        op.drop_column("users", "google_id")

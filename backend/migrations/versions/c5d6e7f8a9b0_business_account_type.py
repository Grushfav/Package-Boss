"""Add business account type and company name on users."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "c5d6e7f8a9b0"
down_revision = "a0b1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "users" not in set(inspector.get_table_names()):
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "account_type" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "account_type",
                sa.String(length=20),
                nullable=False,
                server_default="personal",
            ),
        )
    if "company_name" not in columns:
        op.add_column("users", sa.Column("company_name", sa.String(length=160), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "users" not in set(inspector.get_table_names()):
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "company_name" in columns:
        op.drop_column("users", "company_name")
    if "account_type" in columns:
        op.drop_column("users", "account_type")

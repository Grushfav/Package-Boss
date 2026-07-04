"""Add users.token_version for JWT revocation."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "l2f3a4b5c6d7"
down_revision = "k1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {col["name"] for col in inspect(bind).get_columns("users")}
    if "token_version" in columns:
        return

    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("users", "token_version", server_default=None)


def downgrade():
    bind = op.get_bind()
    columns = {col["name"] for col in inspect(bind).get_columns("users")}
    if "token_version" not in columns:
        return
    op.drop_column("users", "token_version")

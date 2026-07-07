"""Persist password reset and clerk invite tokens in the database."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "n4a5b6c7d8e9"
down_revision = "m3f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "password_reset_tokens" in inspect(bind).get_table_names():
        return

    op.create_table(
        "password_reset_tokens",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_password_reset_tokens_user_id"),
        "password_reset_tokens",
        ["user_id"],
        unique=False,
    )


def downgrade():
    bind = op.get_bind()
    if "password_reset_tokens" not in inspect(bind).get_table_names():
        return
    op.drop_index(op.f("ix_password_reset_tokens_user_id"), table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")

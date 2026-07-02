"""Store TRN as plain text; drop encrypted/hash columns.

Revision ID: k1e2f3a4b5c6
Revises: j0d1e2f3a4b5
"""

import os

import sqlalchemy as sa
from alembic import op

revision = "k1e2f3a4b5c6"
down_revision = "j0d1e2f3a4b5"
branch_labels = None
depends_on = None


def _decrypt_trn(encrypted: str) -> str | None:
    key = os.environ.get("TRN_ENCRYPTION_KEY", "").strip()
    if not key or not encrypted:
        return None
    try:
        from cryptography.fernet import Fernet, InvalidToken

        fernet = Fernet(key.encode() if isinstance(key, str) else key)
        return fernet.decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except Exception:
        return None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "trn" not in columns:
        op.add_column("users", sa.Column("trn", sa.String(length=11), nullable=True))
        op.create_index(op.f("ix_users_trn"), "users", ["trn"], unique=False)

    if "trn_encrypted" in columns:
        rows = bind.execute(
            sa.text("SELECT id, trn_encrypted FROM users WHERE trn_encrypted IS NOT NULL")
        ).fetchall()
        for row in rows:
            plain = _decrypt_trn(row.trn_encrypted)
            if plain:
                bind.execute(
                    sa.text("UPDATE users SET trn = :trn WHERE id = :id"),
                    {"trn": plain, "id": row.id},
                )

        indexes = {idx["name"] for idx in inspector.get_indexes("users")}
        if "ix_users_trn_hash" in indexes:
            op.drop_index("ix_users_trn_hash", table_name="users")
        op.drop_column("users", "trn_hash")
        op.drop_column("users", "trn_encrypted")


def downgrade():
    op.add_column("users", sa.Column("trn_encrypted", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("trn_hash", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_users_trn_hash"), "users", ["trn_hash"], unique=True)

    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, trn FROM users WHERE trn IS NOT NULL")
    ).fetchall()
    for row in rows:
        bind.execute(
            sa.text("UPDATE users SET trn_encrypted = :trn WHERE id = :id"),
            {"trn": row.trn, "id": row.id},
        )

    op.drop_index(op.f("ix_users_trn"), table_name="users")
    op.drop_column("users", "trn")

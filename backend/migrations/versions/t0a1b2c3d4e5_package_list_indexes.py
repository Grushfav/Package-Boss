"""Add indexes for warehouse package list queries."""

from alembic import op
from sqlalchemy import inspect

revision = "t0a1b2c3d4e5"
down_revision = "s9f0a1b2c3d4"
branch_labels = None
depends_on = None


def _has_index(inspector, table: str, name: str) -> bool:
    return any(idx["name"] == name for idx in inspector.get_indexes(table))


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "packages" not in inspector.get_table_names():
        return

    if not _has_index(inspector, "packages", "ix_packages_status"):
        op.create_index("ix_packages_status", "packages", ["status"], unique=False)
    if not _has_index(inspector, "packages", "ix_packages_received_at"):
        op.create_index("ix_packages_received_at", "packages", ["received_at"], unique=False)
    if not _has_index(inspector, "packages", "ix_packages_customer_id"):
        op.create_index("ix_packages_customer_id", "packages", ["customer_id"], unique=False)
    if not _has_index(inspector, "packages", "ix_packages_status_received_at"):
        op.create_index(
            "ix_packages_status_received_at",
            "packages",
            ["status", "received_at"],
            unique=False,
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "packages" not in inspector.get_table_names():
        return

    for name in (
        "ix_packages_status_received_at",
        "ix_packages_customer_id",
        "ix_packages_received_at",
        "ix_packages_status",
    ):
        if _has_index(inspector, "packages", name):
            op.drop_index(name, table_name="packages")

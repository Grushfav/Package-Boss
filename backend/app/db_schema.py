import os

from sqlalchemy import inspect, text

from app.extensions import db


def _decrypt_trn(encrypted: str) -> str | None:
    key = os.environ.get("TRN_ENCRYPTION_KEY", "").strip()
    if not key or not encrypted:
        return None
    try:
        from cryptography.fernet import Fernet

        fernet = Fernet(key.encode() if isinstance(key, str) else key)
        return fernet.decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except Exception:
        return None


def _migrate_trn_columns(app, columns: set[str]) -> None:
    if "trn" not in columns:
        db.session.execute(text("ALTER TABLE users ADD COLUMN trn VARCHAR(11)"))
        db.session.commit()
        app.logger.info("Added missing users.trn column")
        columns.add("trn")

    if "trn_encrypted" not in columns:
        return

    rows = db.session.execute(
        text("SELECT id, trn_encrypted FROM users WHERE trn_encrypted IS NOT NULL")
    ).fetchall()
    for row in rows:
        plain = _decrypt_trn(row.trn_encrypted)
        if plain:
            db.session.execute(
                text("UPDATE users SET trn = :trn WHERE id = :id"),
                {"trn": plain, "id": row.id},
            )
    db.session.commit()

    if db.engine.dialect.name == "postgresql":
        db.session.execute(text("DROP INDEX IF EXISTS ix_users_trn_hash"))
    db.session.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS trn_hash"))
    db.session.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS trn_encrypted"))
    db.session.commit()
    app.logger.info("Migrated users TRN to plain-text column")


def ensure_schema(app) -> None:
    """Apply lightweight schema patches for databases created before Phase 3."""
    inspector = inspect(db.engine)

    if "users" in inspector.get_table_names():
        columns = {col["name"] for col in inspector.get_columns("users")}
        if "role" not in columns:
            db.session.execute(
                text(
                    "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'customer'"
                )
            )
            db.session.commit()
            app.logger.info("Added missing users.role column")

        # Migrate legacy staff role → clerk
        db.session.execute(
            text("UPDATE users SET role = 'clerk' WHERE role = 'staff'")
        )
        db.session.commit()

        user_patches = [
            ("clerk_permissions", "JSONB" if db.engine.dialect.name == "postgresql" else "TEXT"),
            ("is_active", "BOOLEAN NOT NULL DEFAULT TRUE"),
            ("must_set_password", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("token_version", "INTEGER NOT NULL DEFAULT 0"),
        ]
        for col_name, col_type in user_patches:
            if col_name not in columns:
                db.session.execute(
                    text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                )
                db.session.commit()
                app.logger.info("Added missing users.%s column", col_name)
                columns.add(col_name)

        if db.engine.dialect.name == "postgresql":
            db.session.execute(text("ALTER TABLE users ALTER COLUMN parish DROP NOT NULL"))
            db.session.commit()

        if "google_id" not in columns:
            db.session.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)"))
            db.session.commit()
            app.logger.info("Added missing users.google_id column")
            columns.add("google_id")
            if db.engine.dialect.name == "postgresql":
                db.session.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id "
                        "ON users (google_id)"
                    )
                )
                db.session.commit()

        _migrate_trn_columns(app, columns)

    if "packages" in inspector.get_table_names():
        pkg_columns = {col["name"] for col in inspector.get_columns("packages")}
        if "shipper" not in pkg_columns:
            db.session.execute(text("ALTER TABLE packages ADD COLUMN shipper VARCHAR(30)"))
            db.session.commit()
            app.logger.info("Added missing packages.shipper column")

    # Migrations own new tables; create_all only backfills models without migrations.
    announcement_tables = {
        "announcements",
        "announcement_dismissals",
        "announcement_reads",
        "broadcast_jobs",
    }
    existing = set(inspector.get_table_names())
    if not announcement_tables.issubset(existing):
        db.create_all()

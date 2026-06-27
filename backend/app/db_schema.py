from sqlalchemy import inspect, text

from app.extensions import db


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
        ]
        for col_name, col_type in user_patches:
            if col_name not in columns:
                db.session.execute(
                    text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                )
                db.session.commit()
                app.logger.info("Added missing users.%s column", col_name)
                columns.add(col_name)

        # Allow nullable TRN/parish for staff accounts
        if db.engine.dialect.name == "postgresql":
            for col in ("trn_encrypted", "trn_hash", "parish"):
                db.session.execute(text(f"ALTER TABLE users ALTER COLUMN {col} DROP NOT NULL"))
            db.session.commit()

    if "packages" in inspector.get_table_names():
        pkg_columns = {col["name"] for col in inspector.get_columns("packages")}
        if "shipper" not in pkg_columns:
            db.session.execute(text("ALTER TABLE packages ADD COLUMN shipper VARCHAR(30)"))
            db.session.commit()
            app.logger.info("Added missing packages.shipper column")

    db.create_all()

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

    if "packages" in inspector.get_table_names():
        pkg_columns = {col["name"] for col in inspector.get_columns("packages")}
        if "shipper" not in pkg_columns:
            db.session.execute(text("ALTER TABLE packages ADD COLUMN shipper VARCHAR(30)"))
            db.session.commit()
            app.logger.info("Added missing packages.shipper column")

    db.create_all()

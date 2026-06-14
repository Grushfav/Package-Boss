from app.routes.admin import admin_bp
from app.routes.auth import auth_bp
from app.routes.health import health_bp
from app.routes.me import me_bp
from app.routes.packages import packages_bp
from app.routes.parishes import parishes_bp
from app.routes.pre_alerts import pre_alerts_bp
from app.routes.rates import rates_bp
from app.routes.staff import staff_bp
from app.routes.track import track_bp
from app.routes.uploads import uploads_bp

__all__ = [
    "admin_bp",
    "auth_bp",
    "health_bp",
    "me_bp",
    "packages_bp",
    "parishes_bp",
    "pre_alerts_bp",
    "rates_bp",
    "staff_bp",
    "track_bp",
    "uploads_bp",
]

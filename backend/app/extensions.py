from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
import redis as redis_lib

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
redis_client = None


def init_redis(app):
    global redis_client
    redis_client = redis_lib.from_url(app.config["REDIS_URL"], decode_responses=True)

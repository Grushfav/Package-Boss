from flask import jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def register_jwt_handlers(jwt_manager: JWTManager) -> None:
    @jwt_manager.expired_token_loader
    def _expired_token(_jwt_header, _jwt_payload):
        return jsonify({"error": "Token has expired"}), 401

    @jwt_manager.invalid_token_loader
    def _invalid_token(_error):
        return jsonify({"error": "Invalid token"}), 401

    @jwt_manager.unauthorized_loader
    def _missing_token(_error):
        return jsonify({"error": "Authentication required"}), 401

    @jwt_manager.revoked_token_loader
    def _revoked_token(_jwt_header, _jwt_payload):
        return jsonify({"error": "Token has been revoked"}), 401

"""Application factory for the baseball stats API.

Keeping app creation in a factory to make app configurable per-environment and lets tests
spin up isolated instances against an in-memory database.
"""

from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS

from app.extensions import db

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "baseball.db"


def create_app(config: dict | None = None) -> Flask:
    """Create and configure the Flask application.

    Args:
        config: Optional overrides (used by tests to point at an in-memory DB).
    """
    app = Flask(__name__)
    CORS(app)

    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DEFAULT_DB_PATH}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    if config:
        app.config.update(config)

    db.init_app(app)

    # Blueprints are prefixed with /api to match the frontend dev-server proxy.
    from app.routes.players import players_bp
    from app.routes.pitches import pitches_bp

    app.register_blueprint(players_bp, url_prefix="/api")
    app.register_blueprint(pitches_bp, url_prefix="/api")

    @app.route("/health", methods=["GET"])
    def health_check():
        """Liveness probe; intentionally unprefixed for infra tooling."""
        return jsonify({"status": "healthy"}), 200

    register_error_handlers(app)
    return app


def register_error_handlers(app: Flask) -> None:
    """Consistent JSON error envelope for all error responses."""

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(400)
    def bad_request(error):
        description = getattr(error, "description", "Bad request")
        return jsonify({"error": description}), 400

    @app.errorhandler(422)
    def unprocessable(error):
        description = getattr(error, "description", "Unprocessable entity")
        return jsonify({"error": description}), 422

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"error": "Internal server error"}), 500

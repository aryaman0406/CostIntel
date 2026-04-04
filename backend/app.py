"""
CostIntel AI — Flask Application Factory
Entry point: creates the app, registers blueprints, seeds default admin.
"""

import os
import logging
from flask import Flask
from sqlalchemy import text
from datetime import datetime, timezone

from config import config
from extensions import db, jwt, bcrypt, cors
from utils.response import success_response, error_response

# ──────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Application Factory
# ──────────────────────────────────────────────────────────────

def create_app(config_name="default"):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # ── Initialize extensions ──
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://localhost:3000",
                    "http://127.0.0.1:5173",
                    "http://127.0.0.1:3000",
                ],
                "allow_headers": ["Content-Type", "Authorization"],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            }
        },
    )

    # ── Register Blueprints ──
    from routes.auth_routes import auth_bp
    from routes.user_routes import user_bp
    from routes.expense_routes import expense_bp
    from routes.dashboard_routes import dashboard_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(user_bp, url_prefix="/api")
    app.register_blueprint(expense_bp, url_prefix="/api/expenses")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    from routes.agent_routes import agent_bp
    app.register_blueprint(agent_bp, url_prefix="/api")

    from routes.upload_routes import upload_bp
    app.register_blueprint(upload_bp, url_prefix='/api')

    # ── Health Check (no auth required) ──
    @app.route("/api/health", methods=["GET"])
    def health_check():
        """GET /api/health — API health status."""
        try:
            db.session.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception:
            db_status = "disconnected"

        return success_response(
            {
                "api": "online",
                "database": db_status,
                "version": "1.0.0",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            "Health check passed",
        )

    # ── Error Handlers ──
    register_error_handlers(app)

    # ── JWT Callbacks ──
    register_jwt_callbacks(app)

    # ── Database setup + seeding ──
    with app.app_context():
        db.create_all()
        seed_default_admin()
        cleanup_legacy_seeded_expenses()

    logger.info("CostIntel AI backend initialized successfully")
    return app


# ──────────────────────────────────────────────────────────────
# Error Handlers
# ──────────────────────────────────────────────────────────────

def register_error_handlers(app):
    """Register global error handlers for common HTTP errors."""

    @app.errorhandler(400)
    def bad_request(e):
        return error_response("Bad request", 400)

    @app.errorhandler(404)
    def not_found(e):
        return error_response("The requested resource was not found", 404)

    @app.errorhandler(405)
    def method_not_allowed(e):
        return error_response("Method not allowed", 405)

    @app.errorhandler(422)
    def unprocessable(e):
        return error_response("Unprocessable entity", 422)

    @app.errorhandler(500)
    def internal_error(e):
        return error_response(
            "An unexpected error occurred. Please try again.", 500
        )

    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
        return error_response(
            "An unexpected error occurred. Please try again.", 500
        )


# ──────────────────────────────────────────────────────────────
# JWT Callbacks
# ──────────────────────────────────────────────────────────────

def register_jwt_callbacks(app):
    """Register JWT error handlers for expired/invalid/missing tokens."""

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return error_response(
            "Token has expired. Please log in again.",
            401,
            error_code="TOKEN_EXPIRED",
        )

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return error_response(
            "Invalid token. Please log in again.",
            401,
            error_code="INVALID_TOKEN",
        )

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return error_response(
            "Authorization token is missing.",
            401,
            error_code="MISSING_TOKEN",
        )


# ──────────────────────────────────────────────────────────────
# Database Seeding
# ──────────────────────────────────────────────────────────────

def seed_default_admin():
    """Seed the default admin user if no users exist in the database."""
    from models import User

    if User.query.count() == 0:
        admin = User(
            email="admin@costintel.com",
            full_name="System Admin",
            role="Admin",
            status="active",
            monthly_budget=0.0,
        )
        admin.set_password("Admin@123")
        db.session.add(admin)
        db.session.commit()

        logger.info("Default admin seeded without sample expenses: admin@costintel.com / Admin@123")
    else:
        logger.info("Users already exist — skipping admin seed")


def cleanup_legacy_seeded_expenses():
    """Delete demo rows left by old versions so dashboards show user-entered data."""
    from models import Expense

    deleted = Expense.query.filter(Expense.notes == "Seeded expense").delete(synchronize_session=False)
    if deleted:
        db.session.commit()
        logger.info(f"Removed {deleted} legacy seeded expense rows")


# ──────────────────────────────────────────────────────────────
# Entry Point
# ──────────────────────────────────────────────────────────────

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting CostIntel AI backend on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=True)

"""
Pytest configuration and fixtures for CostIntel backend tests.
"""

import os
import sys
import pytest

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from extensions import db
from models import User


@pytest.fixture(scope="session")
def app():
    """Create a Flask application context for testing."""
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
    os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-12345"
    os.environ["FLASK_DEBUG"] = "false"

    flask_app = create_app("default")
    flask_app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "WTF_CSRF_ENABLED": False,
    })

    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture(scope="function")
def db_session(app):
    """Provide a clean database session per test function."""
    with app.app_context():
        db.create_all()
        yield db.session
        db.session.rollback()


@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture
def test_user(app):
    """Create a standard test user and return its ID."""
    with app.app_context():
        user = User.query.filter_by(email="analyst@test.com").first()
        if not user:
            user = User(
                email="analyst@test.com",
                full_name="Test Analyst",
                role="Analyst",
                status="active",
                monthly_budget=100000.0,
            )
            user.set_password("TestPass123!")
            db.session.add(user)
            db.session.commit()
        return user

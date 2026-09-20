"""
CostIntel — Configuration Module
All application configuration centralized in one place.
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
os.makedirs(INSTANCE_DIR, exist_ok=True)
DEFAULT_SQLITE_PATH = os.path.join(INSTANCE_DIR, "costintel.db").replace("\\", "/")


class Config:
    """Base configuration."""

    # Database
    _db_url = os.environ.get("DATABASE_URL")
    if not _db_url:
        _db_url = f"sqlite:///{DEFAULT_SQLITE_PATH}"
    elif _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # High-concurrency database connection pooling
    if "sqlite" in _db_url:
        SQLALCHEMY_ENGINE_OPTIONS = {
            "pool_pre_ping": True,
            "pool_recycle": 300,
        }
    else:
        SQLALCHEMY_ENGINE_OPTIONS = {
            "pool_size": int(os.environ.get("DB_POOL_SIZE", 30)),
            "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", 60)),
            "pool_timeout": 30,
            "pool_recycle": 1800,
            "pool_pre_ping": True,
        }

    # JWT Authentication & Token Lifecycle
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload

    # App
    DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    SECRET_KEY = os.environ.get("SECRET_KEY", "flask-secret-key")


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}

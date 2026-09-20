"""
CostIntel — Authentication Service
Handles user registration, login, and token generation.
"""

from flask_jwt_extended import create_access_token, create_refresh_token
from extensions import db
from models import User, VALID_ROLES
from utils.validators import validate_user_create, validate_password


def _ensure_tables():
    """Ensure database tables exist before performing queries."""
    try:
        import models
        db.create_all()
    except Exception:
        pass


def register_user(data, allow_role_assignment=False):
    """
    Register a new user.

    Returns:
        (user_dict, None) on success.
        (None, error_message) on failure.
    """
    _ensure_tables()
    is_valid, errors = validate_user_create(data)
    if not is_valid:
        return None, errors

    email = data["email"].strip().lower()

    # Check uniqueness
    if User.query.filter_by(email=email).first():
        return None, {"email": "A user with this email already exists"}

    role = "Viewer"
    if allow_role_assignment:
        role = data.get("role", "Viewer")
        if role not in VALID_ROLES:
            return None, {"role": f"Role must be one of: {', '.join(VALID_ROLES)}"}

    user = User(
        email=email,
        full_name=data["full_name"].strip(),
        role=role,
        status="active",
        monthly_budget=float(data.get("monthly_budget", 0.0)),
    )
    user.set_password(data["password"])

    db.session.add(user)
    db.session.commit()

    return user.to_dict(), None


def login_user(email, password):
    """
    Authenticate a user and return access & refresh tokens.

    Returns:
        (token_data_dict, None) on success.
        (None, error_message) on failure.
    """
    if not email or not password:
        return None, "Email and password are required"

    _ensure_tables()
    user = User.query.filter_by(email=email.strip().lower()).first()

    if not user or not user.check_password(password):
        return None, "Invalid credentials"

    if user.status == "inactive":
        return None, "Account is inactive. Contact admin."

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
    }, None


def refresh_user_token(user_id):
    """
    Generate a new access token for a valid refresh token session.
    """
    user = User.query.get(int(user_id))
    if not user:
        return None, "User not found"
    if user.status == "inactive":
        return None, "Account is inactive"

    access_token = create_access_token(identity=str(user.id))
    return {"access_token": access_token}, None


def get_current_user(user_id):
    """
    Retrieve the current authenticated user's profile.

    Returns:
        User dict or None.
    """
    user = User.query.get(user_id)
    if not user:
        return None
    return user.to_dict()


def change_own_password(user_id, current_password, new_password):
    """
    Allow an authenticated user to change their own password.

    Returns:
        (True, None) on success.
        (False, error_message) on failure.
    """
    user = User.query.get(user_id)
    if not user:
        return False, "User not found"

    if not user.check_password(current_password):
        return False, "Current password is incorrect"

    is_valid, error_msg = validate_password(new_password)
    if not is_valid:
        return False, error_msg

    user.set_password(new_password)
    db.session.commit()

    return True, None


def authenticate_google_user(credential):
    """
    Authenticate or register a user using a Google OAuth ID token.

    Args:
        credential (str): The Google ID token received from Google Identity Services.

    Returns:
        (token_data_dict, None) on success.
        (None, error_message) on failure.
    """
    import os
    import secrets
    import requests

    if not credential or not isinstance(credential, str):
        return None, "Google ID token is required"

    try:
        # Validate ID token with Google's public tokeninfo endpoint
        resp = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
            timeout=8
        )
        if resp.status_code != 200:
            return None, "Invalid Google token or token expired"

        payload = resp.json()

        # Check audience if GOOGLE_CLIENT_ID is configured
        expected_client_id = os.environ.get("GOOGLE_CLIENT_ID")
        if expected_client_id:
            token_aud = payload.get("aud")
            if token_aud != expected_client_id:
                return None, "Google token audience mismatch"

        email = payload.get("email", "").strip().lower()
        if not email:
            return None, "Google account did not provide a valid email"

        email_verified = payload.get("email_verified")
        if email_verified not in [True, "true", "True", 1, "1"]:
            return None, "Google email is not verified"

        name = payload.get("name", "").strip() or email.split("@")[0]

        _ensure_tables()
        # Check if user already exists
        user = User.query.filter_by(email=email).first()

        if not user:
            # Auto-register new user via Google
            random_password = secrets.token_urlsafe(24) + "A1!"
            user = User(
                email=email,
                full_name=name,
                role="Viewer",
                status="active",
                monthly_budget=0.0,
            )
            user.set_password(random_password)
            db.session.add(user)
            db.session.commit()
        else:
            if user.status == "inactive":
                return None, "Account is inactive. Contact admin."

        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": user.to_dict(),
        }, None

    except requests.RequestException as e:
        return None, f"Failed to connect to Google authentication server: {str(e)}"
    except Exception as e:
        db.session.rollback()
        return None, f"Google authentication failed: {str(e)}"


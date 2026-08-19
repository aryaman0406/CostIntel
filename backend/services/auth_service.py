"""
CostIntel — Authentication Service
Handles user registration, login, and token generation.
"""

from flask_jwt_extended import create_access_token
from extensions import db
from models import User, VALID_ROLES
from utils.validators import validate_user_create, validate_password


def register_user(data, allow_role_assignment=False):
    """
    Register a new user (admin-initiated).

    Returns:
        (user_dict, None) on success.
        (None, error_message) on failure.
    """
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
    Authenticate a user and return an access token.

    Returns:
        (token_data_dict, None) on success.
        (None, error_message) on failure.
    """
    if not email or not password:
        return None, "Email and password are required"

    user = User.query.filter_by(email=email.strip().lower()).first()

    if not user or not user.check_password(password):
        return None, "Invalid credentials"

    if user.status == "inactive":
        return None, "Account is inactive. Contact admin."

    access_token = create_access_token(identity=str(user.id))

    return {
        "access_token": access_token,
        "user": user.to_dict(),
    }, None


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

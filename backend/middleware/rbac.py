"""
CostIntel AI — Role-Based Access Control Decorator
Enforces role restrictions and inactive-account guards on protected routes.
"""

from functools import wraps
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from extensions import db
from models import User
from utils.response import error_response


def require_role(*allowed_roles):
    """
    Decorator that restricts endpoint access to users with specific roles.

    Usage:
        @require_role('Admin')
        @require_role('Analyst', 'Admin')

    Checks performed (in order):
        1. JWT is valid and present
        2. User exists in the database
        3. User account is active
        4. User role is in the allowed list
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = int(get_jwt_identity())
            user = db.session.get(User, user_id)

            if not user:
                return error_response("User not found", 401)

            if user.status == "inactive":
                return error_response(
                    "Your account has been deactivated. "
                    "Please contact an administrator.",
                    403,
                    error_code="ACCOUNT_INACTIVE",
                )

            if user.role not in allowed_roles:
                return error_response(
                    f"Access denied. Required role: {', '.join(allowed_roles)}",
                    403,
                    error_code="INSUFFICIENT_PERMISSIONS",
                )

            return fn(*args, **kwargs)

        return wrapper

    return decorator

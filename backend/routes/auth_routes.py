"""
CostIntel — Authentication Routes
Endpoints: login, logout, and current-user profile.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from middleware.rbac import require_role
from middleware.rate_limiter import rate_limit
from services import auth_service
from utils.response import success_response, error_response

auth_bp = Blueprint("api", __name__)


@auth_bp.route("/login", methods=["POST"])
@auth_bp.route("/auth/login", methods=["POST"])
@rate_limit(max_requests=25, window_seconds=60)
def login():
    """
    POST /api/auth/login
    Authenticate a user and return JWT access and refresh tokens.
    Body: { "email": str, "password": str }
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    email = data.get("email", "")
    password = data.get("password", "")

    if not email or not password:
        return error_response("Email and password are required", 400)

    result, err = auth_service.login_user(email, password)

    if err:
        # Distinguish inactive from invalid credentials
        if "inactive" in str(err).lower():
            return error_response(err, 403, error_code="ACCOUNT_INACTIVE")
        return error_response(err, 401)

    return success_response(result, "Login successful")


@auth_bp.route("/auth/google", methods=["POST"])
@auth_bp.route("/google-login", methods=["POST"])
@rate_limit(max_requests=25, window_seconds=60)
def google_auth():
    """
    POST /api/auth/google
    Authenticate or auto-register a user via Google OAuth ID token.
    Body: { "credential": str } or { "id_token": str }
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    credential = data.get("credential") or data.get("id_token") or data.get("token")
    if not credential:
        return error_response("Google credential / ID token is required", 400)

    result, err = auth_service.authenticate_google_user(credential)
    if err:
        if "inactive" in str(err).lower():
            return error_response(err, 403, error_code="ACCOUNT_INACTIVE")
        return error_response(err, 400)

    return success_response(result, "Google login successful")


@auth_bp.route("/register", methods=["POST"])
@auth_bp.route("/auth/register", methods=["POST"])
@rate_limit(max_requests=15, window_seconds=60)
def register():
    """
    POST /api/auth/register
    Public user signup endpoint.
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    # Public registration always creates a Viewer account.
    result, err = auth_service.register_user(data, allow_role_assignment=False)
    if err:
        if isinstance(err, dict):
            return error_response("Validation failed", 422, errors=err)
        return error_response(str(err), 400)
        
    return success_response(result, "Registration successful", 201)


@auth_bp.route("/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh_token():
    """
    POST /api/auth/refresh
    Generate a new access token using a valid refresh token.
    """
    user_id = get_jwt_identity()
    result, err = auth_service.refresh_user_token(user_id)
    if err:
        return error_response(err, 401)
    return success_response(result, "Access token refreshed successfully")


@auth_bp.route("/logout", methods=["POST"])
@auth_bp.route("/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    POST /api/auth/logout
    Stateless logout — client deletes the token.
    """
    return success_response(message="Logged out successfully")


@auth_bp.route("/me", methods=["GET"])
@auth_bp.route("/auth/me", methods=["GET"])
@jwt_required()
def get_me():
    """
    GET /api/auth/me
    Return the current authenticated user's profile.
    """
    user_id = int(get_jwt_identity())
    user = auth_service.get_current_user(user_id)

    if not user:
        return error_response("User not found", 404)

    return success_response(user)

@auth_bp.route('/budget', methods=['POST'])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def update_budget():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    budget = data.get('budget')
    
    if budget is None:
        return error_response('Budget is required', 400)
    
    try:
        budget = float(budget)
        if budget < 0:
            return error_response('Monthly budget cannot be negative', 400)
    except (ValueError, TypeError):
        return error_response('Invalid budget format', 400)
    
    from services.user_service import update_user_budget
    ok, err = update_user_budget(user_id, budget)
    if not ok:
        return error_response(err or "Failed to update budget", 400)
    
    return success_response({"monthly_budget": budget}, f"Monthly budget of ₹{budget:,.2f} updated successfully")


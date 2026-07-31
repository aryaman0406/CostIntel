"""
CostIntel AI — Authentication Routes
Endpoints: login, logout, and current-user profile.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from middleware.rbac import require_role
from services import auth_service
from utils.response import success_response, error_response

auth_bp = Blueprint("api", __name__)


@auth_bp.route("/login", methods=["POST"])
@auth_bp.route("/auth/login", methods=["POST"])
def login():
    """
    POST /api/auth/login
    Authenticate a user and return a JWT access token.
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


@auth_bp.route("/register", methods=["POST"])
@auth_bp.route("/auth/register", methods=["POST"])
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
    data = request.get_json()
    budget = data.get('budget')
    
    if budget is None:
        return error_response('Budget is required', 400)
    
    try:
        budget = float(budget)
    except ValueError:
        return error_response('Invalid budget format', 400)
    
    from services.user_service import update_user_budget
    update_user_budget(user_id, budget)
    
    return success_response({"monthly_budget": budget}, f"Monthly budget of ₹{budget:,.2f} updated successfully")


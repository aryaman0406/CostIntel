"""
CostIntel AI — User Management Routes
All admin-only endpoints plus self-service profile & password change.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from middleware.rbac import require_role
from services import user_service, auth_service
from utils.response import success_response, error_response
from utils.validators import validate_user_create, validate_password

user_bp = Blueprint("users", __name__)


# ──────────────────────────────────────────────────────────────
# Self-service endpoints (any authenticated user)
# These are registered BEFORE /<int:user_id> to avoid conflicts
# ──────────────────────────────────────────────────────────────

@user_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_my_profile():
    """
    GET /api/profile
    Return the current user's profile with expense summary.
    """
    user_id = int(get_jwt_identity())
    profile = user_service.get_user_profile_with_summary(user_id)

    if not profile:
        return error_response("User not found", 404)

    return success_response(profile)


@user_bp.route("/users/me", methods=["GET"])
@jwt_required()
def get_profile_me_alias():
    """
    GET /api/users/me
    Alias for current user's profile to support explicit users namespace.
    """
    user_id = int(get_jwt_identity())
    profile = user_service.get_user_profile_with_summary(user_id)

    if not profile:
        return error_response("User not found", 404)

    return success_response(profile)


@user_bp.route("/me/password", methods=["PATCH"])
@jwt_required()
def change_my_password():
    """
    PATCH /api/users/me/password
    Change the current user's own password.
    Body: { "current_password": str, "new_password": str }
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not current_password or not new_password:
        return error_response(
            "Both current_password and new_password are required", 400
        )

    user_id = int(get_jwt_identity())
    ok, err = auth_service.change_own_password(user_id, current_password, new_password)

    if not ok:
        return error_response(err, 400)

    return success_response(message="Password updated successfully")


# ──────────────────────────────────────────────────────────────
# Admin-only endpoints
# ──────────────────────────────────────────────────────────────

@user_bp.route("/users", methods=["GET"], strict_slashes=False)
@jwt_required()
@require_role("Admin")
def list_users():
    """
    GET /api/users
    Return a paginated list of all users.
    Query: ?page=1&per_page=10&role=Analyst&status=active
    """
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    role = request.args.get("role")
    status = request.args.get("status")

    users, pagination = user_service.get_all_users(page, per_page, role, status)

    return success_response(
        {"users": users, **pagination},
        "Users retrieved successfully",
    )


@user_bp.route("/users/<int:user_id>", methods=["GET"])
@jwt_required()
@require_role("Admin")
def get_user(user_id):
    """
    GET /api/users/<id>
    Return a single user by ID.
    """
    user = user_service.get_user_by_id(user_id)

    if not user:
        return error_response("User not found", 404)

    return success_response(user)


@user_bp.route("/users", methods=["POST"], strict_slashes=False)
@jwt_required()
@require_role("Admin")
def create_user():
    """
    POST /api/users
    Create a new user (Admin creates accounts).
    Body: { email, password, full_name, role?, monthly_budget? }
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    is_valid, errors = validate_user_create(data)
    if not is_valid:
        return error_response("Validation failed", 422, errors=errors)

    user, err = user_service.create_user(data)

    if err:
        # err could be dict (field errors) or string
        if isinstance(err, dict):
            return error_response("Validation failed", 422, errors=err)
        return error_response(err, 400)

    return success_response(user, "User created successfully", 201)


@user_bp.route("/users/<int:user_id>", methods=["PATCH"])
@jwt_required()
@require_role("Admin")
def update_user(user_id):
    """
    PATCH /api/users/<id>
    Update user fields: full_name, role, status, monthly_budget.
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    admin_id = int(get_jwt_identity())
    user, err = user_service.update_user(user_id, data, admin_id)

    if err:
        if "not found" in str(err).lower():
            return error_response(err, 404)
        return error_response(err, 400)

    return success_response(user, "User updated successfully")


@user_bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
@require_role("Admin")
def delete_user(user_id):
    """
    DELETE /api/users/<id>
    Soft-delete: set status='inactive'. Admin cannot delete themselves.
    """
    admin_id = int(get_jwt_identity())
    user, err = user_service.soft_delete_user(user_id, admin_id)

    if err:
        if "not found" in str(err).lower():
            return error_response(err, 404)
        if "own account" in str(err).lower():
            return error_response(err, 403)
        return error_response(err, 400)

    return success_response(user, "User deactivated successfully")


@user_bp.route("/users/<int:user_id>/password", methods=["PATCH"])
@jwt_required()
@require_role("Admin")
def reset_user_password(user_id):
    """
    PATCH /api/users/<id>/password
    Admin resets another user's password.
    Body: { "new_password": str }
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    new_password = data.get("new_password", "")
    if not new_password:
        return error_response("new_password is required", 400)

    ok, err = user_service.reset_user_password(user_id, new_password)

    if not ok:
        if "not found" in str(err).lower():
            return error_response(err, 404)
        return error_response(err, 400)

    return success_response(message="Password reset successfully")

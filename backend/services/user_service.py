"""
CostIntel AI — User Management Service
CRUD operations and role management for Admin users.
"""

from extensions import db
from models import User, Expense, VALID_ROLES, VALID_STATUS
from utils.validators import validate_password
from utils.response import paginate_query
from sqlalchemy import func


def get_all_users(page=1, per_page=10, role=None, status=None):
    """
    Return a paginated, filterable list of all users.

    Args:
        page:     Page number (1-indexed).
        per_page: Items per page.
        role:     Optional role filter.
        status:   Optional status filter.

    Returns:
        (users_list, pagination_meta)
    """
    query = User.query

    if role and role in VALID_ROLES:
        query = query.filter(User.role == role)
    if status and status in VALID_STATUS:
        query = query.filter(User.status == status)

    query = query.order_by(User.created_at.desc())
    items, pagination = paginate_query(query, page, per_page)

    return [u.to_dict() for u in items], pagination


def get_user_by_id(user_id):
    """
    Retrieve a single user by ID.

    Returns:
        User dict or None.
    """
    user = User.query.get(user_id)
    if not user:
        return None
    return user.to_dict()


def create_user(data):
    """
    Create a new user (admin-initiated).
    Delegates to auth_service.register_user for consistency.

    Returns:
        (user_dict, None) on success.
        (None, errors) on failure.
    """
    from services.auth_service import register_user
    return register_user(data, allow_role_assignment=True)


def update_user(user_id, data, admin_id):
    """
    Update user fields: full_name, role, status, monthly_budget.
    Email and password are not updatable through this endpoint.

    Args:
        user_id:  Target user ID.
        data:     Dict of fields to update.
        admin_id: ID of the admin performing the action.

    Returns:
        (user_dict, None) on success.
        (None, error_message) on failure.
    """
    user = User.query.get(user_id)
    if not user:
        return None, "User not found"

    # Prevent admin from deactivating their own account
    if "status" in data and data["status"] == "inactive" and user_id == admin_id:
        return None, "Cannot deactivate your own account"

    # Update allowed fields
    if "full_name" in data and data["full_name"]:
        user.full_name = str(data["full_name"]).strip()

    if "role" in data:
        if data["role"] not in VALID_ROLES:
            return None, f"Role must be one of: {', '.join(VALID_ROLES)}"
        user.role = data["role"]

    if "status" in data:
        if data["status"] not in VALID_STATUS:
            return None, f"Status must be one of: {', '.join(VALID_STATUS)}"
        user.status = data["status"]

    if "monthly_budget" in data:
        try:
            user.monthly_budget = float(data["monthly_budget"])
        except (ValueError, TypeError):
            return None, "Monthly budget must be a valid number"

    db.session.commit()
    return user.to_dict(), None


def soft_delete_user(user_id, admin_id):
    """
    Soft-delete a user by setting status to 'inactive'.

    Args:
        user_id:  Target user ID.
        admin_id: ID of the admin performing the action.

    Returns:
        (user_dict, None) on success.
        (None, error_message) on failure.
    """
    if user_id == admin_id:
        return None, "Cannot deactivate your own account"

    user = User.query.get(user_id)
    if not user:
        return None, "User not found"

    user.status = "inactive"
    db.session.commit()

    return user.to_dict(), None


def reset_user_password(user_id, new_password):
    """
    Admin resets another user's password.

    Returns:
        (True, None) on success.
        (False, error_message) on failure.
    """
    user = User.query.get(user_id)
    if not user:
        return False, "User not found"

    is_valid, error_msg = validate_password(new_password)
    if not is_valid:
        return False, error_msg

    user.set_password(new_password)
    db.session.commit()

    return True, None


def update_user_budget(user_id, budget):
    """
    Update user's monthly budget.

    Args:
        user_id:  Target user ID.
        budget:   Monthly budget amount.

    Returns:
        (True, None) on success.
        (False, error_message) on failure.
    """
    user = User.query.get(user_id)
    if user:
        user.monthly_budget = budget
        db.session.commit()
        return True, None
    return False, "User not found"


def get_user_profile_with_summary(user_id):
    """
    Return user profile with expense summary statistics.

    Returns:
        Dict with user info + expense summary, or None.
    """
    user = User.query.get(user_id)
    if not user:
        return None

    # Aggregate expense stats
    stats = (
        db.session.query(
            func.count(Expense.id).label("total_records"),
            func.coalesce(
                func.sum(
                    db.case((Expense.type == "expense", Expense.amount), else_=0)
                ),
                0,
            ).label("total_expenses"),
            func.coalesce(
                func.sum(
                    db.case((Expense.type == "income", Expense.amount), else_=0)
                ),
                0,
            ).label("total_income"),
        )
        .filter(Expense.user_id == user_id, Expense.is_deleted == False)
        .first()
    )

    profile = user.to_dict()
    profile["expense_summary"] = {
        "total_records": stats.total_records or 0,
        "total_expenses": float(stats.total_expenses or 0),
        "total_income": float(stats.total_income or 0),
        "net_balance": float((stats.total_income or 0) - (stats.total_expenses or 0)),
    }

    return profile

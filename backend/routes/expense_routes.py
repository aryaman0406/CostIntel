"""
CostIntel — Expense Routes
Full CRUD with RBAC, validation, filtering, search, soft-delete, and restore.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from middleware.rbac import require_role
from services import expense_service
from models import User
from utils.response import success_response, error_response
from utils.validators import validate_expense

expense_bp = Blueprint("expenses", __name__)


@expense_bp.route("/", methods=["GET"], strict_slashes=False)
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def list_expenses():
    """
    GET /api/expenses
    Paginated, filterable, searchable list of expenses.
    Data scoping enforced by service layer.
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    # Validate date range
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    if date_from and date_to and date_from > date_to:
        return error_response("date_from must be before date_to", 400)

    filters = {
        "type": request.args.get("type"),
        "category": request.args.get("category"),
        "vendor": request.args.get("vendor"),
        "date_from": date_from,
        "date_to": date_to,
        "search": request.args.get("search"),
        "sort_by": request.args.get("sort_by", "date"),
        "order": request.args.get("order", "desc"),
        "user_id": request.args.get("user_id"),
    }

    expenses, pagination = expense_service.get_expenses(
        user_id, user.role, filters, page, per_page
    )

    return success_response(
        {"expenses": expenses, "pagination": pagination},
        "Expenses retrieved successfully",
    )


@expense_bp.route("/<int:expense_id>", methods=["GET"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def get_expense(expense_id):
    """
    GET /api/expenses/<id>
    Return a single expense by ID with ownership check.
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    expense, err = expense_service.get_expense_by_id(expense_id, user_id, user.role)

    if err:
        msg, code = err
        return error_response(msg, code)

    return success_response(expense)


@expense_bp.route("/", methods=["POST"], strict_slashes=False)
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def create_expense():
    """
    POST /api/expenses
    Create a new expense record.
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    is_valid, errors = validate_expense(data)
    if not is_valid:
        return error_response("Validation failed", 422, errors=errors)

    user_id = int(get_jwt_identity())
    result = expense_service.create_expense(user_id, data)

    return success_response(result, "Expense created successfully", 201)


@expense_bp.route("/<int:expense_id>", methods=["PUT"])
@jwt_required()
@require_role("Admin")
def update_expense_full(expense_id):
    """
    PUT /api/expenses/<id>
    Full update of an expense (Admin only).
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    is_valid, errors = validate_expense(data, partial=False)
    if not is_valid:
        return error_response("Validation failed", 422, errors=errors)

    result, err = expense_service.update_expense(expense_id, data, partial=False)

    if err:
        return error_response(err, 404)

    return success_response(result, "Expense updated successfully")


@expense_bp.route("/<int:expense_id>", methods=["PATCH"])
@jwt_required()
@require_role("Admin")
def update_expense_partial(expense_id):
    """
    PATCH /api/expenses/<id>
    Partial update of an expense (Admin only).
    """
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)

    is_valid, errors = validate_expense(data, partial=True)
    if not is_valid:
        return error_response("Validation failed", 422, errors=errors)

    result, err = expense_service.update_expense(expense_id, data, partial=True)

    if err:
        return error_response(err, 404)

    return success_response(result, "Expense updated successfully")


@expense_bp.route("/<int:expense_id>", methods=["DELETE"])
@jwt_required()
@require_role("Admin")
def delete_expense(expense_id):
    """
    DELETE /api/expenses/<id>
    Soft-delete: sets is_deleted=True (Admin only).
    """
    result, err = expense_service.soft_delete_expense(expense_id)

    if err:
        return error_response(err, 404)

    return success_response(result, "Record soft-deleted")


@expense_bp.route("/<int:expense_id>/restore", methods=["PATCH"])
@jwt_required()
@require_role("Admin")
def restore_expense(expense_id):
    """
    PATCH /api/expenses/<id>/restore
    Restore a soft-deleted expense (Admin only).
    """
    result, err = expense_service.restore_expense(expense_id)

    if err:
        if "not deleted" in str(err).lower():
            return error_response(err, 400)
        return error_response(err, 404)

    return success_response(result, "Expense restored successfully")

@expense_bp.route("/add-expense", methods=["POST"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def add_expense():
    data = request.get_json(silent=True)
    if not data:
        return error_response("Request body must be valid JSON", 400)
    
    user_id = int(get_jwt_identity())
    
    # for a simplified entry, we can default some values
    data['type'] = 'expense'
    data['currency'] = 'INR'
    
    is_valid, errors = validate_expense(data)
    if not is_valid:
        return error_response("Validation failed", 422, errors=errors)
        
    result = expense_service.create_expense(user_id, data)
    return success_response(result, "Expense created successfully", 201)

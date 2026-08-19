"""
CostIntel — Expense Management Service
CRUD operations, filtering, search, soft-delete, and restore for expenses.
"""

from datetime import datetime
import csv
from extensions import db
from models import Expense, VALID_CATEGORIES
from utils.response import paginate_query
from sqlalchemy import or_


def get_expenses(user_id, role, filters, page=1, per_page=20):
    """
    Get a paginated, filterable list of expenses.
    Enforces data scoping: non-Admins see only their own records.

    Args:
        user_id:  Current user's ID.
        role:     Current user's role.
        filters:  Dict of query parameters.
        page:     Page number.
        per_page: Items per page.

    Returns:
        (expenses_list, pagination_meta)
    """
    query = Expense.query.filter(Expense.is_deleted == False)

    # Data scoping
    if role != "Admin":
        query = query.filter(Expense.user_id == user_id)
    else:
        # Admin can optionally filter by user_id
        filter_user_id = filters.get("user_id")
        if filter_user_id:
            try:
                query = query.filter(Expense.user_id == int(filter_user_id))
            except (ValueError, TypeError):
                pass

    # Type filter
    type_filter = filters.get("type")
    if type_filter and type_filter in ("income", "expense"):
        query = query.filter(Expense.type == type_filter)

    # Category filter
    category = filters.get("category")
    if category and category in VALID_CATEGORIES:
        query = query.filter(Expense.category == category)

    # Vendor partial match
    vendor = filters.get("vendor")
    if vendor:
        query = query.filter(Expense.vendor.ilike(f"%{vendor}%"))

    # Date range
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    if date_from:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d").date()
            query = query.filter(Expense.date >= df)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d").date()
            query = query.filter(Expense.date <= dt)
        except ValueError:
            pass

    # Search across vendor, notes, category
    search = filters.get("search")
    if search:
        keyword = f"%{search}%"
        query = query.filter(
            or_(
                Expense.vendor.ilike(keyword),
                Expense.notes.ilike(keyword),
                Expense.category.ilike(keyword),
            )
        )

    # Sorting
    sort_by = filters.get("sort_by", "date")
    order = filters.get("order", "desc")

    sort_column_map = {
        "date": Expense.date,
        "amount": Expense.amount,
        "category": Expense.category,
    }
    sort_column = sort_column_map.get(sort_by, Expense.date)

    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    items, pagination = paginate_query(query, page, per_page)

    return [e.to_dict() for e in items], pagination


def get_expense_by_id(expense_id, user_id, role):
    """
    Fetch a single expense by ID with ownership enforcement.

    Returns:
        (expense_dict, None) on success.
        (None, (error_message, status_code)) on failure.
    """
    expense = Expense.query.get(expense_id)

    if not expense or expense.is_deleted:
        return None, ("Expense not found", 404)

    # Non-admins can only see their own expenses
    if role != "Admin" and expense.user_id != user_id:
        return None, ("Access denied", 403)

    return expense.to_dict(), None


def create_expense(user_id, data):
    """
    Create a new expense record.

    Returns:
        Expense dict on success.
    """
    expense = Expense(
        user_id=user_id,
        amount=float(data["amount"]),
        type=data["type"],
        category=data.get("category", "Uncategorized") or "Uncategorized",
        vendor=str(data["vendor"]).strip(),
        date=datetime.strptime(str(data["date"]).strip(), "%Y-%m-%d").date(),
        notes=str(data["notes"]).strip() if data.get("notes") else None,
        currency=data.get("currency", "INR") or "INR",
    )

    db.session.add(expense)
    db.session.commit()

    return expense.to_dict()


def update_expense(expense_id, data, partial=False):
    """
    Update an expense (full PUT or partial PATCH).

    Args:
        expense_id: Target expense ID.
        data:       Dict of fields.
        partial:    If True, only update provided fields.

    Returns:
        (expense_dict, None) on success.
        (None, error_message) on failure.
    """
    expense = Expense.query.get(expense_id)

    if not expense or expense.is_deleted:
        return None, "Expense not found"

    if not partial or "amount" in data:
        expense.amount = float(data["amount"])

    if not partial or "type" in data:
        expense.type = data["type"]

    if not partial or "category" in data:
        expense.category = data.get("category", "Uncategorized") or "Uncategorized"

    if not partial or "vendor" in data:
        expense.vendor = str(data["vendor"]).strip()

    if not partial or "date" in data:
        expense.date = datetime.strptime(
            str(data["date"]).strip(), "%Y-%m-%d"
        ).date()

    if "notes" in data:
        expense.notes = str(data["notes"]).strip() if data["notes"] else None

    if "currency" in data:
        expense.currency = data.get("currency", "INR") or "INR"

    db.session.commit()

    return expense.to_dict(), None


def soft_delete_expense(expense_id):
    """
    Soft-delete an expense (set is_deleted=True, record deleted_at).

    Returns:
        (expense_dict, None) on success.
        (None, error_message) on failure.
    """
    expense = Expense.query.get(expense_id)

    if not expense or expense.is_deleted:
        return None, "Expense not found"

    expense.is_deleted = True
    expense.deleted_at = datetime.utcnow()
    db.session.commit()

    return expense.to_dict(), None


def restore_expense(expense_id):
    """
    Restore a soft-deleted expense.

    Returns:
        (expense_dict, None) on success.
        (None, error_message) on failure.
    """
    expense = Expense.query.get(expense_id)

    if not expense:
        return None, "Expense not found"

    if not expense.is_deleted:
        return None, "Expense is not deleted"

    expense.is_deleted = False
    expense.deleted_at = None
    db.session.commit()

    return expense.to_dict(), None




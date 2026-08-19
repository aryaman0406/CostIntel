"""
CostIntel — Dashboard Service
Aggregation and summary logic for dashboard endpoints.
All functions return plain Python dicts/lists — no Flask objects.
"""

from datetime import datetime, timedelta, date
from extensions import db
from models import Expense, User
from sqlalchemy import func, case


def _base_query(user_id, role):
    """Return a base query scoped by role (non-deleted records only)."""
    query = Expense.query.filter(Expense.is_deleted == False)
    if role != "Admin":
        query = query.filter(Expense.user_id == user_id)
    return query


def get_summary(user_id, role):
    """
    Main KPI endpoint — returns totals, counts, and budget usage.
    Uses SQLAlchemy aggregations (not Python loops) for efficiency.
    """
    base = _base_query(user_id, role)

    # Overall aggregation
    stats = base.with_entities(
        func.coalesce(
            func.sum(case((Expense.type == "income", Expense.amount), else_=0)), 0
        ).label("total_income"),
        func.coalesce(
            func.sum(case((Expense.type == "expense", Expense.amount), else_=0)), 0
        ).label("total_expenses"),
        func.count(
            case((Expense.type == "income", Expense.id))
        ).label("income_count"),
        func.count(
            case((Expense.type == "expense", Expense.id))
        ).label("expense_count"),
    ).first()

    total_income = float(stats.total_income)
    total_expenses = float(stats.total_expenses)

    # This month
    today = date.today()
    first_of_month = today.replace(day=1)

    month_stats = (
        base.filter(Expense.date >= first_of_month)
        .with_entities(
            func.coalesce(
                func.sum(
                    case((Expense.type == "income", Expense.amount), else_=0)
                ),
                0,
            ).label("month_income"),
            func.coalesce(
                func.sum(
                    case((Expense.type == "expense", Expense.amount), else_=0)
                ),
                0,
            ).label("month_expenses"),
        )
        .first()
    )

    this_month_income = float(month_stats.month_income)
    this_month_expenses = float(month_stats.month_expenses)

    # Budget
    if role == "Admin":
        budget_result = db.session.query(
            func.coalesce(func.sum(User.monthly_budget), 0)
        ).scalar()
        monthly_budget = float(budget_result)
    else:
        user = User.query.get(user_id)
        monthly_budget = float(user.monthly_budget) if user else 0.0

    budget_used_pct = (
        round((this_month_expenses / monthly_budget) * 100, 2)
        if monthly_budget > 0
        else 0.0
    )

    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_balance": total_income - total_expenses,
        "expense_count": stats.expense_count,
        "income_count": stats.income_count,
        "monthly_budget": monthly_budget,
        "budget_used_pct": budget_used_pct,
        "this_month_expenses": this_month_expenses,
        "this_month_income": this_month_income,
        "currency": "INR",
    }


def get_category_totals(user_id, role, type_filter="all", months=0):
    """
    Per-category breakdown with totals, counts, and percentages.

    Args:
        type_filter: 'income', 'expense', or 'all'.
        months:      Number of months to look back (0 = current month only).
    """
    base = _base_query(user_id, role)

    # Date range
    today = date.today()
    if months and months > 0:
        start_date = today.replace(day=1) - timedelta(days=months * 30)
    else:
        start_date = today.replace(day=1)

    base = base.filter(Expense.date >= start_date)

    if type_filter in ("income", "expense"):
        base = base.filter(Expense.type == type_filter)

    results = (
        base.with_entities(
            Expense.category,
            func.sum(Expense.amount).label("total"),
            func.count(Expense.id).label("count"),
        )
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    # Calculate percentages
    grand_total = sum(float(r.total) for r in results) if results else 0
    categories = []
    for r in results:
        total = float(r.total)
        categories.append(
            {
                "category": r.category,
                "total": total,
                "count": r.count,
                "percentage": round((total / grand_total) * 100, 2)
                if grand_total > 0
                else 0.0,
            }
        )

    return {"categories": categories}


def get_monthly_trend(user_id, role, months=6):
    """
    Monthly income vs expense trend for the last N months.
    Missing months are filled with zeros.
    """
    months = min(months, 24)
    today = date.today()
    start_date = (today.replace(day=1) - timedelta(days=months * 30)).replace(day=1)

    base = _base_query(user_id, role).filter(Expense.date >= start_date)

    results = (
        base.with_entities(
            func.strftime("%Y-%m", Expense.date).label("month"),
            func.coalesce(
                func.sum(
                    case((Expense.type == "income", Expense.amount), else_=0)
                ),
                0,
            ).label("income"),
            func.coalesce(
                func.sum(
                    case((Expense.type == "expense", Expense.amount), else_=0)
                ),
                0,
            ).label("expenses"),
        )
        .group_by(func.strftime("%Y-%m", Expense.date))
        .all()
    )

    # Build lookup
    data_map = {}
    for r in results:
        data_map[r.month] = {
            "income": float(r.income),
            "expenses": float(r.expenses),
        }

    # Fill missing months
    trend = []
    current = start_date
    while current <= today:
        month_key = current.strftime("%Y-%m")
        entry = data_map.get(month_key, {"income": 0.0, "expenses": 0.0})
        trend.append(
            {
                "month": month_key,
                "income": entry["income"],
                "expenses": entry["expenses"],
                "net": entry["income"] - entry["expenses"],
            }
        )
        # Move to next month
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)

    return {"trend": trend}


def get_top_vendors(user_id, role, limit=5, type_filter="expense"):
    """
    Top N vendors by total spend.

    Args:
        limit:       Number of vendors to return.
        type_filter: 'income' or 'expense'.
    """
    limit = min(limit, 50)
    base = _base_query(user_id, role)

    if type_filter in ("income", "expense"):
        base = base.filter(Expense.type == type_filter)

    results = (
        base.with_entities(
            Expense.vendor,
            func.sum(Expense.amount).label("total"),
            func.count(Expense.id).label("count"),
        )
        .group_by(Expense.vendor)
        .order_by(func.sum(Expense.amount).desc())
        .limit(limit)
        .all()
    )

    vendors = [
        {"vendor": r.vendor, "total": float(r.total), "count": r.count}
        for r in results
    ]

    return {"vendors": vendors}


def get_recent_activity(user_id, role, limit=10):
    """
    The N most recent non-deleted transactions.
    """
    base = _base_query(user_id, role)
    results = base.order_by(Expense.date.desc(), Expense.created_at.desc()).limit(limit).all()

    activities = [
        {
            "id": e.id,
            "vendor": e.vendor,
            "amount": e.amount,
            "type": e.type,
            "category": e.category,
            "date": e.date.strftime("%Y-%m-%d") if e.date else None,
            "notes": e.notes,
        }
        for e in results
    ]

    return {"activities": activities}


def get_weekly_trend(user_id, role):
    """
    Daily totals for the current week (Monday through today).
    """
    today = date.today()
    # Monday = 0 in weekday()
    monday = today - timedelta(days=today.weekday())

    base = _base_query(user_id, role).filter(
        Expense.date >= monday, Expense.date <= today
    )

    results = (
        base.with_entities(
            Expense.date,
            func.coalesce(
                func.sum(
                    case((Expense.type == "income", Expense.amount), else_=0)
                ),
                0,
            ).label("income"),
            func.coalesce(
                func.sum(
                    case((Expense.type == "expense", Expense.amount), else_=0)
                ),
                0,
            ).label("expenses"),
        )
        .group_by(Expense.date)
        .all()
    )

    # Build lookup
    data_map = {}
    for r in results:
        key = r.date if isinstance(r.date, date) else datetime.strptime(str(r.date), "%Y-%m-%d").date()
        data_map[key] = {
            "income": float(r.income),
            "expenses": float(r.expenses),
        }

    # Fill Mon → today
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    week = []
    current = monday
    while current <= today:
        entry = data_map.get(current, {"income": 0.0, "expenses": 0.0})
        week.append(
            {
                "day": day_names[current.weekday()],
                "date": current.strftime("%Y-%m-%d"),
                "income": entry["income"],
                "expenses": entry["expenses"],
            }
        )
        current += timedelta(days=1)

    return {"week": week}

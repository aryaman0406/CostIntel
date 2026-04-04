"""
CostIntel AI — Dashboard Routes
Summary KPIs, category totals, trends, top vendors, and recent activity.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from middleware.rbac import require_role
from services import dashboard_service
from models import User
from utils.response import success_response, error_response

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/", methods=["GET"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def get_dashboard_data():
    """
    GET /api/dashboard
    Unified endpoint for all dashboard data.
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    # Check if user has any data
    has_data = db.session.query(Expense.query.filter_by(user_id=user_id).exists()).scalar()

    if not has_data:
        return success_response({"has_data": False}, "No expense data found for user.")

    # Aggregated data
    summary = dashboard_service.get_summary(user_id, user.role)
    
    # For simplicity, we can just get some high-level data here
    # In a real app, you might have more complex logic
    cloud_costs = dashboard_service.get_category_totals(user_id, user.role, type_filter='expense', months=1)
    saas_costs = dashboard_service.get_category_totals(user_id, user.role, type_filter='expense', months=1)
    
    # Dummy data for other sections until they are implemented
    historical_spend = dashboard_service.get_monthly_trend(user_id, user.role, months=6)['trend']
    
    # Let's make some simple transformations for the frontend
    total_cloud = sum(c['total'] for c in cloud_costs['categories'] if c['category'] == 'Cloud')
    total_saas = sum(c['total'] for c in saas_costs['categories'] if c['category'] == 'SaaS')
    total_ops = sum(c['total'] for c in saas_costs['categories'] if c['category'] == 'Operations')

    dashboard_data = {
        "has_data": True,
        "monthly_budget": summary.get('monthly_budget', 0),
        "total_cloud": total_cloud,
        "total_saas": total_saas,
        "total_ops": total_ops,
        "historical_spend": historical_spend,
        "cloud_costs": [{"service": c['category'], "cost": c['total'], "utilization": "N/A", "trend": "N/A", "status": "active"} for c in cloud_costs['categories'] if c['category'] == 'Cloud'],
        "saas_subscriptions": [{"name": c['category'], "cost": c['total'], "users": 0, "active_users": 0} for c in saas_costs['categories'] if c['category'] == 'SaaS'],
        "operational_expenses": [{"provider": c['category'], "cost": c['total'], "category": "Ops"} for c in saas_costs['categories'] if c['category'] == 'Operations'],
    }

    return success_response(dashboard_data)


@dashboard_bp.route("/summary", methods=["GET"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def summary():
    """
    GET /api/dashboard/summary
    Main KPI endpoint: totals, counts, budget usage.
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    data = dashboard_service.get_summary(user_id, user.role)

    return success_response(data, "Dashboard summary retrieved")


@dashboard_bp.route("/category-totals", methods=["GET"])
@jwt_required()
@require_role("Analyst", "Admin")
def category_totals():
    """
    GET /api/dashboard/category-totals
    Per-category breakdown.
    Query: ?type=expense|income|all&months=3|6|12
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    type_filter = request.args.get("type", "all")
    months = request.args.get("months", 0, type=int)

    data = dashboard_service.get_category_totals(
        user_id, user.role, type_filter, months
    )

    return success_response(data, "Category totals retrieved")


@dashboard_bp.route("/monthly-trend", methods=["GET"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def monthly_trend():
    """
    GET /api/dashboard/monthly-trend
    Monthly income vs expense trend.
    Query: ?months=6 (default 6, max 24)
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    months = request.args.get("months", 6, type=int)

    data = dashboard_service.get_monthly_trend(user_id, user.role, months)

    return success_response(data, "Monthly trend retrieved")


@dashboard_bp.route("/top-vendors", methods=["GET"])
@jwt_required()
@require_role("Analyst", "Admin")
def top_vendors():
    """
    GET /api/dashboard/top-vendors
    Top N vendors by spend.
    Query: ?limit=5&type=expense
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    limit = request.args.get("limit", 5, type=int)
    type_filter = request.args.get("type", "expense")

    data = dashboard_service.get_top_vendors(
        user_id, user.role, limit, type_filter
    )

    return success_response(data, "Top vendors retrieved")


@dashboard_bp.route("/recent-activity", methods=["GET"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def recent_activity():
    """
    GET /api/dashboard/recent-activity
    10 most recent transactions.
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    data = dashboard_service.get_recent_activity(user_id, user.role)

    return success_response(data, "Recent activity retrieved")


@dashboard_bp.route("/weekly-trend", methods=["GET"])
@jwt_required()
@require_role("Analyst", "Admin")
def weekly_trend():
    """
    GET /api/dashboard/weekly-trend
    Daily totals for the current week (Mon-today).
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    data = dashboard_service.get_weekly_trend(user_id, user.role)

    return success_response(data, "Weekly trend retrieved")

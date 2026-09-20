"""
CostIntel — Audit Trail Routes
GET /api/audit/logs        — paginated list (Admin sees all, others see own)
GET /api/audit/logs/<id>   — single log detail
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.response import success_response, error_response
from models import AuditLog, User

audit_bp = Blueprint("audit", __name__)


@audit_bp.route("/audit/logs", methods=["GET"])
@jwt_required()
def list_audit_logs():
    """GET /api/audit/logs — paginated audit log entries."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    action_type = request.args.get("action_type", None)

    query = AuditLog.query
    if user.role != "Admin":
        query = query.filter_by(user_id=user_id)

    if action_type:
        query = query.filter_by(action_type=action_type)

    query = query.order_by(AuditLog.timestamp.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return success_response({
        "logs": [log.to_dict() for log in paginated.items],
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
        "per_page": per_page,
    })


@audit_bp.route("/audit/logs/<int:log_id>", methods=["GET"])
@jwt_required()
def get_audit_log(log_id):
    """GET /api/audit/logs/<id> — single log entry detail."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    log = AuditLog.query.get(log_id)
    if not log:
        return error_response("Log entry not found", 404)

    # Non-admins can only see their own logs
    if user.role != "Admin" and log.user_id != user_id:
        return error_response("Access denied", 403)

    data = log.to_dict()
    # Include full input/output for detail view
    data["input_summary_full"] = log.input_summary
    data["output_summary_full"] = log.output_summary
    return success_response(data)

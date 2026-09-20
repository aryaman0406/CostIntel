"""
CostIntel — Anomaly Detection Routes
GET  /api/anomalies         — return scored expenses with confidence + reason
POST /api/anomalies/score   — trigger re-scoring and return summary
"""

from datetime import datetime, timezone
import json
from flask import Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.response import success_response, error_response
from services.anomaly_service import get_anomalies_for_user, score_expenses_for_user

anomaly_bp = Blueprint("anomaly", __name__)


@anomaly_bp.route("/anomalies", methods=["GET"])
@jwt_required()
def list_anomalies():
    """GET /api/anomalies — return persisted anomaly scores for the current user."""
    user_id = int(get_jwt_identity())
    anomalies = get_anomalies_for_user(user_id)
    return success_response({
        "anomalies": anomalies,
        "count": len(anomalies),
    })


@anomaly_bp.route("/anomalies/score", methods=["POST"])
@jwt_required()
def trigger_scoring():
    """POST /api/anomalies/score — run full anomaly scoring and return summary."""
    user_id = int(get_jwt_identity())
    try:
        result = score_expenses_for_user(user_id)

        # Log the scoring action to audit trail
        try:
            from models import AuditLog, db
            row = AuditLog(
                user_id=user_id,
                action_type="anomaly",
                input_summary="Manual anomaly re-score triggered",
                output_summary=(
                    f"Scanned {result.get('records_scanned', 0)} records, "
                    f"found {result.get('anomalies_found', 0)} anomalies "
                    f"(HIGH={result.get('high', 0)}, MEDIUM={result.get('medium', 0)})"
                ),
                data_sources_used=json.dumps(["expenses_table", "anomaly_scores_table"]),
                timestamp=datetime.now(timezone.utc),
            )
            db.session.add(row)
            db.session.commit()
        except Exception:
            pass  # Audit logging is best-effort

        return success_response(result)
    except Exception as e:
        return error_response(f"Anomaly scoring failed: {str(e)}", 500)

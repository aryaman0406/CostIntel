from flask import Blueprint
from utils.response import success_response

monitoring_bp = Blueprint("monitoring", __name__)

@monitoring_bp.route("/status", methods=["GET"])
def get_status():
    return success_response({
        "summary": {
            "total_issues_detected": 0,
            "total_monthly_potential_savings": 0,
            "total_annual_potential_savings": 0,
            "top_3_savings_opportunities": []
        }
    })

@monitoring_bp.route("/recommendations", methods=["GET"])
def get_recommendations():
    return success_response({"recommendations": []})

@monitoring_bp.route("/history", methods=["GET"])
def get_history():
    return success_response({"cycles": []})

@monitoring_bp.route("/run", methods=["POST"])
def run_monitoring():
    return success_response("Monitoring run successfully")
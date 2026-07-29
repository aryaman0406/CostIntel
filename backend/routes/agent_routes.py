"""
CostIntel AI — Agent Routes
Exposes endpoints for the various AI agents.
"""
import io
import json
import os
from flask import Blueprint, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from middleware.rbac import require_role
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

from utils.response import success_response, error_response
from agents.data_ingestion_agent import DataIngestionAgent
from agents.predictive_cfo_agent import PredictiveCFOAgent
from agents.cost_monitoring_agent import CostMonitoringAgent
from agents.chatbot_agent import ChatbotAgent
from models import Expense, User

agent_bp = Blueprint("agents", __name__)

data_manager = DataIngestionAgent()
monitoring_agent = CostMonitoringAgent(data_manager)
chatbot = ChatbotAgent(data_manager)

@agent_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def get_dashboard():
    data = data_manager.get_structured_data()
    return success_response(data)

@agent_bp.route("/monitoring/run", methods=["POST"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def run_monitoring():
    result = monitoring_agent.run_monitoring_cycle()
    return success_response(result)

@agent_bp.route("/monitoring/status", methods=["GET"])
@jwt_required()
def get_monitoring_status():
    if not monitoring_agent.monitoring_results:
        monitoring_agent.run_monitoring_cycle()
    summary = monitoring_agent.get_executive_summary()
    return success_response(summary)

@agent_bp.route("/monitoring/recommendations", methods=["GET"])
@jwt_required()
def get_monitoring_recs():
    if not monitoring_agent.monitoring_results:
        monitoring_agent.run_monitoring_cycle()
    if not monitoring_agent.monitoring_results:
        return success_response({"recommendations": []})
    return success_response({"recommendations": monitoring_agent.monitoring_results[-1].get("recommendations", [])})

@agent_bp.route("/monitoring/history", methods=["GET"])
@jwt_required()
def get_monitoring_history():
    if not monitoring_agent.monitoring_results:
        monitoring_agent.run_monitoring_cycle()
    return success_response({"cycles": monitoring_agent.monitoring_results})

@agent_bp.route("/simulate", methods=["POST"])
@jwt_required()
def simulate():
    data = request.get_json(silent=True)
    strategy = data.get("strategy", "balanced") if data else "balanced"
    agent = PredictiveCFOAgent(data_manager)
    return success_response(agent.simulate_scenario(strategy))

@agent_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    data = request.get_json(silent=True)
    message = data.get("message", "") if data else ""
    chatbot.set_platform_data(data_manager.get_structured_data())
    response = chatbot.get_response(message)
    return success_response(response)

@agent_bp.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    user_id = int(get_jwt_identity())
    from services.user_service import get_user_profile_with_summary
    prof = get_user_profile_with_summary(user_id)
    if not prof:
        return error_response("User not found", 404)
    if "expense_summary" in prof:
        prof["expense_count"] = prof["expense_summary"].get("total_records", 0)
        prof["total_spent"] = prof["expense_summary"].get("total_expenses", 0.0)
    return success_response(prof)

@agent_bp.route("/report/generate", methods=["GET"])
@jwt_required()
def generate_report():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    if user.role == "Admin":
        expenses = Expense.query.filter(Expense.is_deleted == False).order_by(Expense.date.desc()).all()
    else:
        expenses = Expense.query.filter(
            Expense.user_id == user_id,
            Expense.is_deleted == False,
        ).order_by(Expense.date.desc()).all()

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 1.8 * cm

    def write_line(text, size=10, leading=0.58):
        nonlocal y
        if y < 2 * cm:
            pdf.showPage()
            y = height - 1.8 * cm
        pdf.setFont("Helvetica", size)
        pdf.drawString(1.5 * cm, y, str(text))
        y -= leading * cm

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(1.5 * cm, y, "CostIntel AI - Expense Report")
    y -= 0.9 * cm
    write_line(f"Generated for: {user.full_name} ({user.email})", 10)
    write_line(f"Scope: {'All users' if user.role == 'Admin' else 'Current user only'}", 10)
    write_line("", 10, 0.3)

    total = sum(float(e.amount or 0) for e in expenses)
    write_line(f"Total records: {len(expenses)}", 10)
    write_line(f"Total amount: INR {total:,.2f}", 10)
    write_line("", 10, 0.35)

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(1.5 * cm, y, "Expense Details")
    y -= 0.7 * cm
    for exp in expenses:
        write_line(
            f"{exp.date.strftime('%Y-%m-%d') if exp.date else 'N/A'} | "
            f"{exp.vendor or 'N/A'} | {exp.category or 'N/A'} | "
            f"{exp.type or 'expense'} | INR {float(exp.amount or 0):,.2f}"
        )
        if exp.notes:
            write_line(f"  Notes: {exp.notes}", 9, 0.5)

    pdf.save()
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='CFO_Cost_Report.pdf'
    )

@agent_bp.route("/upload-csv", methods=["POST"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def upload_csv():
    if 'file' not in request.files:
        return error_response("No file part", 400)
    file = request.files['file']
    if file.filename == '':
        return error_response("No selected file", 400)
    
    user_id = int(get_jwt_identity())
    success, msg = data_manager.process_csv(file, user_id)
    if not success:
        return error_response(msg, 500)
    return success_response(message=msg)

@agent_bp.route("/add-expense", methods=["POST"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def add_manual_expense():
    data = request.get_json(silent=True) or {}
    user_id = int(get_jwt_identity())
    success, msg = data_manager.add_manual_expense(user_id, data)
    if not success:
        return error_response(msg, 400)
    return success_response(message=msg)

@agent_bp.route("/budget", methods=["POST"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def set_budget():
    data = request.get_json(silent=True) or {}
    budget = data.get('budget', 0)
    user_id = int(get_jwt_identity())
    success, msg = data_manager.update_budget(user_id, budget)
    if not success:
        return error_response(msg, 400)
    return success_response(message=msg)

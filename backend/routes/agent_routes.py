"""
CostIntel — Agent Routes
Exposes endpoints for the various cost intelligence agents.
"""
import io
import json
import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from middleware.rbac import require_role

from utils.response import success_response, error_response
from agents.data_ingestion_agent import DataIngestionAgent
from agents.predictive_cfo_agent import PredictiveCFOAgent
from agents.cost_monitoring_agent import CostMonitoringAgent
from agents.gemini_cfo_agent import GeminiCFOAgent
from models import Expense, User, MonitoringRun, AuditLog
from extensions import db

agent_bp = Blueprint("agents", __name__)

data_manager = DataIngestionAgent()
monitoring_agent = CostMonitoringAgent(data_manager)
gemini_agent = GeminiCFOAgent(data_manager, monitoring_agent)


@agent_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def get_dashboard():
    data = data_manager.get_structured_data()
    return success_response(data)


@agent_bp.route("/monitoring/run", methods=["POST"])
@jwt_required()
@require_role("Viewer", "Analyst", "Admin")
def run_monitoring():
    """Run a full monitoring cycle. Persists a MonitoringRun row and adds
    records_scanned / issues_found / estimated_savings to the response."""
    user_id = int(get_jwt_identity())
    result = monitoring_agent.run_monitoring_cycle()

    # Count records scanned (user's active expenses)
    records_scanned = Expense.query.filter_by(user_id=user_id, is_deleted=False).count()
    issues_found = len(result.get("issues_detected", []))
    estimated_savings = result.get("total_potential_savings", 0.0)

    # Additive fields — existing keys untouched
    result["records_scanned"] = records_scanned
    result["issues_found"] = issues_found
    result["estimated_savings"] = estimated_savings

    # Persist run to DB
    try:
        run = MonitoringRun(
            user_id=user_id,
            timestamp=datetime.now(timezone.utc),
            records_scanned=records_scanned,
            issues_found=issues_found,
            total_estimated_savings=estimated_savings,
            raw_result=json.dumps(result, default=str),
        )
        db.session.add(run)

        # Audit log
        log = AuditLog(
            user_id=user_id,
            action_type="monitoring",
            input_summary="Manual monitoring cycle triggered",
            output_summary=(
                f"Scanned {records_scanned} records, "
                f"found {issues_found} issues, "
                f"estimated savings: Rs {estimated_savings:,.0f}"
            ),
            data_sources_used=json.dumps(["expenses_table", "saas_subscriptions", "cloud_costs"]),
            timestamp=datetime.now(timezone.utc),
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).error(f"Failed to persist MonitoringRun: {e}")

    return success_response(result)


@agent_bp.route("/monitoring/runs", methods=["GET"])
@jwt_required()
def get_monitoring_runs():
    """GET /api/monitoring/runs — list persisted run history for the current user."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    query = MonitoringRun.query
    if user and user.role != "Admin":
        query = query.filter_by(user_id=user_id)

    runs = query.order_by(MonitoringRun.timestamp.desc()).limit(20).all()
    return success_response({"runs": [r.to_dict() for r in runs]})


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
    user_id = int(get_jwt_identity())
    agent = PredictiveCFOAgent(data_manager)
    result = agent.simulate_scenario(strategy)

    # Audit log
    try:
        log = AuditLog(
            user_id=user_id,
            action_type="simulation",
            input_summary=f"Strategy: {strategy}",
            output_summary=f"Projected savings: Rs {result.get('projected_monthly_savings', 0):,.0f}/mo",
            data_sources_used=json.dumps(["expenses_table"]),
            timestamp=datetime.now(timezone.utc),
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return success_response(result)


@agent_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    """POST /api/chat — same request/response shape as before.
    Internally upgraded to GeminiCFOAgent (with function calling).
    Falls back to ChatbotAgent if GEMINI_API_KEY is not set.
    """
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True)
    message = data.get("message", "") if data else ""
    session_id = data.get("session_id", str(uuid.uuid4())) if data else str(uuid.uuid4())

    result = gemini_agent.get_response(message, user_id=user_id, session_id=session_id)

    # The response shape stays backwards-compatible while adding reasoning_steps
    response_text = result.get("text", "")
    tools_used = result.get("tools_used", [])
    reasoning_steps = result.get("reasoning_steps", [])

    return success_response({
        "message": response_text,
        "response": response_text,
        "tools_used": tools_used,
        "reasoning_steps": reasoning_steps,
    })


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

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm, mm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, HRFlowable,
    )
    from collections import defaultdict

    buffer = io.BytesIO()
    width, height = A4

    # Branding colors
    PRIMARY = colors.HexColor("#5b6cf0")
    PRIMARY_LIGHT = colors.HexColor("#f0f1ff")
    TEXT_DARK = colors.HexColor("#1e293b")
    TEXT_SECONDARY = colors.HexColor("#64748b")
    TEXT_MUTED = colors.HexColor("#94a3b8")
    BORDER_COLOR = colors.HexColor("#e2e5f0")
    SUCCESS = colors.HexColor("#10b981")
    ROW_ALT = colors.HexColor("#f8f9fc")

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="ReportTitle",
        fontSize=22,
        fontName="Helvetica-Bold",
        textColor=TEXT_DARK,
        spaceAfter=4,
        leading=26,
    ))
    styles.add(ParagraphStyle(
        name="ReportSubtitle",
        fontSize=10,
        fontName="Helvetica",
        textColor=TEXT_SECONDARY,
        spaceAfter=16,
    ))
    styles.add(ParagraphStyle(
        name="SectionHead",
        fontSize=13,
        fontName="Helvetica-Bold",
        textColor=TEXT_DARK,
        spaceBefore=18,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        name="SmallNote",
        fontSize=8,
        fontName="Helvetica",
        textColor=TEXT_MUTED,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name="CellText",
        fontSize=9,
        fontName="Helvetica",
        textColor=TEXT_DARK,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name="CellTextBold",
        fontSize=9,
        fontName="Helvetica-Bold",
        textColor=TEXT_DARK,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name="CellTextRight",
        fontSize=9,
        fontName="Helvetica",
        textColor=TEXT_DARK,
        alignment=TA_RIGHT,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name="CellTextRightBold",
        fontSize=9,
        fontName="Helvetica-Bold",
        textColor=TEXT_DARK,
        alignment=TA_RIGHT,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name="HeaderCell",
        fontSize=8,
        fontName="Helvetica-Bold",
        textColor=TEXT_SECONDARY,
        leading=10,
    ))
    styles.add(ParagraphStyle(
        name="HeaderCellRight",
        fontSize=8,
        fontName="Helvetica-Bold",
        textColor=TEXT_SECONDARY,
        alignment=TA_RIGHT,
        leading=10,
    ))

    def fmt_inr(val):
        """Format a number as INR with comma separators."""
        try:
            v = float(val)
        except (TypeError, ValueError):
            return "₹0.00"
        if v < 0:
            return f"-₹{abs(v):,.2f}"
        return f"₹{v:,.2f}"

    now_str = datetime.now(timezone.utc).strftime("%d %B %Y, %I:%M %p UTC")

    # Page number callback
    def add_page_number(canvas_obj, doc):
        page_num = canvas_obj.getPageNumber()
        canvas_obj.saveState()
        # Footer line
        canvas_obj.setStrokeColor(BORDER_COLOR)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(1.8 * cm, 1.4 * cm, width - 1.8 * cm, 1.4 * cm)
        # Footer text
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillColor(TEXT_MUTED)
        canvas_obj.drawString(1.8 * cm, 0.95 * cm, "CostIntel — Autonomous Cost Intelligence Platform")
        canvas_obj.drawRightString(width - 1.8 * cm, 0.95 * cm, f"Page {page_num}")
        canvas_obj.restoreState()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=2 * cm,
    )

    elements = []

    # ── Header ──
    elements.append(Paragraph("CostIntel — Expense Report", styles["ReportTitle"]))
    scope_text = "All Users (Admin)" if user.role == "Admin" else "Current User"
    elements.append(Paragraph(
        f"Prepared for <b>{user.full_name}</b> ({user.email})&nbsp;&nbsp;·&nbsp;&nbsp;"
        f"Scope: {scope_text}&nbsp;&nbsp;·&nbsp;&nbsp;Generated: {now_str}",
        styles["ReportSubtitle"],
    ))
    elements.append(HRFlowable(
        width="100%", thickness=1, color=BORDER_COLOR,
        spaceAfter=14, spaceBefore=2,
    ))

    # ── Summary Section ──
    total_amount = sum(float(e.amount or 0) for e in expenses)
    category_totals = defaultdict(float)
    vendor_totals = defaultdict(float)
    for exp in expenses:
        category_totals[exp.category or "Uncategorized"] += float(exp.amount or 0)
        vendor_totals[exp.vendor or "Unknown"] += float(exp.amount or 0)

    top_category = max(category_totals, key=category_totals.get) if category_totals else "—"
    top_vendor = max(vendor_totals, key=vendor_totals.get) if vendor_totals else "—"

    summary_data = [
        [
            Paragraph("TOTAL RECORDS", styles["HeaderCell"]),
            Paragraph("TOTAL AMOUNT", styles["HeaderCell"]),
            Paragraph("TOP CATEGORY", styles["HeaderCell"]),
            Paragraph("TOP VENDOR", styles["HeaderCell"]),
        ],
        [
            Paragraph(f"<b>{len(expenses)}</b>", styles["CellTextBold"]),
            Paragraph(f"<b>{fmt_inr(total_amount)}</b>", styles["CellTextBold"]),
            Paragraph(f"<b>{top_category}</b>", styles["CellTextBold"]),
            Paragraph(f"<b>{top_vendor}</b>", styles["CellTextBold"]),
        ],
    ]
    available_width = width - 3.6 * cm
    summary_col_w = available_width / 4
    summary_table = Table(summary_data, colWidths=[summary_col_w] * 4)
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_LIGHT),
        ("BACKGROUND", (0, 1), (-1, 1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 6))

    # ── Category Breakdown ──
    if category_totals:
        elements.append(Paragraph("Category Breakdown", styles["SectionHead"]))
        cat_header = [
            Paragraph("CATEGORY", styles["HeaderCell"]),
            Paragraph("RECORDS", styles["HeaderCellRight"]),
            Paragraph("AMOUNT", styles["HeaderCellRight"]),
            Paragraph("% OF TOTAL", styles["HeaderCellRight"]),
        ]
        cat_rows = [cat_header]
        sorted_cats = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
        for cat_name, cat_total in sorted_cats:
            cat_count = sum(1 for e in expenses if (e.category or "Uncategorized") == cat_name)
            pct = (cat_total / total_amount * 100) if total_amount > 0 else 0
            cat_rows.append([
                Paragraph(cat_name, styles["CellTextBold"]),
                Paragraph(str(cat_count), styles["CellTextRight"]),
                Paragraph(fmt_inr(cat_total), styles["CellTextRightBold"]),
                Paragraph(f"{pct:.1f}%", styles["CellTextRight"]),
            ])

        cat_col_widths = [available_width * 0.35, available_width * 0.15, available_width * 0.28, available_width * 0.22]
        cat_table = Table(cat_rows, colWidths=cat_col_widths)
        cat_style = [
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
        for i in range(1, len(cat_rows)):
            if i % 2 == 0:
                cat_style.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))
            cat_style.append(("LINEBELOW", (0, i), (-1, i), 0.3, BORDER_COLOR))
        cat_table.setStyle(TableStyle(cat_style))
        elements.append(cat_table)
        elements.append(Spacer(1, 4))

    # ── Expense Details Table ──
    elements.append(Paragraph("Expense Details", styles["SectionHead"]))

    if expenses:
        header_row = [
            Paragraph("#", styles["HeaderCell"]),
            Paragraph("DATE", styles["HeaderCell"]),
            Paragraph("VENDOR", styles["HeaderCell"]),
            Paragraph("CATEGORY", styles["HeaderCell"]),
            Paragraph("TYPE", styles["HeaderCell"]),
            Paragraph("AMOUNT", styles["HeaderCellRight"]),
        ]
        table_data = [header_row]

        for idx, exp in enumerate(expenses, 1):
            date_str = exp.date.strftime("%d %b %Y") if exp.date else "N/A"
            table_data.append([
                Paragraph(str(idx), styles["CellText"]),
                Paragraph(date_str, styles["CellText"]),
                Paragraph(exp.vendor or "N/A", styles["CellTextBold"]),
                Paragraph(exp.category or "N/A", styles["CellText"]),
                Paragraph((exp.type or "expense").capitalize(), styles["CellText"]),
                Paragraph(fmt_inr(exp.amount), styles["CellTextRightBold"]),
            ])

        # Column widths
        col_widths = [
            available_width * 0.06,   # #
            available_width * 0.16,   # Date
            available_width * 0.28,   # Vendor
            available_width * 0.20,   # Category
            available_width * 0.10,   # Type
            available_width * 0.20,   # Amount
        ]

        detail_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        detail_style = [
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, PRIMARY),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                detail_style.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))
            detail_style.append(("LINEBELOW", (0, i), (-1, i), 0.3, BORDER_COLOR))

        # Total row
        total_row = [
            Paragraph("", styles["CellText"]),
            Paragraph("", styles["CellText"]),
            Paragraph("", styles["CellText"]),
            Paragraph("", styles["CellText"]),
            Paragraph("<b>TOTAL</b>", styles["CellTextBold"]),
            Paragraph(f"<b>{fmt_inr(total_amount)}</b>", styles["CellTextRightBold"]),
        ]
        table_data.append(total_row)
        total_idx = len(table_data) - 1
        detail_style.append(("BACKGROUND", (0, total_idx), (-1, total_idx), PRIMARY_LIGHT))
        detail_style.append(("LINEABOVE", (0, total_idx), (-1, total_idx), 1, PRIMARY))

        detail_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        detail_table.setStyle(TableStyle(detail_style))
        elements.append(detail_table)
    else:
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(
            "No expense records found. Upload expenses via CSV or add them manually.",
            styles["CellText"],
        ))

    # ── Footer Note ──
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=BORDER_COLOR,
        spaceAfter=6, spaceBefore=2,
    ))
    elements.append(Paragraph(
        "This report was auto-generated by CostIntel. All amounts are in INR unless otherwise noted.",
        styles["SmallNote"],
    ))

    doc.build(elements, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='CostIntel_Expense_Report.pdf'
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
        return error_response(msg, 400)
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
    try:
        budget_val = float(budget)
        if budget_val < 0:
            return error_response("Monthly budget cannot be negative", 400)
    except (ValueError, TypeError):
        return error_response("Invalid budget format", 400)
    success, msg = data_manager.update_budget(user_id, budget_val)
    if not success:
        return error_response(msg, 400)
    from services.user_service import update_user_budget
    update_user_budget(user_id, budget_val)
    return success_response({"monthly_budget": budget_val}, f"Monthly budget of Rs {budget_val:,.2f} updated successfully")

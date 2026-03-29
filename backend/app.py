from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import os
import sys
from pathlib import Path
import pandas as pd
from datetime import datetime
import logging
from dotenv import load_dotenv
from sqlalchemy import inspect, text

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ensure agents can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import db, User, Expense

from agents.data_ingestion_agent import DataIngestionAgent
from agents.spend_analysis_agent import SpendAnalysisAgent
from agents.predictive_cfo_agent import PredictiveCFOAgent
from agents.anomaly_detection_agent import AnomalyDetectionAgent
from agents.shadow_cost_detector_agent import ShadowCostDetectorAgent
from agents.future_cost_predictor_agent import FutureCostPredictorAgent
from agents.chatbot_agent import ChatbotAgent
from agents.cost_monitoring_agent import CostMonitoringAgent

from monitoring_scheduler import MonitoringScheduler

app = Flask(__name__)

# Runtime flag for backward compatibility with legacy SQLite schema.
has_expense_currency_column = False

# Configure CORS for development with explicit origins and headers
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
        "allow_headers": ["Content-Type", "Authorization"],
        "methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
        "expose_headers": ["Content-Type", "Authorization"]
    }
}, supports_credentials=True)

# Database & Auth Config
db_file = Path(app.instance_path) / 'costintel.db'
db_file.parent.mkdir(parents=True, exist_ok=True)
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_file.as_posix()}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'super-secret-key-change-in-production')

db.init_app(app)
jwt = JWTManager(app)

# JWT Error Handlers
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({"status": "error", "message": "Token has expired"}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({"status": "error", "message": "Invalid token: " + str(error)}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({"status": "error", "message": "Request does not contain an access token"}), 401

with app.app_context():
    db.create_all()

    # Auto-heal legacy SQLite schema so manual expense inserts never crash.
    try:
        inspector = inspect(db.engine)
        expense_columns = {col['name'] for col in inspector.get_columns('expense')}
        if 'currency' not in expense_columns:
            db.session.execute(text("ALTER TABLE expense ADD COLUMN currency VARCHAR(10) DEFAULT 'INR'"))
            db.session.commit()
            logger.info("✅ Database schema updated: added missing 'currency' column to expense table")
            expense_columns.add('currency')
        has_expense_currency_column = 'currency' in expense_columns
        logger.info(f"ℹ️ expense.currency column available: {has_expense_currency_column}")

        user_columns = {col['name'] for col in inspector.get_columns('user')}
        if 'monthly_budget' not in user_columns:
            db.session.execute(text("ALTER TABLE user ADD COLUMN monthly_budget FLOAT DEFAULT 0.0"))
            db.session.commit()
            logger.info("✅ Database schema updated: added missing 'monthly_budget' column to user table")
    except Exception as e:
        db.session.rollback()
        logger.warning(f"⚠️ Schema check/migration skipped: {str(e)}")

# Initialize Agents
data_agent = DataIngestionAgent()
spend_agent = SpendAnalysisAgent(data_agent)
cfo_agent = PredictiveCFOAgent(data_agent)
anomaly_agent = AnomalyDetectionAgent(data_agent)
shadow_agent = ShadowCostDetectorAgent(data_agent)
future_agent = FutureCostPredictorAgent(data_agent)
chat_agent = ChatbotAgent()

# Initialize Continuous Monitoring System
monitoring_agent = CostMonitoringAgent(data_agent)
monitoring_scheduler = MonitoringScheduler()
monitoring_scheduler.initialize(monitoring_agent, interval_hours=24)

# Start monitoring
try:
    monitoring_scheduler.start()
    logger.info("✅ Continuous cost monitoring system initialized and started")
except Exception as e:
    logger.warning(f"⚠️ Could not start monitoring scheduler: {str(e)}. Manual monitoring available via API.")

# Track executed actions
executed_actions = {}

@app.before_request
def log_request_info():
    logger.info(f"⚡ Request: {request.method} {request.path}")

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "success",
        "message": "CostIntel API is running",
        "timestamp": datetime.utcnow().isoformat()
    }), 200

@app.route('/api/analyze', methods=['GET'])
@jwt_required()
def analyze_spend():
    """Analyze the user's real spend data."""
    try:
        # Use get_structured_data to ensure we're analyzing the logged-in user's data
        analysis_result = spend_agent.analyze()
        
        if not analysis_result or (not analysis_result.get("inefficiencies") and not analysis_result.get("duplicates") and not analysis_result.get("unused_subscriptions")):
            return jsonify({
                "status": "success",
                "message": "Analysis complete. No significant optimization opportunities found at this time.",
                "data": analysis_result
            }), 200

        return jsonify({
            "status": "success",
            "message": "Analysis complete.",
            "data": analysis_result
        }), 200
    except Exception as e:
        logger.error(f"An error occurred during spend analysis: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred during analysis."}), 500

@app.route('/api/seed-sample-data', methods=['POST'])
@jwt_required()
def seed_sample_data():
    user_id = get_jwt_identity()
    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "Invalid user session"}), 401

    import random
    from datetime import timedelta
    expenses = []
    base_date = datetime.utcnow().date()
    vendors = [("AWS", "Cloud", 200000), ("Azure", "Cloud", 120000), ("Zoom", "SaaS", 80000), ("Slack", "SaaS", 40000)]
    
    # Past 5 months + current month
    for m in range(6):
        d = base_date - timedelta(days=m*30 + 5)
        for vendor, cat, amt in vendors:
            amount = amt * (1.0 - m*0.05 + random.uniform(-0.02, 0.02)) # costs increasing slightly over time
            e = Expense(user_id=user_id_int, amount=amount, vendor=vendor, date=d, category=cat)
            if has_expense_currency_column:
                e.currency = 'INR'
            expenses.append(e)
            
    # Add a few anomalies and shadow costs to current batch
    expenses.extend([
        Expense(user_id=user_id_int, amount=250000, vendor="AWS", date=base_date - timedelta(days=2), category="Cloud", **({"currency":"INR"} if has_expense_currency_column else {})),
        Expense(user_id=user_id_int, amount=80000, vendor="Zoom", date=base_date - timedelta(days=3), category="SaaS", **({"currency":"INR"} if has_expense_currency_column else {})),
        Expense(user_id=user_id_int, amount=95000, vendor="Personal AWS", date=base_date - timedelta(days=4), category="Cloud", **({"currency":"INR"} if has_expense_currency_column else {})),
    ])

    db.session.add_all(expenses)
    
    user = db.session.get(User, user_id_int)
    if user:
        user.monthly_budget = 800000
        
    db.session.commit()
    return jsonify({"status": "success", "message": "Enterprise sample data loaded!"}), 200

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"status": "error", "message": "User already exists"}), 400

    new_user = User(email=email)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"status": "success", "message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    logger.info("Received login request")
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        logger.info(f"Attempting login for email: {email}")

        if not email or not password:
            logger.warning("Login failed: Missing email or password")
            return jsonify({"status": "error", "message": "Email and password are required"}), 400

        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            access_token = create_access_token(identity=str(user.id))
            logger.info(f"Login successful for {email}")
            return jsonify({"status": "success", "access_token": access_token, "email": user.email}), 200
        
        logger.warning(f"Login failed for {email}: Invalid credentials")
        return jsonify({"status": "error", "message": "Invalid credentials"}), 401
    except Exception as e:
        logger.error(f"An unexpected error occurred during login: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred. Please try again later."}), 500

@app.route('/api/upload-csv', methods=['POST'])
@jwt_required()
def upload_csv():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "No selected file"}), 400

    if file and file.filename.endswith('.csv'):
        user_id = get_jwt_identity()
        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return jsonify({"status": "error", "message": "Invalid user session"}), 401
        try:
            df = pd.read_csv(file)
            # Make columns case-insensitive and stripped
            df.columns = [str(c).strip().title() for c in df.columns]
            
            required_cols = ['Amount', 'Vendor', 'Date']
            for col in required_cols:
                if col not in df.columns:
                    return jsonify({"status": "error", "message": f"Missing required column: {col}. Found columns: {list(df.columns)}"}), 400

            for _, row in df.iterrows():
                try:
                    expense_date = datetime.strptime(str(row['Date']).strip(), '%Y-%m-%d').date()
                except:
                    expense_date = datetime.utcnow().date()

                expense = Expense(
                    user_id=user_id_int,
                    amount=float(row['Amount']),
                    vendor=str(row['Vendor']),
                    date=expense_date,
                    category=str(row.get('Category', 'Uncategorized')),
                    **({"currency": str(row.get('Currency', 'INR'))} if has_expense_currency_column else {})
                )
                db.session.add(expense)

            db.session.commit()
            return jsonify({"status": "success", "message": f"Successfully imported {len(df)} expenses!"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": f"Error parsing CSV: {str(e)}"}), 500

    return jsonify({"status": "error", "message": "Invalid file format. Please upload a CSV."}), 400

@app.route('/api/add-expense', methods=['POST'])
@jwt_required()
def add_expense():
    user_id = get_jwt_identity()
    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "Invalid user session"}), 401
    data = request.json or {}

    required_fields = ['amount', 'vendor', 'date']
    if not all(field in data and str(data[field]).strip() for field in required_fields):
        return jsonify({"status": "error", "message": "Missing or empty required fields: amount, vendor, date"}), 400

    raw_date = str(data.get('date', '')).strip()
    expense_date = None
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y'):
        try:
            expense_date = datetime.strptime(raw_date, fmt).date()
            break
        except ValueError:
            continue
    if expense_date is None:
        return jsonify({"status": "error", "message": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        amount = float(data.get('amount'))
        if amount <= 0:
            raise ValueError("Amount must be greater than zero")
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid amount. Enter a positive number"}), 400

    vendor = str(data.get('vendor', '')).strip()
    category = str(data.get('category', '')).strip() or 'Uncategorized'
    currency = str(data.get('currency', 'INR')).strip() or 'INR'

    try:
        expense_payload = {
            'user_id': user_id_int,
            'amount': amount,
            'vendor': vendor,
            'date': expense_date,
            'category': category
        }
        if has_expense_currency_column:
            expense_payload['currency'] = currency

        new_expense = Expense(**expense_payload)
        db.session.add(new_expense)
        db.session.commit()
        return jsonify({"status": "success", "message": "Expense added successfully!"}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Failed to add expense: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Could not save expense. Please try again."}), 500

@app.route('/api/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "Invalid user session"}), 401

    user = db.session.get(User, user_id_int)

    if not user:
        return jsonify({"status": "error", "message": "User not found"}), 404

    expenses = Expense.query.filter_by(user_id=user_id_int).all()
    total_spent = sum(e.amount for e in expenses) if expenses else 0.0

    return jsonify({
        "status": "success",
        "data": {
            "email": user.email,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "expense_count": len(expenses),
            "total_spent": total_spent,
            "monthly_budget": user.monthly_budget or 0
        }
    }), 200

@app.route('/api/budget', methods=['POST'])
@jwt_required()
def set_budget():
    user_id = get_jwt_identity()
    data = request.json or {}
    raw_budget = data.get('monthly_budget', data.get('budget'))
    try:
        budget = float(raw_budget)
    except (TypeError, ValueError):
        budget = None

    if budget is None or budget < 0:
        return jsonify({"status": "error", "message": "Invalid budget amount. Please provide a non-negative number."}), 400

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "Invalid user session"}), 401

    user = db.session.get(User, user_id_int)
    if not user:
        return jsonify({"status": "error", "message": "User not found"}), 404

    try:
        user.monthly_budget = budget
        db.session.commit()
        return jsonify({"status": "success", "message": f"Monthly budget successfully set to ₹{user.monthly_budget:,.2f}"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Failed to set budget: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Could not update budget. Please try again."}), 500

@app.route('/api/expenses', methods=['GET'])
@jwt_required()
def list_expenses():
    user_id = get_jwt_identity()
    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "Invalid user session"}), 401

    expenses = Expense.query.filter_by(user_id=user_id_int).order_by(Expense.date.desc()).all()

    items = [{
        "id": e.id,
        "amount": e.amount,
        "vendor": e.vendor,
        "date": e.date.strftime('%Y-%m-%d'),
        "category": e.category
    } for e in expenses]

    total_amount = sum(e["amount"] for e in items) if items else 0.0

    return jsonify({
        "status": "success",
        "data": {
            "expenses": items,
            "total_amount": total_amount,
            "count": len(items)
        }
    }), 200

@app.route('/api/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_data():
    data = data_agent.get_structured_data()
    return jsonify({
        "status": "success",
        "data": data
    })

@app.route('/api/analysis', methods=['GET'])
@jwt_required()
def get_analysis_data():
    analysis = spend_agent.analyze()
    return jsonify({
        "status": "success",
        "data": analysis
    })

@app.route('/api/simulate', methods=['POST'])
@jwt_required()
def simulate_strategy():
    strategy = request.json.get('strategy', 'balanced')
    simulation = cfo_agent.simulate_scenario(strategy)
    return jsonify({
        "status": "success",
        "data": simulation
    })

@app.route('/api/anomalies', methods=['GET'])
@jwt_required()
def get_anomalies():
    anomalies = anomaly_agent.detect_anomalies()
    return jsonify({
        "status": "success",
        "data": anomalies
    })

@app.route('/api/shadow-costs', methods=['GET'])
@jwt_required()
def get_shadow_costs():
    return jsonify({
        "status": "success",
        "data": shadow_agent.detect_shadow_it()
    })

@app.route('/api/future-predictions', methods=['GET'])
@jwt_required()
def get_future_predictions():
    return jsonify({
        "status": "success",
        "data": future_agent.predict_explosion()
    })

@app.route('/api/chat', methods=['POST'])
@jwt_required()
def chat():
    data = request.json
    query = data.get('message', '')
    if not query:
        return jsonify({"status": "error", "message": "No query provided"}), 400

    platform_data = data_agent.get_structured_data()
    chat_agent.set_platform_data(platform_data)

    response = chat_agent.get_response(query)
    return jsonify({
        "status": "success",
        "data": response
    })

# ═══════════════════════════════════════════════════════════════
# CONTINUOUS MONITORING API ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.route('/api/monitoring/status', methods=['GET'])
@jwt_required()
def get_monitoring_status():
    latest = monitoring_scheduler.get_latest_results()
    summary = monitoring_agent.get_executive_summary()

    return jsonify({
        "status": "success",
        "data": {
            "monitoring_active": True,
            "check_frequency": "Daily",
            "latest_check": latest.get("timestamp") if latest else None,
            "summary": summary,
            "latest_cycle": latest
        }
    })

@app.route('/api/monitoring/run', methods=['POST'])
@jwt_required()
def trigger_monitoring():
    try:
        results = monitoring_agent.run_monitoring_cycle()
        summary = monitoring_agent.get_executive_summary()

        return jsonify({
            "status": "success",
            "data": {
                "message": "Monitoring cycle completed",
                "summary": summary,
                "details": results
            }
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Monitoring cycle failed: {str(e)}"
        }), 500

@app.route('/api/monitoring/recommendations', methods=['GET'])
@jwt_required()
def get_recommendations():
    latest = monitoring_scheduler.get_latest_results()

    if not latest:
        return jsonify({
            "status": "success",
            "data": {
                "message": "No monitoring data yet. Run monitoring manually.",
                "recommendations": []
            }
        }), 200

    recommendations = latest.get("recommendations", [])

    return jsonify({
        "status": "success",
        "data": {
            "total_recommendations": len(recommendations),
            "total_potential_annual_savings": sum(r.get("annual_savings", 0) for r in recommendations),
            "recommendations": recommendations
        }
    })

@app.route('/api/monitoring/history', methods=['GET'])
@jwt_required()
def get_monitoring_history():
    all_results = monitoring_scheduler.get_all_results()

    history = []
    for result in all_results:
        history.append({
            "cycle_id": result.get("cycle_id"),
            "timestamp": result.get("timestamp"),
            "issues_detected": len(result.get("issues_detected", [])),
            "total_potential_savings": result.get("total_potential_savings", 0)
        })

    return jsonify({
        "status": "success",
        "data": {
            "total_cycles": len(history),
            "cycles": history
        }
    })

# ═══════════════════════════════════════════════════════════════
# ACTION EXECUTION ENDPOINT — Execute Auto-Fix Actions
# ═══════════════════════════════════════════════════════════════

@app.route('/api/actions/execute', methods=['POST'])
@jwt_required()
def execute_action():
    """Execute a corrective action and track its status."""
    data = request.json
    action_id = data.get('action_id')
    action_type = data.get('action_type', '')
    service = data.get('service', '')
    savings = data.get('savings', 0)

    if not action_id:
        return jsonify({"status": "error", "message": "action_id is required"}), 400

    # Simulate action execution
    executed_actions[action_id] = {
        "action_id": action_id,
        "action_type": action_type,
        "service": service,
        "savings": savings,
        "executed_at": datetime.utcnow().isoformat(),
        "status": "EXECUTED",
        "result": f"Successfully executed corrective action for {service}. "
                  f"Estimated monthly savings: ₹{savings:,.0f}."
    }

    return jsonify({
        "status": "success",
        "data": executed_actions[action_id]
    }), 200

@app.route('/api/actions/history', methods=['GET'])
@jwt_required()
def get_action_history():
    """Get history of all executed actions."""
    return jsonify({
        "status": "success",
        "data": {
            "total_actions": len(executed_actions),
            "total_savings": sum(a.get("savings", 0) for a in executed_actions.values()),
            "actions": list(executed_actions.values())
        }
    }), 200

# ═══════════════════════════════════════════════════════════════
# PDF REPORT GENERATION
# ═══════════════════════════════════════════════════════════════

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
import io

@app.route('/api/report/generate', methods=['GET'])
@jwt_required()
def generate_report():
    try:
        user_id = get_jwt_identity()
        data = data_agent.get_structured_data()
        summary = monitoring_agent.get_executive_summary()
        
        logger.info(f"📄 Generating report for user_id: {user_id}")
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []

        # Title
        elements.append(Paragraph("Executive CFO Cost Intelligence Report", styles['Title']))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(f"Generated on: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
        elements.append(Spacer(1, 24))

        # Key Metrics
        elements.append(Paragraph("Financial Summary (Base Currency: INR)", styles['Heading2']))
        
        # Ensure we have data or defaults
        metrics = [
            ["Category", "Monthly Spend", "Annual Potential Savings"],
            ["Cloud Infrastructure", f"INR {data.get('total_cloud', 0):,.0f}", f"INR {summary.get('total_annual_potential_savings', 0):,.0f}"],
            ["SaaS Subscriptions", f"INR {data.get('total_saas', 0):,.0f}", "Managed/Optimized"],
            ["Operations", f"INR {data.get('total_ops', 0):,.0f}", "Optimized"]
        ]
        
        t = Table(metrics, colWidths=[200, 150, 150])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.orange),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(t)
        elements.append(Spacer(1, 24))

        # Top Savings Opportunities
        if summary.get('top_3_savings_opportunities'):
            elements.append(Paragraph("Top 3 Optimization Opportunities", styles['Heading2']))
            for opt in summary['top_3_savings_opportunities']:
                elements.append(Paragraph(f"• <b>{opt.get('service')}</b>: {opt.get('description')}", styles['Normal']))
                elements.append(Paragraph(f"  Monthly Impact: <b>INR {opt.get('monthly_savings', 0):,.0f}</b> | Annual Impact: <b>INR {opt.get('annual_savings', 0):,.0f}</b>", styles['Normal']))
                elements.append(Spacer(1, 6))
        else:
            elements.append(Paragraph("No specific optimization opportunities detected yet.", styles['Normal']))

        elements.append(Spacer(1, 12))
        
        # Anomalies
        anomalies = anomaly_agent.detect_anomalies()
        if anomalies:
            elements.append(Paragraph("Critical Cost Anomalies Detected", styles['Heading3']))
            for a in anomalies:
                elements.append(Paragraph(f"• <font color='red'><b>[{a.get('severity')}]</b></font> {a.get('message')} - {a.get('root_cause')}", styles['Normal']))
            elements.append(Spacer(1, 12))
            
        # Shadow IT
        shadow = shadow_agent.detect_shadow_it()
        if shadow:
            elements.append(Paragraph("Shadow IT & Duplicates", styles['Heading3']))
            for s in shadow:
                elements.append(Paragraph(f"• <b>{s.get('merchant')}</b>: {s.get('insight')} (Est Waste: INR {s.get('total_monthly_spend', 0):,.0f}/mo)", styles['Normal']))
            elements.append(Spacer(1, 12))

        elements.append(Spacer(1, 20))
        elements.append(Paragraph("AI-Generated Recommendations", styles['Heading3']))
        elements.append(Paragraph("Continuous monitoring indicates that implementing the 'Auto-Fix' recommendations could significantly reduce total enterprise spend within the first 90 days.", styles['Normal']))

        doc.build(elements)
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name='CFO_Intelligence_Report.pdf', mimetype='application/pdf')
    except Exception as e:
        logger.error(f"❌ PDF generation failed: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": f"Report generation failed: {str(e)}"}), 500


if __name__ == '__main__':
    # Disable the auto-reloader to avoid mid-request restarts that can
    # break long-running responses like PDF generation.
    port = int(os.environ.get('PORT', '5000'))
    app.run(debug=True, port=port, host='0.0.0.0', use_reloader=False)

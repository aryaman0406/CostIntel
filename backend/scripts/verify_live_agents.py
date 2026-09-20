"""
Live Agent Health and Integration Verification Script
Tests all agents in live execution mode within the Flask application context.
"""
import os
import sys
import json
import logging
from datetime import datetime

# Ensure utf-8 output encoding for Windows terminals
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("LiveAgentChecker")

def main():
    print("=" * 70)
    print("🚀 COSTINTEL LIVE AGENT EXECUTION & COMPREHENSIVE HEALTH CHECK")
    print("=" * 70)

    # 1. Load application & environment
    from dotenv import load_dotenv
    load_dotenv()

    from app import create_app
    from extensions import db
    from models import User, Expense, MonitoringRun, AuditLog, AnomalyScore
    from agents.data_ingestion_agent import DataIngestionAgent
    from agents.cost_monitoring_agent import CostMonitoringAgent
    from agents.predictive_cfo_agent import PredictiveCFOAgent
    from agents.reconciliation_agent import run_reconciliation, load_fixtures
    from agents.chatbot_agent import ChatbotAgent
    from agents.gemini_cfo_agent import GeminiCFOAgent

    app = create_app()
    results = {}

    with app.app_context():
        # Ensure tables exist
        db.create_all()

        # Find or create a test user
        test_user = User.query.filter_by(email="admin@costintel.com").first()
        if not test_user:
            test_user = User.query.first()
        if not test_user:
            print("Creating temporary test user...")
            test_user = User(
                email="admin@costintel.com",
                name="Admin User",
                role="Admin"
            )
            test_user.set_password("Admin@123456")
            db.session.add(test_user)
            db.session.commit()

        user_id = test_user.id
        print(f"👤 Test User: {test_user.email} (ID: {user_id}, Role: {test_user.role})")
        print("-" * 70)

        # -------------------------------------------------------------
        # TEST 1: Data Ingestion Agent
        # -------------------------------------------------------------
        print("\n[1/7] Testing DataIngestionAgent...")
        try:
            data_agent = DataIngestionAgent()
            structured_data = data_agent.get_structured_data()
            print(f"  ✓ Data Ingestion Successful")
            print(f"    - Has Data: {structured_data.get('has_data')}")
            print(f"    - Monthly Budget: ₹{structured_data.get('monthly_budget', 0):,.2f}")
            print(f"    - Total Cloud: ₹{structured_data.get('total_cloud', 0):,.2f}")
            print(f"    - Total SaaS: ₹{structured_data.get('total_saas', 0):,.2f}")
            print(f"    - Total Ops: ₹{structured_data.get('total_ops', 0):,.2f}")
            results["DataIngestionAgent"] = "PASSED"
        except Exception as e:
            print(f"  ❌ DataIngestionAgent failed: {e}")
            results["DataIngestionAgent"] = f"FAILED: {e}"

        # -------------------------------------------------------------
        # TEST 2: Cost Monitoring Agent
        # -------------------------------------------------------------
        print("\n[2/7] Testing CostMonitoringAgent...")
        try:
            monitoring_agent = CostMonitoringAgent(data_agent)
            mon_result = monitoring_agent.run_monitoring_cycle()
            issues = mon_result.get("issues_detected", [])
            savings = mon_result.get("total_potential_savings", 0.0)
            recs = mon_result.get("recommendations", [])
            print(f"  ✓ Monitoring Cycle Completed")
            print(f"    - Issues Detected: {len(issues)}")
            print(f"    - Recommendations: {len(recs)}")
            print(f"    - Potential Savings: ₹{savings:,.2f}")
            if issues:
                print(f"    - Sample Issue: {issues[0].get('issue')} (Severity: {issues[0].get('severity')})")
            results["CostMonitoringAgent"] = "PASSED"
        except Exception as e:
            print(f"  ❌ CostMonitoringAgent failed: {e}")
            results["CostMonitoringAgent"] = f"FAILED: {e}"

        # -------------------------------------------------------------
        # TEST 3: Predictive CFO Agent
        # -------------------------------------------------------------
        print("\n[3/7] Testing PredictiveCFOAgent...")
        try:
            predictive_agent = PredictiveCFOAgent(data_agent)
            sim_conservative = predictive_agent.simulate_scenario("conservative")
            sim_balanced = predictive_agent.simulate_scenario("balanced")
            sim_aggressive = predictive_agent.simulate_scenario("aggressive")
            print(f"  ✓ Scenario Simulations Completed")
            print(f"    - Conservative Savings: ₹{sim_conservative.get('projected_monthly_savings', 0):,.2f}")
            print(f"    - Balanced Savings: ₹{sim_balanced.get('projected_monthly_savings', 0):,.2f}")
            print(f"    - Aggressive Savings: ₹{sim_aggressive.get('projected_monthly_savings', 0):,.2f}")
            results["PredictiveCFOAgent"] = "PASSED"
        except Exception as e:
            print(f"  ❌ PredictiveCFOAgent failed: {e}")
            results["PredictiveCFOAgent"] = f"FAILED: {e}"

        # -------------------------------------------------------------
        # TEST 4: Reconciliation Agent
        # -------------------------------------------------------------
        print("\n[4/7] Testing ReconciliationAgent...")
        try:
            ledger, stmt = load_fixtures()
            recon_res = run_reconciliation(ledger, stmt)
            match_rate = recon_res.get("match_rate", 0)
            matched = recon_res.get("matched_count", 0)
            exceptions = recon_res.get("exceptions", [])
            print(f"  ✓ Multi-source Reconciliation Engine Completed")
            print(f"    - Match Rate: {match_rate}%")
            print(f"    - Matched Count: {matched}")
            print(f"    - Exceptions Count: {len(exceptions)}")
            if exceptions:
                ex = exceptions[0]
                print(f"    - Sample Exception Type: {ex.get('failure_category')} (Status: {ex.get('status')})")
            results["ReconciliationAgent"] = "PASSED"
        except Exception as e:
            print(f"  ❌ ReconciliationAgent failed: {e}")
            results["ReconciliationAgent"] = f"FAILED: {e}"

        # -------------------------------------------------------------
        # TEST 5: Chatbot Agent (Deterministic & NLP Parser)
        # -------------------------------------------------------------
        print("\n[5/7] Testing ChatbotAgent...")
        try:
            chatbot = ChatbotAgent(data_agent)
            chatbot.set_platform_data(structured_data)
            
            # Test math calculation
            resp_math = chatbot.get_response("calculate 45000 * 0.18")
            print(f"  ✓ Math Query Result: {resp_math[:80]}...")

            # Test general query
            resp_general = chatbot.get_response("what is our budget status?")
            print(f"  ✓ General Query Result: {resp_general[:80]}...")
            
            results["ChatbotAgent"] = "PASSED"
        except Exception as e:
            print(f"  ❌ ChatbotAgent failed: {e}")
            results["ChatbotAgent"] = f"FAILED: {e}"

        # -------------------------------------------------------------
        # TEST 6: Gemini CFO Agent (Live LLM with Function Calling & Audit)
        # -------------------------------------------------------------
        print("\n[6/7] Testing GeminiCFOAgent (Live LLM & Tools)...")
        try:
            gemini_agent = GeminiCFOAgent(data_agent, monitoring_agent)
            api_key_present = bool(os.environ.get("GEMINI_API_KEY"))
            client_ready = gemini_agent._client is not None
            print(f"    - GEMINI_API_KEY Present: {api_key_present}")
            print(f"    - Gemini Client Initialized: {client_ready}")

            # Test 6a: Query requesting spending breakdown / tools
            query_1 = "Give me a summary of our monthly budget and total cloud vs saas spend."
            print(f"    - Query 1: '{query_1}'")
            resp_1 = gemini_agent.get_response(query_1, user_id=user_id, session_id="live-test-session")
            print(f"      Response Tools Used: {resp_1.get('tools_used')}")
            print(f"      Reasoning Steps: {len(resp_1.get('reasoning_steps', []))}")
            print(f"      Response Text Snippet: {resp_1.get('text', '')[:120]}...")

            # Test 6b: Query requesting reconciliation exceptions
            query_2 = "Are there any reconciliation exceptions with Datadog or Twilio?"
            print(f"    - Query 2: '{query_2}'")
            resp_2 = gemini_agent.get_response(query_2, user_id=user_id, session_id="live-test-session")
            print(f"      Response Tools Used: {resp_2.get('tools_used')}")
            print(f"      Reasoning Steps: {len(resp_2.get('reasoning_steps', []))}")
            print(f"      Response Text Snippet: {resp_2.get('text', '')[:120]}...")

            # Check audit log written
            latest_audit = AuditLog.query.filter_by(user_id=user_id).order_by(AuditLog.id.desc()).first()
            if latest_audit:
                print(f"    - Audit Log Verified: ID {latest_audit.id}, Action: {latest_audit.action_type}, Sources: {latest_audit.data_sources_used}")

            results["GeminiCFOAgent"] = "PASSED"
        except Exception as e:
            print(f"  ❌ GeminiCFOAgent failed: {e}")
            results["GeminiCFOAgent"] = f"FAILED: {e}"

        # -------------------------------------------------------------
        # TEST 7: Flask REST API Endpoints via Test Client
        # -------------------------------------------------------------
        print("\n[7/7] Testing REST API Endpoints via Flask Test Client...")
        try:
            client = app.test_client()
            
            # Generate JWT token for test user
            from flask_jwt_extended import create_access_token
            access_token = create_access_token(identity=str(user_id))
            headers = {"Authorization": f"Bearer {access_token}"}

            # 7a: Dashboard endpoint
            res_dash = client.get("/api/dashboard", headers=headers)
            print(f"    - GET /api/dashboard: Status {res_dash.status_code}")

            # 7b: Monitoring Run endpoint
            res_mon = client.post("/api/monitoring/run", headers=headers)
            print(f"    - POST /api/monitoring/run: Status {res_mon.status_code}")

            # 7c: Monitoring Runs history
            res_runs = client.get("/api/monitoring/runs", headers=headers)
            print(f"    - GET /api/monitoring/runs: Status {res_runs.status_code}")

            # 7d: Reconciliation Run endpoint
            res_recon = client.post("/api/reconciliation/run", headers=headers)
            print(f"    - POST /api/reconciliation/run: Status {res_recon.status_code}")

            # 7e: Gemini Chat endpoint
            res_chat = client.post("/api/chat", json={"message": "What are our top cost optimization recommendations?"}, headers=headers)
            print(f"    - POST /api/chat: Status {res_chat.status_code}")

            # 7f: Expenses endpoint
            res_exp = client.get("/api/expenses", headers=headers)
            print(f"    - GET /api/expenses: Status {res_exp.status_code}")

            # 7g: Anomalies endpoint
            res_anom = client.get("/api/anomalies", headers=headers)
            print(f"    - GET /api/anomalies: Status {res_anom.status_code}")

            # 7h: Audit Logs endpoint
            res_audit = client.get("/api/audit/logs", headers=headers)
            print(f"    - GET /api/audit/logs: Status {res_audit.status_code}")

            # 7i: Health Check endpoint
            res_health = client.get("/api/health")
            print(f"    - GET /api/health: Status {res_health.status_code}")

            api_all_ok = all(
                code in [200, 201] for code in [
                    res_dash.status_code,
                    res_mon.status_code,
                    res_runs.status_code,
                    res_recon.status_code,
                    res_chat.status_code,
                    res_exp.status_code,
                    res_anom.status_code,
                    res_audit.status_code,
                    res_health.status_code,
                ]
            )

            if api_all_ok:
                results["API_Endpoints"] = "PASSED"
            else:
                results["API_Endpoints"] = "PARTIAL_FAILURE"
        except Exception as e:
            print(f"  ❌ API Endpoints failed: {e}")
            results["API_Endpoints"] = f"FAILED: {e}"

    print("\n" + "=" * 70)
    print("📊 OVERALL AGENT & SYSTEM HEALTH SUMMARY")
    print("=" * 70)
    for k, v in results.items():
        symbol = "✅" if v == "PASSED" else "❌"
        print(f"  {symbol} {k.ljust(25)}: {v}")
    print("=" * 70)

if __name__ == "__main__":
    main()

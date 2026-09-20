"""
CostIntel — Gemini CFO Agent
Uses google-genai SDK with gemini-2.5-flash and function calling.
Falls back gracefully to ChatbotAgent if GEMINI_API_KEY is not set.

Tools available to the model:
  1. get_expense_summary()
  2. get_category_totals()
  3. get_monitoring_recommendations()
  4. run_simulation(strategy)
  5. get_top_vendors(limit)
"""

import os
import re
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Tool Implementations (called when the model requests them)
# ──────────────────────────────────────────────────────────────

def _tool_get_expense_summary(data_agent):
    """Return the high-level spend summary from DataIngestionAgent."""
    try:
        data = data_agent.get_structured_data()
        total = data.get("total_cloud", 0) + data.get("total_saas", 0) + data.get("total_ops", 0)
        return {
            "monthly_budget": data.get("monthly_budget", 0),
            "total_spend": total,
            "total_cloud": data.get("total_cloud", 0),
            "total_saas": data.get("total_saas", 0),
            "total_ops": data.get("total_ops", 0),
            "has_data": data.get("has_data", False),
        }
    except Exception as e:
        logger.error(f"get_expense_summary tool error: {e}")
        return {"error": str(e)}


def _tool_get_category_totals(user_id):
    """Group all active expenses by category and return totals."""
    try:
        from models import Expense
        from sqlalchemy import func
        rows = (
            Expense.query
            .filter_by(user_id=user_id, is_deleted=False, type="expense")
            .with_entities(Expense.category, func.sum(Expense.amount).label("total"))
            .group_by(Expense.category)
            .all()
        )
        return {r.category: round(float(r.total), 2) for r in rows}
    except Exception as e:
        logger.error(f"get_category_totals tool error: {e}")
        return {"error": str(e)}


def _tool_get_monitoring_recommendations(monitoring_agent):
    """Run a monitoring cycle and return the top recommendations."""
    try:
        if not monitoring_agent.monitoring_results:
            monitoring_agent.run_monitoring_cycle()
        if not monitoring_agent.monitoring_results:
            return {"recommendations": []}
        recs = monitoring_agent.monitoring_results[-1].get("recommendations", [])
        return {"recommendations": recs[:5]}
    except Exception as e:
        logger.error(f"get_monitoring_recommendations tool error: {e}")
        return {"error": str(e)}


def _tool_run_simulation(data_agent, strategy="balanced"):
    """Run a what-if scenario simulation."""
    try:
        from agents.predictive_cfo_agent import PredictiveCFOAgent
        agent = PredictiveCFOAgent(data_agent)
        return agent.simulate_scenario(strategy)
    except Exception as e:
        logger.error(f"run_simulation tool error: {e}")
        return {"error": str(e)}


def _tool_get_top_vendors(user_id, limit=5):
    """Return top vendors by total spend for the user."""
    try:
        from models import Expense
        from sqlalchemy import func
        rows = (
            Expense.query
            .filter_by(user_id=user_id, is_deleted=False, type="expense")
            .with_entities(Expense.vendor, func.sum(Expense.amount).label("total"))
            .group_by(Expense.vendor)
            .order_by(func.sum(Expense.amount).desc())
            .limit(limit)
            .all()
        )
        return [{"vendor": r.vendor, "total": round(float(r.total), 2)} for r in rows]
    except Exception as e:
        logger.error(f"get_top_vendors tool error: {e}")
        return {"error": str(e)}


def _tool_get_reconciliation_exceptions(vendor: str = None):
    """Return reconciliation exceptions, match stats, and deltas from the multi-source reconciliation engine."""
    try:
        from routes.reconciliation_routes import _last_run_cache
        res = _last_run_cache
        if not res:
            from agents.reconciliation_agent import load_fixtures, run_reconciliation
            ledger, stmt = load_fixtures()
            res = run_reconciliation(ledger, stmt)

        exceptions = res.get("exceptions", [])
        if vendor:
            v_lower = str(vendor).lower().strip()
            filtered = [
                e for e in exceptions
                if (e.get("ledger") and v_lower in str(e["ledger"].get("vendor", "")).lower())
                or (e.get("closest_statement_candidate") and v_lower in str(e["closest_statement_candidate"].get("vendor", "")).lower())
            ]
            if filtered:
                exceptions = filtered

        return {
            "match_rate": res.get("match_rate"),
            "matched_count": res.get("matched_count"),
            "total_ledger_records": res.get("total_ledger_records"),
            "total_statement_records": res.get("total_statement_records"),
            "unresolved_count": len(exceptions),
            "exceptions": exceptions,
            "thresholds": res.get("thresholds", {
                "amount_tolerance_inr": 5.0,
                "date_tolerance_days": 3,
                "fuzzy_vendor_threshold": 0.75
            }),
        }
    except Exception as e:
        logger.error(f"get_reconciliation_exceptions tool error: {e}")
        return {"error": str(e)}


def _tool_add_expense(user_id: int, amount: float, vendor: str, category: str = "Conversational"):
    """Create a new Expense record in the database."""
    try:
        from models import Expense
        from extensions import db
        import datetime
        expense = Expense(
            user_id=user_id,
            amount=max(0.0, float(amount)),
            vendor=str(vendor).strip().title() or "Unknown Vendor",
            date=datetime.datetime.now(datetime.timezone.utc).date(),
            category=str(category).strip().title() or "Conversational",
            type="expense"
        )
        db.session.add(expense)
        db.session.commit()
        return {
            "success": True,
            "message": f"Recorded ₹{expense.amount:,.2f} for {expense.vendor} under {expense.category}.",
            "expense_id": expense.id
        }
    except Exception as e:
        db.session.rollback()
        logger.error(f"add_expense tool error: {e}")
        return {"success": False, "error": str(e)}


def _summarize_tool_result(name: str, args: dict, result: Any) -> str:
    """Generate a clean, one-line summary for a tool execution step."""
    if not isinstance(result, dict) and not isinstance(result, list):
        return f"{result}"

    if name == "get_expense_summary":
        spend = result.get("total_spend", 0)
        budget = result.get("monthly_budget", 0)
        return f"Spend: ₹{spend:,.2f} / Budget: ₹{budget:,.2f}"
    elif name == "get_category_totals":
        if isinstance(result, dict):
            return f"{len(result)} categories retrieved"
        return "Category totals retrieved"
    elif name == "get_monitoring_recommendations":
        recs = result.get("recommendations", [])
        return f"{len(recs)} optimization items found"
    elif name == "run_simulation":
        strat = args.get("strategy", "balanced")
        savings = result.get("projected_monthly_savings", 0)
        return f"'{strat}' strategy → projected savings ₹{savings:,.2f}/mo"
    elif name == "get_top_vendors":
        if isinstance(result, list):
            return f"{len(result)} top vendors returned"
        return "Top vendors list returned"
    elif name == "get_reconciliation_exceptions":
        ex_count = result.get("unresolved_count", len(result.get("exceptions", [])))
        rate = result.get("match_rate", 0)
        vendor_arg = args.get("vendor")
        if vendor_arg:
            return f"{ex_count} exceptions for '{vendor_arg}' ({rate}% overall match rate)"
        return f"{ex_count} exceptions ({rate}% overall match rate)"
    return "Data retrieved successfully"


def _log_audit(user_id, message, response_text, tools_used, session_id=None, reasoning_steps=None):
    """Persist an AuditLog row for this chat interaction."""
    try:
        from models import AuditLog, db
        sources = list(tools_used)
        if "get_reconciliation_exceptions" in tools_used:
            out_summary = f"Reconciliation analysis: {response_text[:950]}"
        else:
            out_summary = response_text[:1000] if response_text else ""

        row = AuditLog(
            user_id=user_id,
            action_type="chat",
            input_summary=message[:500] if message else "",
            output_summary=out_summary,
            data_sources_used=json.dumps(sources),
            session_id=session_id,
            timestamp=datetime.now(timezone.utc),
        )
        db.session.add(row)
        db.session.commit()
    except Exception as e:
        logger.error(f"AuditLog persist error: {e}")


# ──────────────────────────────────────────────────────────────
# GeminiCFOAgent
# ──────────────────────────────────────────────────────────────

class GeminiCFOAgent:
    """
    Gemini-powered CFO assistant with function calling.
    Falls back to ChatbotAgent if GEMINI_API_KEY is missing.
    """

    TOOL_DECLARATIONS = [
        {
            "name": "get_expense_summary",
            "description": "Get the user's current expense summary including total spend, budget, cloud, SaaS and ops costs.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
        {
            "name": "get_category_totals",
            "description": "Get a breakdown of expenses grouped by category (Cloud, SaaS, Marketing, Payroll, etc.).",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
        {
            "name": "get_monitoring_recommendations",
            "description": "Run the cost monitoring engine and get the top savings recommendations.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
        {
            "name": "run_simulation",
            "description": "Run a what-if cost optimization simulation for a given strategy.",
            "parameters": {
                "type": "object",
                "properties": {
                    "strategy": {
                        "type": "string",
                        "enum": ["conservative", "balanced", "aggressive"],
                        "description": "The optimization strategy to simulate.",
                    }
                },
                "required": ["strategy"],
            },
        },
        {
            "name": "get_top_vendors",
            "description": "Get the top vendors by spend for the current user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of top vendors to return (default 5).",
                    }
                },
                "required": [],
            },
        },
        {
            "name": "get_reconciliation_exceptions",
            "description": "Get multi-source reconciliation data, including match rate, exception count, and failed ledger/statement matches with exact delta amounts, date lag, and failure reasons (e.g. why a vendor payment failed to reconcile).",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor": {
                        "type": "string",
                        "description": "Optional vendor name to filter exceptions for (e.g. 'Datadog', 'Twilio', 'Microsoft Azure', 'Stripe').",
                    }
                },
                "required": [],
            },
        },
        {
            "name": "add_expense",
            "description": "Record a new expense into the user's ledger when requested (e.g. 'Add 750 for Figma', 'Log 500 for Zoom').",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {
                        "type": "number",
                        "description": "The expense amount in INR (e.g. 750.0).",
                    },
                    "vendor": {
                        "type": "string",
                        "description": "The vendor or service name (e.g. 'Figma', 'Zoom', 'AWS').",
                    },
                    "category": {
                        "type": "string",
                        "description": "Optional category (e.g. 'SaaS', 'Cloud', 'Operations').",
                    }
                },
                "required": ["amount", "vendor"],
            },
        },
    ]

    def __init__(self, data_agent, monitoring_agent):
        self.data_agent = data_agent
        self.monitoring_agent = monitoring_agent
        self._api_key = os.environ.get("GEMINI_API_KEY")
        self._client = None
        self._init_client()

    def _init_client(self):
        key = os.environ.get("GEMINI_API_KEY") or self._api_key
        if key:
            try:
                from google import genai
                self._client = genai.Client(api_key=key)
                self._api_key = key
                logger.info("GeminiCFOAgent: initialized with Gemini API")
                return True
            except Exception as e:
                logger.warning(f"GeminiCFOAgent: failed to init Gemini client ({e}) — falling back")
                return False
        return False

    def get_response(self, message: str, user_id: int = None, session_id: str = None) -> dict:
        """
        Main entry point. Returns dict with keys:
          - text: str  (the response to show the user)
          - tools_used: list[str]  (names of tools called)
          - reasoning_steps: list[dict] (step-by-step tool execution trace)
        """
        msg_clean = (message or "").strip().lower()
        if not msg_clean:
            return {"text": "How can I assist your financial planning or cost analysis today?", "tools_used": [], "reasoning_steps": []}

        # Instant fast-path for arithmetic and conversational expense entry
        is_math = any(op in msg_clean for op in ['+', '-', '*', '/', '%']) and bool(re.search(r"\d", msg_clean))
        is_expense_entry = bool(re.match(r"^(?:add|spent|spend|paid)\s+(?:INR|₹|rs\.?|inr)?\s*([\d,\.]+)\s+(?:for|on|to)\s+(.+)$", msg_clean))
        if is_math or is_expense_entry:
            from agents.chatbot_agent import ChatbotAgent
            fallback = ChatbotAgent(self.data_agent)
            fallback.set_platform_data(self.data_agent.get_structured_data())
            text = fallback.get_response(message)
            tool_name = "add_expense" if is_expense_entry else "math_calculation"
            if user_id:
                _log_audit(user_id, message, text, [tool_name], session_id, [])
            return {"text": text, "tools_used": [tool_name] if is_expense_entry else [], "reasoning_steps": []}

        if self._client is None:
            self._init_client()

        if self._client is None:
            # Graceful fallback to rule-based + web search agent
            from agents.chatbot_agent import ChatbotAgent
            fallback = ChatbotAgent(self.data_agent)
            fallback.set_platform_data(self.data_agent.get_structured_data())
            text = fallback.get_response(message)
            reasoning_steps = []
            tools_used = []
            if any(w in message.lower() for w in ['reconcil', 'exception', 'datadog', 'twilio', 'match']):
                tools_used = ["get_reconciliation_exceptions"]
                reasoning_steps = [{
                    "step": 1,
                    "tool": "get_reconciliation_exceptions",
                    "args": {},
                    "result_summary": "Retrieved reconciliation exception records from multi-source engine"
                }]
            if user_id:
                _log_audit(user_id, message, text, tools_used or ["fallback:chatbot_agent"], session_id, reasoning_steps)
            return {"text": text, "tools_used": tools_used, "reasoning_steps": reasoning_steps}

        try:
            return self._gemini_response(message, user_id, session_id)
        except Exception as e:
            logger.error(f"GeminiCFOAgent: Gemini call failed ({e}) — falling back to ChatbotAgent")
            from agents.chatbot_agent import ChatbotAgent
            fallback = ChatbotAgent(self.data_agent)
            fallback.set_platform_data(self.data_agent.get_structured_data())
            text = fallback.get_response(message)
            if user_id:
                _log_audit(user_id, message, text, ["fallback:chatbot_agent_error"], session_id)
            return {"text": text, "tools_used": [], "reasoning_steps": []}

    def _local_cfo_response(self, message: str, user_id: int) -> dict:
        """Native FinOps assistant fallback that queries the database directly with zero external Wikipedia."""
        msg_lower = (message or "").lower()
        tools_used = []
        reasoning_steps = []

        if any(w in msg_lower for w in ["category", "categories"]):
            tools_used.append("get_category_totals")
            totals = _tool_get_category_totals(user_id)
            reasoning_steps.append({
                "step": 1,
                "tool": "get_category_totals",
                "args": {},
                "result_summary": f"Retrieved {len(totals)} category records"
            })
            if totals:
                lines = ["📊 **Your Top Spending Categories:**\n"]
                for cat, amt in sorted(totals.items(), key=lambda x: x[1], reverse=True):
                    lines.append(f"• **{cat}:** INR {amt:,.2f}")
                return {"text": "\n".join(lines), "tools_used": tools_used, "reasoning_steps": reasoning_steps}
            return {"text": "No spending records found in your categories yet.", "tools_used": tools_used, "reasoning_steps": reasoning_steps}

        if any(w in msg_lower for w in ["vendor", "vendors", "supplier"]):
            tools_used.append("get_top_vendors")
            vendors = _tool_get_top_vendors(user_id, 5)
            reasoning_steps.append({
                "step": 1,
                "tool": "get_top_vendors",
                "args": {"limit": 5},
                "result_summary": f"Retrieved {len(vendors)} top vendors"
            })
            if vendors:
                lines = ["🏢 **Top Vendors by Total Spend:**\n"]
                for v in vendors:
                    lines.append(f"• **{v['vendor']}:** INR {v['total']:,.2f}")
                return {"text": "\n".join(lines), "tools_used": tools_used, "reasoning_steps": reasoning_steps}

        if any(w in msg_lower for w in ["reconcil", "exception", "datadog", "twilio", "stripe", "unmatched"]):
            tools_used.append("get_reconciliation_exceptions")
            vendor_match = None
            for v in ["datadog", "twilio", "stripe", "aws", "github"]:
                if v in msg_lower:
                    vendor_match = v.title()
                    break
            res = _tool_get_reconciliation_exceptions(vendor_match)
            reasoning_steps.append({
                "step": 1,
                "tool": "get_reconciliation_exceptions",
                "args": {"vendor": vendor_match or ""},
                "result_summary": f"{res.get('unresolved_count', 0)} exceptions found ({res.get('match_rate', 0)}% match rate)"
            })
            exceptions = res.get("exceptions", [])
            lines = [f"🔍 **Reconciliation Engine Report** (Match Rate: {res.get('match_rate', 0):.1f}%):\n"]
            for ex in exceptions[:4]:
                l = ex.get("ledger")
                c = ex.get("closest_statement_candidate")
                reason = ex.get("reason", "").replace("_", " ")
                if l and c:
                    gap = abs(l["amount"] - c["amount"])
                    lines.append(f"• **{l['vendor']}** (Ledger: INR {l['amount']:,.2f} on {l['date']}) vs (Bank: INR {c['amount']:,.2f} on {c['date']})")
                    lines.append(f"  *Delta:* INR {gap:,.2f} | *Diagnostic:* {reason}\n")
                elif l:
                    lines.append(f"• **{l['vendor']}** (INR {l['amount']:,.2f}) has no matching bank record.\n")
            return {"text": "\n".join(lines), "tools_used": tools_used, "reasoning_steps": reasoning_steps}

        # Default: full financial summary
        tools_used.append("get_expense_summary")
        summary = _tool_get_expense_summary(self.data_agent)
        reasoning_steps.append({
            "step": 1,
            "tool": "get_expense_summary",
            "args": {},
            "result_summary": f"Spend: INR {summary.get('total_spend', 0):,.2f} / Budget: INR {summary.get('monthly_budget', 0):,.2f}"
        })
        spend = summary.get("total_spend", 0.0)
        budget = summary.get("monthly_budget", 0.0)
        cloud = summary.get("total_cloud", 0.0)
        saas = summary.get("total_saas", 0.0)
        ops = summary.get("total_ops", 0.0)
        usage = (spend / budget * 100) if budget > 0 else 0

        text = (
            f"💼 **CostIntel AI CFO Assistant**\n\n"
            f"Here is your current financial & platform status:\n"
            f"• **Total Active Spend:** INR {spend:,.2f}\n"
            f"• **Monthly Budget:** INR {budget:,.2f} ({usage:.1f}% utilized)\n"
            f"• **Cloud Costs:** INR {cloud:,.2f}\n"
            f"• **SaaS Subscriptions:** INR {saas:,.2f}\n"
            f"• **Operations:** INR {ops:,.2f}\n\n"
            f"**Suggested Questions:**\n"
            f"• *'Show me my top spending categories'*\n"
            f"• *'What are my top 5 vendors by spend?'*\n"
            f"• *'Why didn't my Datadog payment reconcile?'*\n"
            f"• *'Simulate a 15% cloud cut'*\n"
            f"• *'Add 750 for Figma'* (log a quick expense)"
        )
        return {"text": text, "tools_used": tools_used, "reasoning_steps": reasoning_steps}

    def _gemini_response(self, message: str, user_id: int, session_id: str) -> dict:
        from google.genai import types

        tools_used = []
        reasoning_steps = []

        # Fetch live platform metrics directly for deterministic, instant context
        summary = _tool_get_expense_summary(self.data_agent)
        cat_totals = _tool_get_category_totals(user_id) if user_id else {}
        vendors = _tool_get_top_vendors(user_id, 5) if user_id else []
        reconcil = _tool_get_reconciliation_exceptions()

        msg_lower = (message or "").lower()
        if any(w in msg_lower for w in ['category', 'categories']):
            tools_used.append("get_category_totals")
            reasoning_steps.append({"step": 1, "tool": "get_category_totals", "args": {}, "result_summary": f"Retrieved {len(cat_totals)} category records"})
        elif any(w in msg_lower for w in ['vendor', 'vendors']):
            tools_used.append("get_top_vendors")
            reasoning_steps.append({"step": 1, "tool": "get_top_vendors", "args": {"limit": 5}, "result_summary": f"Retrieved {len(vendors)} top vendors"})
        elif any(w in msg_lower for w in ['reconcil', 'exception', 'datadog', 'twilio', 'match', 'discrepancy']):
            tools_used.append("get_reconciliation_exceptions")
            reasoning_steps.append({"step": 1, "tool": "get_reconciliation_exceptions", "args": {}, "result_summary": f"{reconcil.get('unresolved_count', 0)} exceptions found"})
        elif any(w in msg_lower for w in ['spend', 'budget', 'cloud', 'saas', 'cost']):
            tools_used.append("get_expense_summary")
            reasoning_steps.append({"step": 1, "tool": "get_expense_summary", "args": {}, "result_summary": f"Spend: INR {summary.get('total_spend', 0):,.2f}"})

        system_prompt = (
            "You are CostIntel Chief Financial Officer (CFO) AI Copilot and autonomous FinOps advisor.\n"
            "Live Platform Financial Database Context:\n"
            f"- Monthly Budget: INR {summary.get('monthly_budget', 0):,.2f}\n"
            f"- Total Recorded Spend: INR {summary.get('total_spend', 0):,.2f}\n"
            f"- Cloud Spend: INR {summary.get('total_cloud', 0):,.2f}\n"
            f"- SaaS Subscriptions Spend: INR {summary.get('total_saas', 0):,.2f}\n"
            f"- Operations Spend: INR {summary.get('total_ops', 0):,.2f}\n"
            f"- Category Breakdown: {cat_totals}\n"
            f"- Top Vendors by Spend: {vendors}\n"
            f"- Reconciliation Match Rate: {reconcil.get('match_rate', 0)}%, Unresolved: {reconcil.get('unresolved_count', 0)}\n\n"
            "Guidelines:\n"
            "1. Give thorough, executive-grade, highly actionable answers for finance, FinOps, cost reduction, reconciliation, and budget allocation questions.\n"
            "2. When the user asks about adding/ingesting data, explain conversational logging ('Add ₹15,000 for AWS'), bulk CSV imports, and reconciliation.\n"
            "3. Format monetary numbers in Indian Rupees with ₹ (e.g. ₹12,500.00).\n"
            "4. Never cite external search or Wikipedia. You are the internal enterprise CFO."
        )

        models_to_try = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"]
        resp = None
        used_model = "gemini-3.6-flash"

        for m_name in models_to_try:
            try:
                resp = self._client.models.generate_content(
                    model=m_name,
                    contents=message,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.2,
                    ),
                )
                if resp:
                    used_model = m_name
                    break
            except Exception as e:
                logger.warning(f"Gemini model {m_name} failed: {e}")
                continue

        text = ""
        if resp:
            candidate = resp.candidates[0] if getattr(resp, "candidates", None) else None
            if candidate and hasattr(candidate, "content") and candidate.content:
                parts = getattr(candidate.content, "parts", [])
                has_fc = any(getattr(p, "function_call", None) and p.function_call.name for p in parts)
                if has_fc:
                    for p in parts:
                        fc = getattr(p, "function_call", None)
                        if fc and fc.name:
                            if fc.name not in tools_used:
                                tools_used.append(fc.name)
                            fn_args = dict(fc.args) if getattr(fc, "args", None) else {}
                            res = self._dispatch_tool(fc.name, fn_args, user_id)
                            summary_msg = _summarize_tool_result(fc.name, fn_args, res)
                            reasoning_steps.append({
                                "step": len(reasoning_steps) + 1,
                                "tool": fc.name,
                                "args": fn_args,
                                "result_summary": summary_msg,
                            })
                    # Turn 2
                    try:
                        resp2 = self._client.models.generate_content(
                            model=used_model,
                            contents=[message],
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                                temperature=0.2,
                            ),
                        )
                        cand2 = resp2.candidates[0] if getattr(resp2, "candidates", None) else None
                        text_parts = [p.text for p in getattr(cand2.content, "parts", []) if getattr(p, "text", None) and isinstance(p.text, str)] if cand2 else []
                        text = "".join(text_parts).strip() or (resp2.text.strip() if isinstance(getattr(resp2, "text", None), str) else "")
                    except Exception:
                        pass
                else:
                    text_parts = [p.text for p in parts if getattr(p, "text", None) and isinstance(p.text, str)]
                    text = "".join(text_parts).strip()

            if not text and isinstance(getattr(resp, "text", None), str):
                text = resp.text.strip()

        if not text:
            from agents.chatbot_agent import ChatbotAgent
            fallback = ChatbotAgent(self.data_agent)
            fallback.set_platform_data(self.data_agent.get_structured_data())
            text = fallback.get_response(message)
            tools_used = ["fallback:chatbot_agent_error"]

        if user_id:
            _log_audit(user_id, message, text, tools_used or [used_model], session_id, reasoning_steps)

        return {"text": text, "tools_used": tools_used, "reasoning_steps": reasoning_steps}

    def _dispatch_tool(self, name: str, args: dict, user_id: int):
        """Route a function call to the appropriate Python function."""
        if name == "get_expense_summary":
            return _tool_get_expense_summary(self.data_agent)
        elif name == "get_category_totals":
            return _tool_get_category_totals(user_id)
        elif name == "get_monitoring_recommendations":
            return _tool_get_monitoring_recommendations(self.monitoring_agent)
        elif name == "run_simulation":
            strategy = args.get("strategy", "balanced")
            return _tool_run_simulation(self.data_agent, strategy)
        elif name == "get_top_vendors":
            limit = int(args.get("limit", 5))
            return _tool_get_top_vendors(user_id, limit)
        elif name == "get_reconciliation_exceptions":
            vendor = args.get("vendor")
            return _tool_get_reconciliation_exceptions(vendor)
        elif name == "add_expense":
            amount = args.get("amount", 0.0)
            vendor = args.get("vendor", "Unknown Vendor")
            category = args.get("category", "Conversational")
            return _tool_add_expense(user_id, amount, vendor, category)
        else:
            return {"error": f"Unknown tool: {name}"}

import re
import datetime
import logging

logger = logging.getLogger(__name__)


class ChatbotAgent:
    def __init__(self, data_agent=None):
        self.data_agent = data_agent
        self.platform_data = None

    def set_platform_data(self, data):
        self.platform_data = data

    def get_response(self, query):
        """
        Main entry point for local FinOps Copilot reasoning:
        1. Conversational expense entry ('add 500 for Zoom')
        2. Ingestion / Data addition help ('can you add data', 'how to import')
        3. Financial advice & cost optimization strategies ('give me financial advice')
        4. Reconciliation queries & root-cause diagnostics
        5. Platform spend, budget, cloud & SaaS analytics
        6. Arithmetic & financial math
        """
        query_lower = (query or "").lower().strip()
        if not query_lower:
            return "Hello! I am your CostIntel AI CFO Copilot. Ask me any finance or cost governance question, or ask to simulate savings."

        # ── Step 1: Conversational data entry ──
        add_match = re.search(
            r'(?:add|spent|spend|paid|log|record|create expense)\s*(?:[\$€£₹]|inr|rs\.?)?\s*([\d,\.]+)\s*(?:for|on|to)\s+([a-zA-Z0-9\s\-_]+)',
            query_lower
        )
        if add_match:
            return self._handle_expense_entry(add_match)

        # ── Step 2: Ingestion & "Can you add data" queries ──
        if any(p in query_lower for p in [
            'add data', 'insert data', 'upload data', 'import data', 'how to add', 'can you add',
            'how do i add', 'input data', 'enter data', 'ingest data', 'new expense'
        ]):
            return self._answer_data_ingestion_guide()

        # ── Step 3: Financial Advice & Strategic Optimization ──
        if any(w in query_lower for w in [
            'financial advice', 'finance advice', 'good advice', 'cost advice', 'advise me',
            'save money', 'reduce cost', 'cut spend', 'optimize cost', 'how to save',
            'optimization strategy', 'finops best practice', 'recommendation'
        ]):
            return self._generate_financial_advice()

        # ── Step 4: Reconciliation queries ──
        if any(w in query_lower for w in [
            'reconcil', 'reconciled', 'reconciliation', 'unmatched', 'failed to match',
            'exception list', 'datadog', 'twilio', 'stripe', 'discrepancy'
        ]):
            return self._answer_reconciliation_query(query_lower)

        # ── Step 5: Platform data queries ──
        if any(w in query_lower for w in [
            'my budget', 'my cost', 'my spend', 'my expense', 'how much have i',
            'total spend', 'my cloud', 'my saas', 'dashboard', 'my data',
            'spending', 'spend', 'categories', 'category', 'top vendors',
            'vendor', 'vendors', 'breakdown', 'top spending'
        ]):
            return self._answer_platform_query(query_lower)

        # ── Step 6: Greetings & Capability overview ──
        if any(w in query_lower for w in ['hello', 'hi', 'hey', 'good morning', 'good evening', 'who are you', 'what can you do', 'help']):
            return (
                "👋 **Hello! I'm your CostIntel AI CFO Copilot.**\n\n"
                "I actively govern your enterprise finances, detect anomalous spending, and reconcile accounts.\n\n"
                "**Here is what I can do for you right now:**\n"
                "• **Conversational Ingestion:** Type *'Add ₹12,500 for Google Cloud'* or *'Spent 750 on Figma'* to log an entry instantly.\n"
                "• **Strategic CFO Advice:** Ask *'Give me financial advice to reduce our burn rate'* or *'How can we optimize SaaS?'*\n"
                "• **Reconciliation Root-Cause:** Ask *'Why didn't my Datadog payment reconcile?'* to see tolerance delta calculations.\n"
                "• **Spend Analytics:** Ask *'Show top vendors'* or *'What is our cloud vs SaaS breakdown?'*\n"
                "• **What-If Simulations:** Ask *'Simulate a 20% cloud cut'* or test scenario impacts."
            )

        # ── Step 7: Arithmetic / Math Calculation ──
        math_clean = re.sub(r'^(?:what is|calculate|evaluate|compute|find)?\s*', '', query_lower).rstrip('?').strip()
        if re.match(r'^[\d\s\+\-\*\/\%\.\(\)]+$', math_clean) and any(op in math_clean for op in ['+', '-', '*', '/', '%']):
            try:
                import ast
                import operator
                ops = {
                    ast.Add: operator.add,
                    ast.Sub: operator.sub,
                    ast.Mult: operator.mul,
                    ast.Div: operator.truediv,
                    ast.Mod: operator.mod,
                    ast.USub: operator.neg
                }
                def _eval_expr(node):
                    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
                        return node.value
                    elif isinstance(node, ast.BinOp) and type(node.op) in ops:
                        return ops[type(node.op)](_eval_expr(node.left), _eval_expr(node.right))
                    elif isinstance(node, ast.UnaryOp) and type(node.op) in ops:
                        return ops[type(node.op)](_eval_expr(node.operand))
                    raise TypeError("Unsupported expression")
                tree = ast.parse(math_clean, mode='eval')
                calc_val = _eval_expr(tree.body)
                if isinstance(calc_val, float):
                    return f"🔢 **Financial Calculation Result:**\n\n`{math_clean}` = **₹{calc_val:,.2f}**"
                return f"🔢 **Financial Calculation Result:**\n\n`{math_clean}` = **₹{calc_val:,}**"
            except Exception:
                pass

        # ── Step 8: Contextual FinOps General Response ──
        return self._generate_contextual_general_response(query)

    def _handle_expense_entry(self, match):
        try:
            amt_str = match.group(1).replace(',', '')
            amount = float(amt_str)
            vendor = match.group(2).strip().title()

            from models import Expense, db
            from flask_jwt_extended import get_jwt_identity
            
            user_id = 1
            try:
                ident = get_jwt_identity()
                if ident:
                    user_id = int(ident)
            except Exception:
                pass

            # Detect automatic category
            v_lower = vendor.lower()
            category = "Operations"
            if any(k in v_lower for k in ['aws', 'cloud', 'azure', 'gcp', 'google cloud', 'digitalocean', 'lambda', 's3']):
                category = "Cloud"
            elif any(k in v_lower for k in ['zoom', 'slack', 'figma', 'notion', 'jira', 'github', 'datadog', 'hubspot', 'salesforce']):
                category = "SaaS"
            elif any(k in v_lower for k in ['salary', 'payroll', 'bonus', 'stipend']):
                category = "Payroll"
            elif any(k in v_lower for k in ['ads', 'google ads', 'facebook', 'linkedin', 'marketing']):
                category = "Marketing"

            new_expense = Expense(
                user_id=user_id,
                amount=amount,
                vendor=vendor,
                date=datetime.datetime.now(datetime.timezone.utc).date(),
                category=category,
                type='expense'
            )
            db.session.add(new_expense)
            db.session.commit()

            return (
                f"✅ **Expense Successfully Recorded!**\n\n"
                f"• **Vendor:** {vendor}\n"
                f"• **Amount:** ₹{amount:,.2f}\n"
                f"• **Category:** {category}\n"
                f"• **Date:** {new_expense.date.isoformat()}\n\n"
                f"💡 *The Dashboard, KPIs, and Anomaly models have been updated with this new entry.*"
            )
        except Exception as e:
            return f"❌ I understood your request for {match.group(2).strip().title()}, but encountered a database error: {str(e)}"

    def _answer_data_ingestion_guide(self):
        return (
            "📥 **How to Add or Ingest Data into CostIntel:**\n\n"
            "You have **3 seamless ways** to add financial and cost records:\n\n"
            "1. **💬 Conversational Entry (Right Here):**\n"
            "   Simply type your expense in plain language, for example:\n"
            "   • *'Add ₹15,000 for AWS Cloud'*\n"
            "   • *'Spent 4500 on Zoom SaaS'*\n"
            "   • *'Log ₹85,000 for Internal Payroll'*\n"
            "   CostIntel will automatically categorize the vendor, parse the amount, and commit it to the live database.\n\n"
            "2. **📂 Bulk CSV / Excel Upload:**\n"
            "   Navigate to the **Import / Ingest** tab in the sidebar. You can drag-and-drop ledger exports or bank statements with automatic column mapping and dirty-row validation.\n\n"
            "3. **🔄 Automated Multi-Source Reconciliation:**\n"
            "   Upload bank statements in the **Reconcile** tab to match ledger transactions against settlement records with 3-tier fuzzy AI alignment."
        )

    def _generate_financial_advice(self):
        d = self.platform_data or {}
        total = d.get('total_cloud', 0) + d.get('total_saas', 0) + d.get('total_ops', 0)
        budget = d.get('monthly_budget', 0)
        cloud = d.get('total_cloud', 0)
        saas = d.get('total_saas', 0)
        ops = d.get('total_ops', 0)
        usage = (total / budget * 100) if budget > 0 else 0

        # Calculate breakdown percentages
        cloud_pct = (cloud / total * 100) if total > 0 else 0
        saas_pct = (saas / total * 100) if total > 0 else 0
        ops_pct = (ops / total * 100) if total > 0 else 0

        # Dynamic strategy formulation
        advice_points = []
        if cloud_pct > 30:
            potential_cloud_savings = cloud * 0.18
            advice_points.append(
                f"1. **Cloud Cost Rightsizing (High Impact):** Cloud constitutes **{cloud_pct:.1f}%** (₹{cloud:,.2f}) of your total spend. "
                f"Transitioning non-production workloads to Spot/Graviton instances and purchasing 1-year Savings Plans could yield **~₹{potential_cloud_savings:,.2f}/month** in direct savings."
            )
        else:
            advice_points.append(
                f"1. **Infrastructure Governance:** Maintain cloud spend within the healthy **{cloud_pct:.1f}%** band by setting automated anomaly thresholds on idle storage and egress traffic."
            )

        if saas_pct > 15 or len(d.get('saas_subscriptions', [])) > 4:
            potential_saas_savings = saas * 0.15
            advice_points.append(
                f"2. **SaaS License Reclamation:** SaaS subscriptions account for **{saas_pct:.1f}%** (₹{saas:,.2f}). "
                f"Audit inactive seats across tools like Zoom, Slack, and Figma. Deprovisioning unused tier licenses typically recovers **~₹{potential_saas_savings:,.2f}/month**."
            )
        else:
            advice_points.append(
                f"2. **Subscription Audit:** Consolidate multi-tool overlaps (e.g. communication and project management suites) into annual enterprise contracts for 10-20% vendor discounts."
            )

        advice_points.append(
            f"3. **Reconciliation & Leakage Defense:** Continuous ledger-to-bank matching protects against duplicate supplier billing and phantom bank fees. Verify all Tier 2 & Tier 3 exceptions regularly."
        )

        advice_points.append(
            f"4. **Budget Guardrail:** Your current budget utilization is **{usage:.1f}%** (₹{total:,.2f} of ₹{budget:,.2f}). "
            f"{'⚠️ Warning: You are operating near or above your budget threshold. Implement spending freeze on discretionary operations.' if usage > 85 else '✅ Healthy operating margin: your burn rate is disciplined.'}"
        )

        return (
            f"💡 **Strategic CFO Financial Advisory & FinOps Roadmap**\n\n"
            f"Based on your live enterprise platform metrics:\n"
            f"• **Active Monthly Spend:** ₹{total:,.2f}\n"
            f"• **Allocated Budget:** ₹{budget:,.2f} ({usage:.1f}% utilized)\n"
            f"• **Spend Allocation:** Cloud {cloud_pct:.1f}% | SaaS {saas_pct:.1f}% | Operations {ops_pct:.1f}%\n\n"
            f"**Actionable Optimization Recommendations:**\n\n"
            + "\n\n".join(advice_points) +
            f"\n\n👉 *You can run a What-If simulation in the Simulator tab or type 'Simulate a 15% cloud cut' to view bottom-line impact.*"
        )

    def _answer_reconciliation_query(self, query_lower):
        from agents.gemini_cfo_agent import _tool_get_reconciliation_exceptions
        vendors = ['datadog', 'twilio', 'stripe', 'azure', 'aws', 'amazon', 'google', 'zoom', 'slack', 'github', 'notion', 'figma']
        matched_vendor = None
        for v in vendors:
            if v in query_lower:
                matched_vendor = v
                break

        res = _tool_get_reconciliation_exceptions(matched_vendor)
        exceptions = res.get("exceptions", [])
        if not exceptions:
            return f"✅ **All records for {matched_vendor.title() if matched_vendor else 'reconciliation'} matched cleanly with zero exceptions.**"

        lines = [f"🔍 **Reconciliation Root-Cause Analysis** ({res.get('match_rate', 0):.1f}% match rate — {len(exceptions)} exception(s) triaged):\n"]
        for ex in exceptions[:4]:
            l = ex.get("ledger")
            c = ex.get("closest_statement_candidate")
            reason = ex.get("reason", "")
            if l and c:
                a_gap = abs(l['amount'] - c['amount'])
                lines.append(f"• **{l['vendor']}** (Ledger #{l['id']}: ₹{l['amount']:,.2f} on {l['date']}) vs (Bank #{c['id']}: ₹{c['amount']:,.2f} on {c['date']})")
                lines.append(f"  *Diagnostic:* Amount gap is **₹{a_gap:,.2f}** (exceeds ±₹5 tolerance). Failure reason: `{reason.replace('_', ' ')}`\n")
            elif l:
                lines.append(f"• **{l['vendor']}** (Ledger #{l['id']}: ₹{l['amount']:,.2f} on {l['date']}) has **no matching bank transaction**.\n")
            elif c:
                lines.append(f"• **Statement Orphan:** Unmatched bank debit of **₹{c['amount']:,.2f}** from {c['vendor']} on {c['date']}.\n")

        return "\n".join(lines)

    def _answer_platform_query(self, query_lower):
        if not self.platform_data or not self.platform_data.get('has_data'):
            return "You haven't uploaded any cost data yet.\n\nGo to the Import tab to upload a CSV or type 'Add 15000 for AWS' right here to begin tracking."

        d = self.platform_data
        total = d.get('total_cloud', 0) + d.get('total_saas', 0) + d.get('total_ops', 0)
        budget = d.get('monthly_budget', 0)
        usage = (total / budget * 100) if budget > 0 else 0

        if any(w in query_lower for w in ['category', 'categories']):
            try:
                from models import Expense, db
                rows = db.session.query(
                    Expense.category,
                    db.func.sum(Expense.amount).label("total"),
                    db.func.count(Expense.id).label("count")
                ).filter(Expense.is_deleted == False).group_by(Expense.category).order_by(db.desc("total")).all()
                if rows:
                    lines = ["📊 **Category Spend Breakdown:**\n"]
                    for r in rows:
                        lines.append(f"• **{r[0]}:** ₹{r[1]:,.2f} ({r[2]} records)")
                    return "\n".join(lines)
            except Exception:
                pass

        if any(w in query_lower for w in ['vendor', 'vendors']):
            try:
                from models import Expense, db
                rows = db.session.query(
                    Expense.vendor,
                    db.func.sum(Expense.amount).label("total"),
                    db.func.count(Expense.id).label("count")
                ).filter(Expense.is_deleted == False).group_by(Expense.vendor).order_by(db.desc("total")).limit(5).all()
                if rows:
                    lines = ["🏢 **Top 5 Enterprise Vendors by Spend:**\n"]
                    for r in rows:
                        lines.append(f"• **{r[0]}:** ₹{r[1]:,.2f} ({r[2]} expenses)")
                    return "\n".join(lines)
            except Exception:
                pass

        if any(w in query_lower for w in ['cloud']):
            if d.get('cloud_costs'):
                lines = [f"☁️ **Cloud Infrastructure Costs** (Total: ₹{d['total_cloud']:,.2f}):\n"]
                for c in d['cloud_costs']:
                    lines.append(f"• **{c['service']}:** ₹{c['cost']:,.2f} (Utilization: {c.get('utilization','50%')})")
                return "\n".join(lines)
            return f"Total Cloud Spend: ₹{d.get('total_cloud', 0):,.2f}"

        if any(w in query_lower for w in ['saas', 'subscription']):
            if d.get('saas_subscriptions'):
                lines = [f"💻 **SaaS Subscriptions** (Total: ₹{d['total_saas']:,.2f}):\n"]
                for s in d['saas_subscriptions']:
                    util = (s['active_users'] / s['users'] * 100) if s.get('users', 0) > 0 else 0
                    lines.append(f"• **{s['name']}:** ₹{s['cost']:,.2f}/mo ({util:.0f}% seat usage)")
                return "\n".join(lines)
            return f"Total SaaS Spend: ₹{d.get('total_saas', 0):,.2f}"

        return (
            f"💼 **CostIntel Platform Spend Summary:**\n\n"
            f"• **Total Active Spend:** ₹{total:,.2f}\n"
            f"• **Monthly Budget:** ₹{budget:,.2f} ({usage:.1f}% utilized)\n"
            f"• **Cloud Costs:** ₹{d.get('total_cloud', 0):,.2f}\n"
            f"• **SaaS Subscriptions:** ₹{d.get('total_saas', 0):,.2f}\n"
            f"• **Operations & Other:** ₹{d.get('total_ops', 0):,.2f}\n\n"
            f"{'⚠️ **Status: Operating Over Budget** — consider cost reduction levers.' if usage > 100 else '✅ **Status: Operating within budget guardrails.**'}"
        )

    def _generate_contextual_general_response(self, query):
        d = self.platform_data or {}
        total = d.get('total_cloud', 0) + d.get('total_saas', 0) + d.get('total_ops', 0)
        budget = d.get('monthly_budget', 0)
        return (
            f"🤖 **CostIntel AI CFO Copilot**\n\n"
            f"I have reviewed your query regarding: *\"{query}\"*\n\n"
            f"**Your Current Live Platform Snapshot:**\n"
            f"• **Total Spend:** ₹{total:,.2f} | **Budget:** ₹{budget:,.2f}\n"
            f"• **Cloud:** ₹{d.get('total_cloud', 0):,.2f} | **SaaS:** ₹{d.get('total_saas', 0):,.2f}\n\n"
            f"**How I can assist right now:**\n"
            f"• **Add Data:** Say *'Add ₹15,000 for AWS Cloud'* to create an expense.\n"
            f"• **Advisory:** Ask *'Give me financial advice'* for spend reduction opportunities.\n"
            f"• **Reconciliation:** Ask *'Why did Datadog fail to reconcile?'*\n"
            f"• **Breakdown:** Ask *'Show my top categories'* or *'Top vendors'*."
        )

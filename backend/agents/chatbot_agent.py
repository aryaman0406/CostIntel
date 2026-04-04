import re
import datetime
import logging
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class ChatbotAgent:
    def __init__(self, data_agent=None):
        self.data_agent = data_agent
        self.platform_data = None

    def set_platform_data(self, data):
        self.platform_data = data

    def get_response(self, query):
        """
        Main entry point:
        1. Conversational expense entry
        2. Platform data queries (budget, costs, etc.)
        3. Web-fetched answers from Wikipedia / Investopedia
        """
        query_lower = query.lower().strip()
        if not query_lower:
            return "Please ask a question and I will answer it using your platform data or web sources."

        # ── Step 1: Conversational data entry ──
        add_match = re.search(
            r'(?:add|spent|paid|log|record)\s*(?:[\$€£₹])?\s*(\d+(?:\.\d+)?)\s*(?:for|on|to)\s+([a-zA-Z0-9\s]+)',
            query_lower
        )
        if add_match:
            return self._handle_expense_entry(add_match)

        # ── Step 2: Platform data queries ──
        if any(w in query_lower for w in ['my budget', 'my cost', 'my spend', 'my expense',
                                           'how much have i', 'total spend', 'my cloud',
                                           'my saas', 'dashboard', 'my data']):
            return self._answer_platform_query(query_lower)

        # ── Step 3: Greetings ──
        if any(w in query_lower for w in ['hello', 'hi', 'hey', 'good morning', 'good evening']):
            return ("Hello! I'm your AI CFO Assistant.\n\n"
                    "I can help you with:\n"
                    "• Your platform data — 'Show my budget', 'My cloud costs'\n"
                    "• Finance knowledge — 'What is ROI?', 'Explain cash flow'\n"
                    "• Expense entry — 'Add 500 for Zoom'\n"
                    "• Any finance topic — I fetch answers from the web in real-time!")

        # ── Step 4: Fetch from web (for any other question) ──
        return self._fetch_from_web(query)

    def _handle_expense_entry(self, match):
        try:
            amount = float(match.group(1))
            vendor = match.group(2).strip().title()

            from models import Expense, db
            from flask_jwt_extended import get_jwt_identity
            user_id = get_jwt_identity()

            new_expense = Expense(
                user_id=user_id,
                amount=amount,
                vendor=vendor,
                date=datetime.datetime.utcnow().date(),
                category='Conversational'
            )
            db.session.add(new_expense)
            db.session.commit()

            return f"✅ Recorded ₹{amount:,.2f} for {vendor}.\nRefresh the dashboard to see updated analytics."
        except Exception as e:
            return f"I understood ₹{match.group(1)} for {match.group(2).strip().title()}, but couldn't save: {str(e)}"

    def _answer_platform_query(self, query_lower):
        if not self.platform_data or not self.platform_data.get('has_data'):
            return "You haven't uploaded any cost data yet.\n\nGo to the Import tab to upload CSV or add expenses manually. Once you have data, I can analyze your budgets, costs, and spending patterns."

        d = self.platform_data
        total = d.get('total_cloud', 0) + d.get('total_saas', 0) + d.get('total_ops', 0)
        budget = d.get('monthly_budget', 0)
        usage = (total / budget * 100) if budget > 0 else 0

        if any(w in query_lower for w in ['cloud']):
            if d.get('cloud_costs'):
                lines = [f"Your Cloud Costs ({len(d['cloud_costs'])} services):"]
                for c in d['cloud_costs']:
                    lines.append(f"  • {c['service']}: ₹{c['cost']:,.0f} (Util: {c.get('utilization','N/A')}, Trend: {c.get('trend','N/A')})")
                lines.append(f"\nTotal Cloud: ₹{d['total_cloud']:,.0f}")
                return "\n".join(lines)
            return "No cloud cost data found in your uploads."

        if any(w in query_lower for w in ['saas', 'subscription']):
            if d.get('saas_subscriptions'):
                lines = [f"Your SaaS Subscriptions ({len(d['saas_subscriptions'])}):"]
                for s in d['saas_subscriptions']:
                    util = (s['active_users'] / s['users'] * 100) if s.get('users', 0) > 0 else 0
                    lines.append(f"  • {s['name']}: ₹{s['cost']:,.0f}/mo ({util:.0f}% utilized)")
                lines.append(f"\nTotal SaaS: ₹{d['total_saas']:,.0f}")
                return "\n".join(lines)
            return "No SaaS data found in your uploads."

        # General budget/spend summary
        return (f"Your Cost Summary:\n"
                f"  • Monthly Budget: ₹{budget:,.0f}\n"
                f"  • Total Spend: ₹{total:,.0f}\n"
                f"  • Budget Usage: {usage:.1f}%\n"
                f"  • Cloud: ₹{d.get('total_cloud', 0):,.0f}\n"
                f"  • SaaS: ₹{d.get('total_saas', 0):,.0f}\n"
                f"  • Operations: ₹{d.get('total_ops', 0):,.0f}\n\n"
                f"{'⚠️ You are over budget!' if usage > 100 else '✅ Within budget.'}")

    def _fetch_from_web(self, query):
        """Fetch answer from the web for out-of-scope questions."""

        # Try Wikipedia first
        wiki_answer = self._search_wikipedia(query)
        if wiki_answer:
            return wiki_answer

        # Try general web search scraping
        web_answer = self._search_web_general(query)
        if web_answer:
            return web_answer

        return (f"I couldn't find specific information about '{query}' from the web.\n\n"
                "Try rephrasing your question, or ask about:\n"
                "• General knowledge questions\n"
                "• Finance terms (ROI, NPV, WACC, cash flow)\n"
                "• Cost management (budgeting, forecasting)\n"
                "• Your platform data ('Show my budget')")

    def _search_wikipedia(self, query):
        """Search Wikipedia for finance/general knowledge."""
        try:
            import wikipedia
            wikipedia.set_lang("en")

            # Search for relevant pages
            results = wikipedia.search(query, results=3)

            if not results:
                return None

            # Get summary of best match
            try:
                summary = wikipedia.summary(results[0], sentences=5)
            except wikipedia.DisambiguationError as e:
                # Pick the first option from disambiguation
                try:
                    summary = wikipedia.summary(e.options[0], sentences=5)
                except:
                    return None
            except wikipedia.PageError:
                return None

            if len(summary) < 50:
                return None

            # Trim if too long
            if len(summary) > 800:
                summary = summary[:800] + "..."

            return f"📚 From Wikipedia:\n\n{summary}\n\n— Source: Wikipedia ({results[0]})"

        except ImportError:
            logger.warning("Wikipedia module not installed")
            return None
        except Exception as e:
            logger.error(f"Wikipedia search failed: {e}")
            return None



    def _search_web_general(self, query):
        """Scrape DuckDuckGo for a quick answer on any topic."""
        try:
            search_url = f"https://html.duckduckgo.com/html/?q={query.replace(' ', '+')}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }

            resp = requests.get(search_url, headers=headers, timeout=8)
            if resp.status_code != 200:
                return None

            soup = BeautifulSoup(resp.text, 'html.parser')

            # Extract search result snippets
            snippets = soup.select('.result__snippet')
            if not snippets:
                return None

            results = []
            for snip in snippets[:3]:
                text = snip.get_text(strip=True)
                if len(text) > 30:
                    results.append(f"• {text}")

            if not results:
                return None

            return f"🔍 Web Search Results for '{query}':\n\n" + "\n\n".join(results) + "\n\n— Source: Web Search"

        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return None

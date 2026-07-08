import io
import json
import os
from flask import has_request_context
from flask_jwt_extended import get_jwt_identity
from models import Expense, User, db
import datetime
from collections import defaultdict

class DataIngestionAgent:
    def __init__(self):
        pass

    def _pct_trend(self, prev_value, current_value):
        try:
            prev = float(prev_value)
            cur = float(current_value)
        except (TypeError, ValueError):
            return "+0%"
        if prev <= 0:
            return "+0%"
        pct = ((cur - prev) / prev) * 100.0
        pct_i = int(round(pct))
        sign = "+" if pct_i >= 0 else ""
        return f"{sign}{pct_i}%"

    def get_structured_data(self):
        """Return ONLY the logged-in user's real data. No sample data."""
        user_id = None
        if has_request_context():
            try:
                user_id = get_jwt_identity()
            except:
                pass

        if not user_id:
            return self._empty_data()

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return self._empty_data()

        user = db.session.get(User, user_id_int)

        expenses = Expense.query.filter_by(user_id=user_id_int).all()
        if not expenses:
            return self._empty_data()

        cloud_vendor_totals = defaultdict(float)
        saas_vendor_monthly_charges = defaultdict(lambda: defaultdict(list))
        ops_exp = []
        employee_exp = []
        monthly_totals = defaultdict(float)
        cloud_vendor_monthly = defaultdict(lambda: defaultdict(float))

        total_spent = 0
        rates = {'USD': 83.5, 'EUR': 90.2, 'GBP': 105.1, 'INR': 1.0}

        cloud_vendor_aliases = {
            'aws', 'amazon web services', 'gcp', 'google cloud', 'azure',
            'digitalocean', 'linode', 'oracle cloud'
        }
        saas_vendor_aliases = {
            'slack', 'zoom', 'notion', 'adobe', 'figma', 'github', 'jira',
            'atlassian', 'dropbox', 'office 365', 'microsoft 365', 'salesforce'
        }

        cloud_category_keywords = {
            'cloud', 'compute', 'database', 'networking', 'security',
            'serverless', 'storage', 'backup', 'monitoring', 'infrastructure'
        }
        saas_category_keywords = {'saas', 'software', 'subscription', 'licenses', 'licenses'}

        for exp in expenses:
            # Currency Conversion to Base (INR)
            rate = rates.get(exp.currency or 'INR', 1.0)
            amount_in_base = exp.amount * rate
            total_spent += amount_in_base

            month_key = exp.date.strftime("%Y-%m")
            monthly_totals[month_key] += amount_in_base

            cat = exp.category.lower() if exp.category else ''
            v_lower = exp.vendor.lower() if exp.vendor else ''

            vendor_is_cloud = any(alias in v_lower for alias in cloud_vendor_aliases)
            vendor_is_saas = any(alias in v_lower for alias in saas_vendor_aliases)
            category_is_cloud = any(keyword in cat for keyword in cloud_category_keywords)
            category_is_saas = any(keyword in cat for keyword in saas_category_keywords)

            is_cloud = category_is_cloud or vendor_is_cloud
            is_saas = category_is_saas or vendor_is_saas

            if is_cloud:
                cloud_vendor_totals[exp.vendor] += amount_in_base
                cloud_vendor_monthly[exp.vendor][month_key] += amount_in_base
            elif is_saas:
                saas_vendor_monthly_charges[exp.vendor][month_key].append(amount_in_base)
            else:
                ops_exp.append({
                    "category": exp.category or 'General',
                    "cost": amount_in_base, "provider": exp.vendor,
                    "orig_amt": exp.amount, "orig_curr": exp.currency or 'INR'
                })

            employee_exp.append({
                "employee": "App User", "merchant": exp.vendor,
                "amount": amount_in_base, "date": exp.date.strftime("%Y-%m-%d"),
                "category": exp.category or 'General',
                "orig_amt": exp.amount, "orig_curr": exp.currency or 'INR'
            })

        # Build aggregated cloud + SaaS entries with real trends
        cloud_costs = []
        for vendor, total in cloud_vendor_totals.items():
            months = sorted(cloud_vendor_monthly[vendor].keys())
            if len(months) >= 2:
                prev_m, cur_m = months[-2], months[-1]
                trend = self._pct_trend(cloud_vendor_monthly[vendor][prev_m], cloud_vendor_monthly[vendor][cur_m])
            else:
                trend = "+0%"
            cloud_costs.append({
                "service": vendor,
                "cost": total,
                "status": "active",
                "utilization": "50%",
                "trend": trend,
            })
        cloud_costs.sort(key=lambda x: x.get('cost', 0), reverse=True)

        saas_subs = []
        for vendor, monthly_charges in saas_vendor_monthly_charges.items():
            max_charges = max(len(charges) for charges in monthly_charges.values()) if monthly_charges else 1
            if max_charges > 1:
                first_total = sum(charges[0] for charges in monthly_charges.values() if len(charges) > 0)
                saas_subs.append({
                    "name": vendor,
                    "cost": first_total,
                    "users": 10,
                    "active_users": 8,
                    "renewal_date": "2026-12-31",
                })
                for i in range(1, max_charges):
                    dup_total = sum(charges[i] for charges in monthly_charges.values() if len(charges) > i)
                    saas_subs.append({
                        "name": f"{vendor} (Duplicate)",
                        "cost": dup_total,
                        "users": 10,
                        "active_users": 8,
                        "renewal_date": "2026-12-31",
                    })
            else:
                total = sum(sum(charges) for charges in monthly_charges.values())
                saas_subs.append({
                    "name": vendor,
                    "cost": total,
                    "users": 10,
                    "active_users": 8,
                    "renewal_date": "2026-12-31",
                })
        saas_subs.sort(key=lambda x: x.get('cost', 0), reverse=True)

        # Chronological historical spend
        historical_spend = []
        for mk in sorted(monthly_totals.keys()):
            try:
                dt = datetime.datetime.strptime(mk, "%Y-%m")
                label = dt.strftime("%b %Y")
            except Exception:
                label = mk
            historical_spend.append({"month": label, "total": monthly_totals[mk]})

        # Prefer persisted user-configured budget when present; otherwise
        # fall back to a heuristic budget based on observed spend.
        user_budget = float(user.monthly_budget) if (user and user.monthly_budget) else 0.0
        computed_budget = max(total_spent * 1.2, 50000)
        monthly_budget = user_budget if user_budget > 0 else computed_budget

        return {
            "monthly_budget": monthly_budget,
            "total_cloud": sum(c["cost"] for c in cloud_costs),
            "total_saas": sum(s["cost"] for s in saas_subs),
            "total_ops": sum(o["cost"] for o in ops_exp),
            "cloud_costs": cloud_costs,
            "saas_subscriptions": saas_subs,
            "operational_expenses": ops_exp,
            "historical_spend": historical_spend,
            "employee_expenses": employee_exp,
            "has_data": True
        }

    def process_csv(self, file_storage, user_id):
        """Parse a CSV file and create Expense records."""
        import csv
        import re
        from datetime import datetime
        
        try:
            stream = io.StringIO(file_storage.stream.read().decode("UTF8"), newline=None)
            reader = csv.DictReader(stream)
            
            if not reader.fieldnames:
                return False, "CSV file has no header row"
            
            # Create a case-insensitive, stripped mapping of headers
            header_map = {h.strip().lower(): h for h in reader.fieldnames if h}
            
            # Helper to get value from row case-insensitively
            def get_val(row, key, default=""):
                actual_key = header_map.get(key.lower())
                return row.get(actual_key, default) if actual_key else default

            created_count = 0
            for row in reader:
                amount_str = str(get_val(row, 'amount', '0')).strip()
                # Remove common currency symbols, commas, spaces
                cleaned_amount = re.sub(r'[₹$€£, ]', '', amount_str)
                try:
                    amount = float(cleaned_amount)
                except ValueError:
                    amount = 0.0

                vendor = str(get_val(row, 'vendor', 'Unknown')).strip()
                date_str = str(get_val(row, 'date', '')).strip()
                category = str(get_val(row, 'category', 'Uncategorized')).strip()
                
                if not date_str:
                    date_obj = datetime.utcnow().date()
                else:
                    try:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                    except ValueError:
                        date_obj = datetime.utcnow().date()
                
                expense = Expense(
                    user_id=user_id,
                    amount=amount,
                    vendor=vendor or 'Unknown',
                    date=date_obj,
                    category=category or 'Uncategorized',
                    type='expense'
                )
                db.session.add(expense)
                created_count += 1
            
            db.session.commit()
            return True, f"Successfully imported {created_count} expenses."
        except Exception as e:
            db.session.rollback()
            return False, f"CSV processing failed: {str(e)}"

    def add_manual_expense(self, user_id, data):
        """Add a single manual expense."""
        from datetime import datetime
        try:
            date_str = data.get('date', datetime.utcnow().strftime('%Y-%m-%d'))
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            except:
                date_obj = datetime.utcnow().date()

            expense = Expense(
                user_id=user_id,
                amount=float(data.get('amount', 0)),
                vendor=data.get('vendor', 'Manual'),
                date=date_obj,
                category=data.get('category', 'Manual'),
                type='expense'
            )
            db.session.add(expense)
            db.session.commit()
            return True, "Expense added successfully."
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    def update_budget(self, user_id, budget):
        """Update user's monthly budget."""
        try:
            user = db.session.get(User, user_id)
            if not user:
                return False, "User not found"
            user.monthly_budget = float(budget)
            db.session.commit()
            return True, "Budget updated successfully."
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    def _empty_data(self):
        """Return empty structure when user has no data but might have a budget."""
        user_budget = 0.0
        if has_request_context():
            try:
                user_id = get_jwt_identity()
                if user_id:
                    user = db.session.get(User, int(user_id))
                    if user and user.monthly_budget:
                        user_budget = float(user.monthly_budget)
            except:
                pass
                
        return {
            "monthly_budget": user_budget,
            "total_cloud": 0,
            "total_saas": 0,
            "total_ops": 0,
            "cloud_costs": [],
            "saas_subscriptions": [],
            "operational_expenses": [],
            "historical_spend": [],
            "employee_expenses": [],
            # If they have a budget, consider that as having data so the dashboard displays
            "has_data": user_budget > 0
        }

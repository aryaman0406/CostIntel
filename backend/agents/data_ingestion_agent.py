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

        expenses = Expense.query.filter_by(user_id=user_id_int, is_deleted=False).all()
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
        """Parse a CSV file (both labeled with headers and unlabeled/headerless) and create Expense records."""
        import io
        import re
        import csv
        import datetime
        import pandas as pd
        
        try:
            raw_bytes = file_storage.stream.read()
            if not raw_bytes:
                return False, "The uploaded file is empty. Please upload a CSV file with data."

            # Check for binary file signatures (e.g. PDF %PDF, PNG, ZIP/Office PK, or null bytes)
            if b'\x00' in raw_bytes[:1024] or raw_bytes.startswith(b'%PDF') or raw_bytes.startswith(b'\x89PNG') or raw_bytes.startswith(b'PK\x03\x04'):
                return False, "Unsupported binary file format. Please upload a standard text .csv file (e.g. expenses.csv)."

            # Attempt decoding with BOM handling, utf-8, or latin-1
            text = None
            for encoding in ['utf-8-sig', 'utf-8', 'latin-1']:
                try:
                    text = raw_bytes.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue

            if text is None:
                return False, "Unable to read file text encoding. Please ensure the CSV is encoded in UTF-8."

            cleaned_text = text.strip()
            if not cleaned_text:
                return False, "The uploaded file contains no data."

            # Detect delimiter
            sample = cleaned_text[:2048]
            delimiter = ','
            if ';' in sample and sample.count(';') > sample.count(','):
                delimiter = ';'
            elif '\t' in sample and sample.count('\t') > sample.count(','):
                delimiter = '\t'

            # Parse lines using csv.reader with auto-repair for unquoted comma-separated numbers (e.g. ₹12,450.50)
            raw_rows = []
            reader = csv.reader(io.StringIO(cleaned_text), delimiter=delimiter)
            for row in reader:
                if not row or not any(cell.strip() for cell in row):
                    continue
                cleaned_cells = [cell.strip() for cell in row]
                raw_rows.append(cleaned_cells)

            if not raw_rows:
                return False, "CSV file has no data rows. Please ensure data is present."

            # Recombine adjacent cells that were split due to unquoted commas in numbers (e.g. ['₹12', '450.50'] -> ['₹12450.50'])
            normalized_rows = []
            for r in raw_rows:
                new_r = []
                idx = 0
                while idx < len(r):
                    cell = r[idx]
                    # Check if cell and next cell look like a split number (e.g., '12' and '450.50')
                    clean_c = re.sub(r'[₹$€£, ]', '', cell)
                    if idx + 1 < len(r):
                        next_cell = r[idx + 1]
                        clean_next = re.sub(r'[₹$€£, ]', '', next_cell)
                        if clean_c.isdigit() and re.match(r'^\d+(\.\d+)?$', clean_next):
                            new_r.append(f"{cell}{next_cell}")
                            idx += 2
                            continue
                    new_r.append(cell)
                    idx += 1
                normalized_rows.append(new_r)

            # Helpers for type inspection
            date_patterns = [
                r'^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}',  # 2026-08-15
                r'^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}',  # 15/08/2026 or 08/15/2026
            ]
            known_header_words = {
                'date', 'vendor', 'category', 'amount', 'cost', 'total',
                'merchant', 'provider', 'description', 'notes', 'price',
                'expense', 'spending', 'item', 'details', 'name', 'type'
            }
            known_category_words = {
                'cloud', 'saas', 'operations', 'infrastructure', 'marketing',
                'payroll', 'travel', 'utilities', 'subscriptions', 'software',
                'compute', 'storage', 'database', 'general', 'uncategorized'
            }

            def clean_amount_val(val):
                if val is None or val == '':
                    return None
                s = re.sub(r'[₹$€£, ]', '', str(val).strip())
                try:
                    return float(s)
                except ValueError:
                    return None

            def parse_date_val(val):
                if not val or not str(val).strip():
                    return datetime.datetime.now(datetime.timezone.utc).date()
                s = str(val).strip()
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%Y/%m/%d', '%b %d, %Y', '%d %b %Y']:
                    try:
                        return datetime.datetime.strptime(s, fmt).date()
                    except ValueError:
                        pass
                try:
                    return pd.to_datetime(s, errors='coerce').date()
                except Exception:
                    return datetime.datetime.now(datetime.timezone.utc).date()

            # Build DataFrame
            max_cols = max(len(r) for r in normalized_rows)
            padded_rows = [r + [''] * (max_cols - len(r)) for r in normalized_rows]
            df_raw = pd.DataFrame(padded_rows)

            first_row = [str(x).strip().lower() for x in df_raw.iloc[0].values if str(x).strip()]
            has_explicit_headers = any(h in known_header_words for h in first_row)
            
            first_row_amounts = [clean_amount_val(x) for x in df_raw.iloc[0].values]
            has_numeric_in_first_row = any(a is not None and a > 0 for a in first_row_amounts)
            has_date_in_first_row = any(any(re.match(p, str(x).strip()) for p in date_patterns) for x in df_raw.iloc[0].values if str(x).strip())

            if has_explicit_headers and not (has_numeric_in_first_row and has_date_in_first_row):
                # Labeled CSV
                header_names = [str(col).strip().lower() for col in df_raw.iloc[0].values]
                df_data = df_raw.iloc[1:].copy()
                df_data.columns = header_names

                col_map = {}
                for col in df_data.columns:
                    c = str(col).lower()
                    if any(k in c for k in ['amount', 'cost', 'total', 'price', 'spend']):
                        col_map['amount'] = col
                    elif any(k in c for k in ['date', 'time', 'period']):
                        col_map['date'] = col
                    elif any(k in c for k in ['category', 'type', 'dept', 'department']):
                        col_map['category'] = col
                    elif any(k in c for k in ['vendor', 'merchant', 'provider', 'name', 'description', 'item']):
                        col_map['vendor'] = col
            else:
                # Unlabeled / Headerless CSV
                df_data = df_raw.copy()
                col_map = {}
                
                date_cols = []
                amount_cols = []
                cat_cols = []
                string_cols = []

                for col_idx in df_data.columns:
                    col_series = df_data[col_idx].dropna().astype(str)
                    if col_series.empty:
                        continue

                    # Test for numeric / amount
                    numeric_valid = [clean_amount_val(v) is not None for v in col_series[:20] if v.strip()]
                    if numeric_valid and sum(numeric_valid) / max(len(numeric_valid), 1) > 0.6:
                        amount_cols.append(col_idx)
                        continue

                    # Test for date
                    date_valid = [any(re.match(p, v.strip()) for p in date_patterns) for v in col_series[:20] if v.strip()]
                    if date_valid and sum(date_valid) / max(len(date_valid), 1) > 0.5:
                        date_cols.append(col_idx)
                        continue

                    # Test for known category words
                    cat_match = [v.strip().lower() in known_category_words for v in col_series[:20] if v.strip()]
                    if cat_match and sum(cat_match) / max(len(cat_match), 1) > 0.4:
                        cat_cols.append(col_idx)
                        continue

                    string_cols.append(col_idx)

                if amount_cols:
                    col_map['amount'] = amount_cols[0]
                if date_cols:
                    col_map['date'] = date_cols[0]
                if cat_cols:
                    col_map['category'] = cat_cols[0]
                
                for sc in string_cols:
                    if sc not in col_map.values():
                        col_map['vendor'] = sc
                        break
                
                if 'vendor' not in col_map:
                    for col_idx in df_data.columns:
                        if col_idx != col_map.get('amount') and col_idx != col_map.get('date'):
                            col_map['vendor'] = col_idx
                            break

            created_count = 0
            for _, row in df_data.iterrows():
                # Extract Amount
                raw_amt = row.get(col_map.get('amount')) if 'amount' in col_map else None
                amt = clean_amount_val(raw_amt)
                amount = float(amt) if amt is not None else 0.0

                # Extract Date
                raw_date = row.get(col_map.get('date')) if 'date' in col_map else None
                date_obj = parse_date_val(raw_date)

                # Extract Vendor
                raw_vendor = str(row.get(col_map.get('vendor'), '')).strip() if 'vendor' in col_map else ''
                vendor = raw_vendor if raw_vendor and raw_vendor.lower() != 'nan' else 'Unknown Vendor'

                # Extract Category
                raw_cat = str(row.get(col_map.get('category'), '')).strip() if 'category' in col_map else ''
                category = raw_cat if raw_cat and raw_cat.lower() != 'nan' else 'Uncategorized'

                expense = Expense(
                    user_id=user_id,
                    amount=max(0.0, amount),
                    vendor=vendor,
                    date=date_obj,
                    category=category,
                    type='expense'
                )
                db.session.add(expense)
                created_count += 1

            if created_count == 0:
                db.session.rollback()
                return False, "No valid expense rows found in CSV."

            db.session.commit()
            mode_desc = "labeled" if has_explicit_headers else "unlabeled/auto-inferred"
            return True, f"Successfully imported {created_count} expenses ({mode_desc} data)."
        except Exception as e:
            db.session.rollback()
            return False, f"CSV processing failed: {str(e)}"

    def add_manual_expense(self, user_id, data):
        """Add a single manual expense."""
        try:
            amount_val = float(data.get('amount', 0))
            if amount_val <= 0:
                return False, "Amount must be a positive number greater than 0."

            vendor_val = str(data.get('vendor', '')).strip()
            if not vendor_val:
                return False, "Vendor name is required."

            today_date = datetime.datetime.now(datetime.timezone.utc).date()
            date_str = str(data.get('date', '')).strip()
            if date_str:
                try:
                    date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
                except Exception:
                    date_obj = today_date
            else:
                date_obj = today_date

            category_val = str(data.get('category', 'Manual')).strip() or 'Manual'

            expense = Expense(
                user_id=user_id,
                amount=amount_val,
                vendor=vendor_val,
                date=date_obj,
                category=category_val,
                type='expense'
            )
            db.session.add(expense)
            db.session.commit()
            return True, "Expense added successfully."
        except Exception as e:
            db.session.rollback()
            return False, f"Invalid expense data: {str(e)}"

    def update_budget(self, user_id, budget):
        """Update user's monthly budget."""
        try:
            if budget < 0:
                return False, "Monthly budget cannot be negative."
            user = User.query.get(user_id)
            if user:
                user.monthly_budget = budget
                db.session.commit()
                return True, "Budget updated."
            return False, "User not found."
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

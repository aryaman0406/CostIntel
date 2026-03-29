class ShadowCostDetectorAgent:
    def __init__(self, data_manager):
        self.data_manager = data_manager

    def detect_shadow_it(self):
        data = self.data_manager.get_structured_data()
        expenses = data.get('employee_expenses', [])
        
        merchant_counts = {}
        merchant_spend = {}
        for exp in expenses:
            category = str(exp.get('category', '') or '').strip().lower()
            merchant = str(exp.get('merchant', '') or '').strip()
            if not merchant:
                continue

            # Accept real-world categories from uploads/manual entry
            # (e.g. Cloud/SaaS/Software/Infrastructure/Hosting)
            if not any(k in category for k in ("software", "saas", "cloud", "infrastructure", "hosting", "web hosting")):
                continue

            merchant_counts[merchant] = merchant_counts.get(merchant, 0) + 1
            merchant_spend[merchant] = merchant_spend.get(merchant, 0) + exp['amount']
            
        shadow_threats = []
        for merchant, count in merchant_counts.items():
            m_lower = merchant.lower()
            if count >= 3:
                total = merchant_spend[merchant]
                shadow_threats.append({
                    "merchant": merchant,
                    "occurrences": count,
                    "total_monthly_spend": total,
                    "insight": f"{count} employees are individually expensing {merchant}. Consolidating to an Enterprise/Team plan is highly recommended.",
                    "risk_level": "High" if total > 5000 else "Medium"
                })
            elif any(x in m_lower for x in ("aws", "google cloud", "gcp", "azure", "digitalocean")):
                shadow_threats.append({
                    "merchant": merchant,
                    "occurrences": count,
                    "total_monthly_spend": merchant_spend[merchant],
                    "insight": f"Ungoverned infrastructure spend detected via employee card. High compliance and security risk.",
                    "risk_level": "Critical"
                })
                
        shadow_threats.sort(key=lambda x: x['total_monthly_spend'], reverse=True)
        return shadow_threats

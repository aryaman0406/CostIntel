class SpendAnalysisAgent:
    def __init__(self, data_manager):
        self.data_manager = data_manager

    def analyze(self):
        data = self.data_manager.get_structured_data()
        inefficiencies = []
        duplicates = []
        unused = []
        total_flagged_value = 0.0

        # Analyze cloud costs
        for item in data.get('cloud_costs', []):
            try:
                util_val = int(item['utilization'].strip('%'))
                trend_val = int(item['trend'].strip('+').strip('%'))
            except (ValueError, KeyError):
                continue

            if util_val < 30:
                unused.append(f"{item['service']} is underutilized ({item['utilization']}). Cost: ₹{item['cost']:,.0f}")
                total_flagged_value += float(item.get('cost', 0) or 0)
            if trend_val > 10:
                inefficiencies.append(f"{item['service']} cost increased rapidly by {item['trend']}. Cost: ₹{item['cost']:,.0f}")
                total_flagged_value += float(item.get('cost', 0) or 0)

        # Analyze SaaS
        seen_saas = {}
        for item in data.get('saas_subscriptions', []):
            key = item['name'].split(" (Duplicate)")[0]
            if key in seen_saas:
                duplicates.append(f"Duplicate subscription detected: {item['name']}. Potential saving: ₹{item['cost']:,.0f}")
                total_flagged_value += float(item.get('cost', 0) or 0)
            else:
                seen_saas[key] = item['cost']

            active_pct = item['active_users'] / item['users'] if item['users'] > 0 else 0
            if active_pct < 0.5:
                potential = float(item.get('cost', 0) or 0) * (1 - active_pct)
                unused.append(f"{item['name']} has low activity ({int(active_pct*100)}%). Potential saving: ₹{potential:,.0f}")
                total_flagged_value += potential

        return {
            "inefficiencies": inefficiencies,
            "duplicates": duplicates,
            "unused_subscriptions": unused,
            "total_flagged_value": int(total_flagged_value)
        }

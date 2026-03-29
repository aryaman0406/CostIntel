class FutureCostPredictorAgent:
    def __init__(self, data_manager):
        self.data_manager = data_manager

    def predict_explosion(self):
        data = self.data_manager.get_structured_data()
        cloud_data = data.get('cloud_costs', [])

        explosions = []
        for resource in cloud_data:
            trend_str = resource.get('trend', '+0%')
            try:
                trend_val = int(trend_str.replace('+', '').replace('%', ''))
            except ValueError:
                continue

            # Predict only if trend is growing rapidly (> 25% MoM)
            if trend_val > 25:
                current_cost = resource['cost']
                rate = trend_val / 100.0
                # Using compound growth for next 6 months
                future_cost_6m = int(current_cost * ((1 + rate) ** 6))

                explosions.append({
                    "resource": resource['service'],
                    "current_cost": current_cost,
                    "trend_month_over_month": f"+{trend_val}%",
                    "projected_cost_6m": future_cost_6m,
                    "warning": f"{resource['service']} cost is compounding at {trend_val}% MoM. If not optimized, run rate will explode to ~₹{future_cost_6m:,} in 6 months.",
                    "severity": "Critical" if future_cost_6m > (current_cost * 5) else "High"
                })

        explosions.sort(key=lambda x: x['projected_cost_6m'], reverse=True)
        return explosions

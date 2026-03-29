class PredictiveCFOAgent:
    def __init__(self, data_manager):
        self.data_manager = data_manager

    def simulate_scenario(self, strategy):
        # strategies: "aggressive", "conservative", "balanced"
        data = self.data_manager.get_structured_data()
        current_total = data['total_cloud'] + data['total_saas'] + data['total_ops']
        
        reduction_factor = {
            "aggressive": 0.25,
            "balanced": 0.15,
            "conservative": 0.05
        }
        
        factor = reduction_factor.get(strategy.lower(), 0.1)
        projected_savings = current_total * factor
        projected_total = current_total - projected_savings
        
        return {
            "strategy": strategy,
            "current_run_rate": current_total,
            "projected_monthly_savings": int(projected_savings),
            "projected_new_total": int(projected_total),
            "roi_timeline": "3 months",
            "risk_level": "High" if strategy=="aggressive" else "Low" if strategy=="conservative" else "Medium"
        }

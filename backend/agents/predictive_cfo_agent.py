import statistics


class PredictiveCFOAgent:
    def __init__(self, data_manager):
        self.data_manager = data_manager

    def _get_strategy_profile(self, strategy):
        profiles = {
            "conservative": {
                "cloud_reduction": 0.08,
                "saas_reduction": 0.05,
                "ops_reduction": 0.03,
                "implementation_cost_pct": 0.02,
                "risk": "Low",
            },
            "balanced": {
                "cloud_reduction": 0.18,
                "saas_reduction": 0.14,
                "ops_reduction": 0.10,
                "implementation_cost_pct": 0.035,
                "risk": "Medium",
            },
            "aggressive": {
                "cloud_reduction": 0.30,
                "saas_reduction": 0.24,
                "ops_reduction": 0.18,
                "implementation_cost_pct": 0.05,
                "risk": "High",
            },
        }
        return profiles.get(strategy.lower(), profiles["balanced"])

    def _confidence_from_volatility(self, historical_spend):
        totals = []
        for item in historical_spend:
            try:
                totals.append(float(item.get("total", 0) or 0))
            except (TypeError, ValueError):
                continue

        if len(totals) < 2:
            return 55, "Medium"

        mean_val = statistics.mean(totals)
        if mean_val <= 0:
            return 50, "Medium"

        # Coefficient of variation as a proxy for spend stability.
        std_dev = statistics.pstdev(totals)
        cov = std_dev / mean_val

        if cov <= 0.10:
            return 85, "High"
        if cov <= 0.20:
            return 72, "Medium"
        if cov <= 0.35:
            return 60, "Medium"
        return 45, "Low"

    def simulate_scenario(self, strategy):
        # strategies: "aggressive", "conservative", "balanced"
        data = self.data_manager.get_structured_data()
        profile = self._get_strategy_profile(strategy)

        cloud = float(data.get("total_cloud", 0) or 0)
        saas = float(data.get("total_saas", 0) or 0)
        ops = float(data.get("total_ops", 0) or 0)

        current_total = cloud + saas + ops

        confidence_score, confidence_band = self._confidence_from_volatility(
            data.get("historical_spend", [])
        )

        # Lower confidence slightly dampens projected savings.
        confidence_multiplier = 0.80 + (confidence_score / 100.0) * 0.20

        category_breakdown = []
        for name, current, reduction in [
            ("Cloud", cloud, profile["cloud_reduction"]),
            ("SaaS", saas, profile["saas_reduction"]),
            ("Operations", ops, profile["ops_reduction"]),
        ]:
            raw_savings = current * reduction
            adjusted_savings = raw_savings * confidence_multiplier
            category_breakdown.append(
                {
                    "category": name,
                    "current": round(current, 2),
                    "reduction_pct": int(round(reduction * 100)),
                    "projected_savings": round(adjusted_savings, 2),
                    "projected_new_total": round(max(current - adjusted_savings, 0), 2),
                }
            )

        projected_savings = sum(x["projected_savings"] for x in category_breakdown)
        projected_total = max(current_total - projected_savings, 0)

        implementation_cost = current_total * profile["implementation_cost_pct"]
        annual_gross_savings = projected_savings * 12
        annual_net_impact = annual_gross_savings - implementation_cost

        payback_months = 0.0
        if projected_savings > 0:
            payback_months = implementation_cost / projected_savings

        roi_timeline = "Immediate"
        if payback_months > 0:
            roi_timeline = f"{max(1, int(round(payback_months)))} month(s)"

        return {
            "strategy": strategy,
            "current_run_rate": current_total,
            "projected_monthly_savings": int(projected_savings),
            "projected_new_total": int(projected_total),
            "roi_timeline": roi_timeline,
            "risk_level": profile["risk"],
            "confidence_score": confidence_score,
            "confidence_band": confidence_band,
            "one_time_implementation_cost": int(implementation_cost),
            "annual_net_impact": int(annual_net_impact),
            "category_breakdown": category_breakdown,
            "assumptions": [
                "Savings are based on current monthly run-rate by cost category.",
                "Confidence is estimated from historical spend stability.",
                "Implementation cost is a one-time effort cost.",
            ],
        }

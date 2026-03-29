"""
Continuous Cost Monitoring Agent
Monitors enterprise operations data and identifies cost leakage/inefficiency patterns
Initiates corrective actions with quantifiable financial impact
"""

import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class CostMonitoringAgent:
    """
    Continuously monitors enterprise operations data and identifies cost issues
    with quantifiable financial impact.
    """
    
    def __init__(self, data_agent):
        self.data_agent = data_agent
        self.monitoring_results = []
        self.financial_impact_tracker = {}
    
    def run_monitoring_cycle(self) -> Dict[str, Any]:
        """
        Execute a complete monitoring cycle. Returns findings with financial impact.
        This is meant to run continuously (e.g., daily via scheduler).
        """
        cycle_id = datetime.utcnow().isoformat()
        findings = {
            "cycle_id": cycle_id,
            "timestamp": datetime.utcnow().isoformat(),
            "issues_detected": [],
            "total_potential_savings": 0,
            "recommendations": []
        }
        
        # Get current data
        try:
            data = self.data_agent.get_structured_data()
        except Exception as e:
            logger.error(f"Failed to fetch data for monitoring: {str(e)}")
            return findings
        
        # Run detection modules
        findings["issues_detected"].extend(self._detect_saas_waste(data))
        findings["issues_detected"].extend(self._detect_shadow_it_duplication(data))
        findings["issues_detected"].extend(self._detect_cloud_inefficiencies(data))
        findings["issues_detected"].extend(self._detect_cost_anomalies(data))
        findings["issues_detected"].extend(self._detect_underutilized_resources(data))
        
        # Calculate total potential savings
        findings["total_potential_savings"] = sum(
            issue.get("potential_savings", 0) for issue in findings["issues_detected"]
        )
        
        # Generate corrective actions  
        findings["recommendations"] = self._generate_corrective_actions(findings["issues_detected"])
        
        # Store results
        self.monitoring_results.append(findings)
        
        return findings
    
    def _detect_saas_waste(self, data: Dict) -> List[Dict]:
        """Detect underutilized SaaS subscriptions and Shadow IT duplication"""
        issues = []
        
        subs = data.get('saas_subscriptions', [])
        if not subs:
            return issues
        
        # Issue 1: Underutilized subscriptions
        for sub in subs:
            active = sub.get('active_users', 0)
            total = sub.get('users', 1)
            cost = sub.get('cost', 0)
            
            utilization = (active / total * 100) if total > 0 else 0
            
            # If less than 50% utilization, it's a concern
            if utilization < 50:
                wasted_cost = cost * (1 - active / total)
                issues.append({
                    "type": "SAAS_UNDERUTILIZATION",
                    "service": sub.get('name', 'Unknown'),
                    "severity": "HIGH" if utilization < 30 else "MEDIUM",
                    "current_cost": cost,
                    "potential_savings": wasted_cost,
                    "description": f"{sub.get('name')}: Paying for {total} users, only {active} active ({utilization:.0f}% utilization)",
                    "action": f"Downgrade to {active} licenses or negotiate volume discount",
                    "impact_timeframe": "Immediate (next billing cycle)"
                })
        
        # Issue 2: Duplicate subscriptions (Shadow IT)
        service_counts = {}
        for sub in subs:
            service_name = sub.get('name', '').split()[0]  # First word
            if service_name not in service_counts:
                service_counts[service_name] = []
            service_counts[service_name].append(sub)
        
        for service_name, service_list in service_counts.items():
            if len(service_list) > 1:
                duplicate_cost = sum(s.get('cost', 0) for s in service_list[1:])
                issues.append({
                    "type": "SHADOW_IT_DUPLICATION",
                    "service": service_name,
                    "severity": "HIGH",
                    "current_cost": duplicate_cost,
                    "potential_savings": duplicate_cost * 0.8,  # Conservative estimate
                    "description": f"Found {len(service_list)} duplicate {service_name} subscriptions (Shadow IT)",
                    "action": f"Consolidate {len(service_list)} subscriptions into single enterprise plan",
                    "impact_timeframe": "1-2 weeks"
                })
        
        return issues
    
    def _detect_shadow_it_duplication(self, data: Dict) -> List[Dict]:
        """Detect Shadow IT patterns in employee expenses"""
        issues = []
        
        expenses = data.get('employee_expenses', [])
        if not expenses:
            return issues
        
        # Count merchant frequencies
        merchant_counts = {}
        for exp in expenses:
            merchant = exp.get('merchant', 'Unknown')
            if merchant not in merchant_counts:
                merchant_counts[merchant] = {"count": 0, "total_amount": 0, "employees": set()}
            merchant_counts[merchant]["count"] += 1
            merchant_counts[merchant]["total_amount"] += exp.get('amount', 0)
            merchant_counts[merchant]["employees"].add(exp.get('employee', 'Unknown'))
        
        # Flag duplicates with multiple employees
        for merchant, info in merchant_counts.items():
            if info["count"] > 1 and len(info["employees"]) > 1:
                annual_waste = info["total_amount"] * 12
                issues.append({
                    "type": "SHADOW_IT_EMPLOYEE_EXPENSES",
                    "service": merchant,
                    "severity": "HIGH",
                    "current_cost": info["total_amount"],
                    "potential_savings": info["total_amount"] * 0.7,  # Assume 70% savings from consolidation
                    "description": f"{len(info['employees'])} employees separately expensing {merchant} (₹{info['total_amount']:,.0f}/month)",
                    "action": f"Consolidate to 1 enterprise license for ₹{info['total_amount'] * 0.3:,.0f}/month",
                    "impact_timeframe": "1 month"
                })
        
        return issues
    
    def _detect_cloud_inefficiencies(self, data: Dict) -> List[Dict]:
        """Detect cloud resource inefficiencies (low utilization, waste)"""
        issues = []
        
        cloud_costs = data.get('cloud_costs', [])
        if not cloud_costs:
            return issues
        
        for service in cloud_costs:
            utilization = service.get('utilization', '0%')
            trend = service.get('trend', '0%')
            cost = service.get('cost', 0)
            
            # Parse utilization percentage
            try:
                util_pct = float(utilization.rstrip('%'))
            except:
                util_pct = 50
            
            # Flag low utilization or negative trend
            if util_pct < 30:
                issues.append({
                    "type": "CLOUD_LOW_UTILIZATION",
                    "service": service.get('service', 'Unknown'),
                    "severity": "MEDIUM",
                    "current_cost": cost,
                    "potential_savings": cost * 0.4,  # Estimate 40% unused
                    "description": f"{service.get('service')}: Only {util_pct:.0f}% utilized (₹{cost:,.0f}/month)",
                    "action": "Right-size instance or terminate unused resources",
                    "impact_timeframe": "Immediate"
                })
            
            # Flag upward trends
            if trend and '+' in trend:
                try:
                    trend_pct = float(trend.replace('+', '').rstrip('%'))
                    if trend_pct > 20:
                        projected_annual = cost * 12 * ((1 + trend_pct / 100) ** 6)
                        issues.append({
                            "type": "CLOUD_COST_EXPLOSION",
                            "service": service.get('service', 'Unknown'),
                            "severity": "MEDIUM",
                            "current_cost": cost,
                            "potential_savings": cost * (trend_pct / 100) * 6,  # Savings from halting trend
                            "description": f"{service.get('service')} growing at {trend_pct:.0f}%/month → ₹{projected_annual:,.0f} projected annually",
                            "action": "Investigate growth drivers, implement cost controls, consider reserved instances",
                            "impact_timeframe": "1-2 weeks"
                        })
                except:
                    pass
        
        return issues
    
    def _detect_cost_anomalies(self, data: Dict) -> List[Dict]:
        """Detect unusual spending patterns"""
        issues = []
        
        historical = data.get('historical_spend', [])
        if len(historical) < 3:
            return issues
        
        # Calculate average and standard deviation
        values = [h.get('total', 0) for h in historical]
        avg = sum(values) / len(values)
        variance = sum((x - avg) ** 2 for x in values) / len(values)
        std_dev = variance ** 0.5
        
        # Check for anomalies (>2 std deviations)
        if len(values) > 1:
            last_value = values[-1]
            deviation = abs(last_value - avg) / std_dev if std_dev > 0 else 0
            
            if deviation > 2:
                month = historical[-1].get('month', 'This month')
                prev_month = historical[-2].get('month', 'Last month') if len(historical) > 1 else ''
                prev_value = values[-2] if len(values) > 1 else avg
                change_pct = ((last_value - prev_value) / prev_value * 100) if prev_value > 0 else 0
                
                issues.append({
                    "type": "COST_ANOMALY",
                    "service": "Overall Spending",
                    "severity": "MEDIUM",
                    "current_cost": last_value,
                    "potential_savings": abs(last_value - avg) * 0.5,  # Conservative
                    "description": f"Spending spike in {month}: ₹{last_value:,.0f} (vs ₹{avg:,.0f} avg, +{change_pct:.1f}%)",
                    "action": "Investigate root cause - possible runaway compute or data transfer charges",
                    "impact_timeframe": "Urgent - investigate immediately"
                })
        
        return issues
    
    def _detect_underutilized_resources(self, data: Dict) -> List[Dict]:
        """Detect operational expenses that could be optimized"""
        issues = []
        
        ops = data.get('operational_expenses', [])
        if not ops:
            return issues
        
        # Flag marketing spend (commonly high-waste)
        for op in ops:
            category = op.get('category', '').lower()
            cost = op.get('cost', 0)
            
            if 'marketing' in category:
                issues.append({
                    "type": "MARKETING_OPTIMIZATION",
                    "service": op.get('provider', 'Marketing'),
                    "severity": "LOW",
                    "current_cost": cost,
                    "potential_savings": cost * 0.15,  # 15% optimization potential
                    "description": f"Marketing spend: ₹{cost:,.0f}/month - Review for optimization opportunities",
                    "action": "Audit ad campaigns, pause underperforming channels, negotiate rates",
                    "impact_timeframe": "2-4 weeks"
                })
        
        return issues
    
    def _generate_corrective_actions(self, issues: List[Dict]) -> List[Dict]:
        """Generate rank-ordered corrective actions with financial impact"""
        actions = []
        
        for issue in issues:
            action = {
                "id": f"ACTION_{len(actions) + 1}",
                "issue_type": issue.get("type"),
                "service": issue.get("service"),
                "severity": issue.get("severity"),
                "monthly_savings": issue.get("potential_savings", 0),
                "annual_savings": issue.get("potential_savings", 0) * 12,
                "description": issue.get("description"),
                "recommended_action": issue.get("action"),
                "implementation_timeframe": issue.get("impact_timeframe"),
                "status": "PENDING",
                "roi": "Immediate",
                "approval_required": True
            }
            actions.append(action)
        
        # Sort by annual savings (highest first)
        actions.sort(key=lambda x: x["annual_savings"], reverse=True)
        
        return actions
    
    def get_executive_summary(self) -> Dict[str, Any]:
        """Generate executive summary from latest monitoring cycle"""
        if not self.monitoring_results:
            return {}
        
        latest = self.monitoring_results[-1]
        
        return {
            "total_issues_detected": len(latest["issues_detected"]),
            "total_monthly_potential_savings": latest["total_potential_savings"],
            "total_annual_potential_savings": latest["total_potential_savings"] * 12,
            "issues_by_severity": {
                "HIGH": len([i for i in latest["issues_detected"] if i.get("severity") == "HIGH"]),
                "MEDIUM": len([i for i in latest["issues_detected"] if i.get("severity") == "MEDIUM"]),
                "LOW": len([i for i in latest["issues_detected"] if i.get("severity") == "LOW"]),
            },
            "top_3_savings_opportunities": latest["recommendations"][:3],
            "estimated_roe_cost_reduction": f"{(latest['total_potential_savings'] / 100000 * 100):.1f}%" if latest["total_potential_savings"] > 0 else "0%"
        }

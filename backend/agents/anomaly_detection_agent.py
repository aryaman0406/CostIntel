import statistics

class AnomalyDetectionAgent:
    def __init__(self, data_manager):
        self.data_manager = data_manager

    def detect_anomalies(self):
        data = self.data_manager.get_structured_data()
        alerts = []
        
        historical = data.get('historical_spend', [])
        if not historical:
            return alerts
            
        historical_total = [int(x['total']) for x in historical]
        
        if len(historical_total) < 2:
            return alerts
            
        mean = statistics.mean(historical_total)
        std_dev = statistics.stdev(historical_total) if len(historical_total) > 1 else 0
        
        latest_month = historical_total[-1]
        
        # basic z-score
        z_score = (latest_month - mean) / (std_dev if std_dev > 0 else 1)
        if z_score > 2:
            alerts.append({
                "severity": "High",
                "message": f"Unusual spike in overall expenses detected. +{int((latest_month-mean)/mean*100)}% over average.",
                "root_cause": "GCP BigQuery daily cost anomaly"
            })
            
        for saas in data.get('saas_subscriptions', []):
            if "Duplicate" in saas['name']:
                alerts.append({
                    "severity": "Critical",
                    "message": f"Identical recurring charge for {saas['name']}",
                    "root_cause": "Accounting error or shadow IT"
                })
        
        for cloud in data.get('cloud_costs', []):
            try:
                trend_val = int(cloud['trend'].strip('+').strip('%'))
            except (ValueError, KeyError):
                continue
            if trend_val > 15:
                alerts.append({
                    "severity": "Medium",
                    "message": f"{cloud['service']} spend is accelerating rapidly ({cloud['trend']}).",
                    "root_cause": "Unoptimized queries or scaling events"
                })
        
        return alerts

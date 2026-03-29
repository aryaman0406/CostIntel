"""
Monitoring Scheduler - Runs continuous cost monitoring cycles
Uses APScheduler to execute monitoring tasks on a schedule
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

logger = logging.getLogger(__name__)

class MonitoringScheduler:
    """
    Background scheduler for continuous cost monitoring.
    Runs monitoring cycles at configured intervals.
    """
    
    _instance = None
    _scheduler = None
    _monitoring_agent = None
    _results_cache = []
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MonitoringScheduler, cls).__new__(cls)
        return cls._instance
    
    def initialize(self, monitoring_agent, interval_hours=24):
        """
        Initialize the scheduler with a monitoring agent.
        
        Args:
            monitoring_agent: The CostMonitoringAgent instance
            interval_hours: How often to run monitoring (default: daily)
        """
        self._monitoring_agent = monitoring_agent
        
        if self._scheduler is None:
            self._scheduler = BackgroundScheduler()
            
            # Schedule the monitoring cycle
            self._scheduler.add_job(
                func=self._run_monitoring_cycle,
                trigger="interval",
                hours=interval_hours,
                id="cost_monitoring_cycle",
                name="Continuous Cost Monitoring",
                replace_existing=True,
                coalesce=True,
                misfire_grace_time=600
            )
            
            logger.info(f"Monitoring scheduler initialized (interval: {interval_hours} hour(s))")
        
        return self._scheduler
    
    def start(self):
        """Start the background scheduler"""
        if self._scheduler and not self._scheduler.running:
            self._scheduler.start()
            logger.info("Cost monitoring scheduler started")
            
            # Run initial monitoring cycle immediately
            self._run_monitoring_cycle()
    
    def stop(self):
        """Stop the background scheduler"""
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown()
            logger.info("Cost monitoring scheduler stopped")
    
    def _run_monitoring_cycle(self):
        """Execute a monitoring cycle"""
        try:
            logger.info("🔍 Starting cost monitoring cycle...")
            results = self._monitoring_agent.run_monitoring_cycle()
            
            # Cache results
            self._results_cache.append(results)
            
            # Keep only last 30 cycles
            if len(self._results_cache) > 30:
                self._results_cache.pop(0)
            
            # Log summary
            summary = self._monitoring_agent.get_executive_summary()
            if summary:
                logger.info(f"""
                ✅ Monitoring cycle completed:
                   - Issues detected: {summary.get('total_issues_detected', 0)}
                   - Total potential monthly savings: ₹{summary.get('total_monthly_potential_savings', 0):,.0f}
                   - Annual impact: ₹{summary.get('total_annual_potential_savings', 0):,.0f}
                   - HIGH severity: {summary.get('issues_by_severity', {}).get('HIGH', 0)}
                """)
        except Exception as e:
            logger.error(f"❌ Monitoring cycle failed: {str(e)}", exc_info=True)
    
    def get_latest_results(self):
        """Get the latest monitoring results"""
        return self._results_cache[-1] if self._results_cache else None
    
    def get_all_results(self):
        """Get all cached monitoring results"""
        return self._results_cache

import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Upload } from 'lucide-react';

const EmptyState = ({ title, desc, onActionClick }) => (
    <div className="card empty-state">
      <Upload size={48} className="empty-state-icon" />
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{desc}</p>
      <button className="btn btn-primary" onClick={onActionClick}>Upload / Enter Data</button>
    </div>
  );

const MonitoringTab = ({ hasData, triggerMon, monRunning, monError, monitoringStatus, monitoringHistory, setActiveTab }) => {
  const summary = monitoringStatus?.summary ?? {};
  const opportunities = Array.isArray(summary.top_3_savings_opportunities)
    ? summary.top_3_savings_opportunities
    : [];
  const cycles = Array.isArray(monitoringHistory?.cycles)
    ? monitoringHistory.cycles
    : [];

  const asNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const formatTimestamp = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString();
  };

  if (!hasData) {
    return <EmptyState 
      title="No Data to Monitor" 
      desc="The continuous monitoring system needs your enterprise data to detect cost leakage and inefficiencies. Import your data first."
      onActionClick={() => setActiveTab('data-entry')} 
    />;
  }

  return (
    <div className="fade-in">
      <div className="monitoring-header">
        <div className="monitoring-title-group">
          <Activity size={24} className="text-primary" />
          <h2 className="section-heading">Continuous Cost Monitoring</h2>
          <span className="pulse-dot active"></span>
        </div>
        <button className="btn btn-primary" onClick={triggerMon} disabled={monRunning}>
          <RefreshCw size={14} className={monRunning ? 'animate-spin' : ''} />
          {monRunning ? 'Scanning...' : 'Run Monitoring Now'}
        </button>
      </div>

      {monError && <div className="alert-banner danger">{monError}</div>}

      <div className="monitoring-grid">
        <div className="card text-center"><div className="card-title">Issues</div><div className="metric text-danger">{asNumber(summary.total_issues_detected)}</div></div>
        <div className="card text-center"><div className="card-title">Monthly Savings</div><div className="metric text-success">₹{asNumber(summary.total_monthly_potential_savings).toLocaleString()}</div></div>
        <div className="card text-center"><div className="card-title">Annual Impact</div><div className="metric text-primary">₹{asNumber(summary.total_annual_potential_savings).toLocaleString()}</div></div>
      </div>

      {opportunities.length > 0 && (
        <div className="card table-card">
          <h3 className="card-title">Top Savings Opportunities</h3>
          <table className="table">
            <thead><tr><th>Service</th><th>Issue</th><th>Monthly</th><th>Annual</th></tr></thead>
            <tbody>{opportunities.map((o, i) => (
              <tr key={i}>
                <td className="font-semibold">{o.service}</td>
                <td>{o.description}</td>
                <td className="font-bold text-success">₹{asNumber(o.monthly_savings).toLocaleString()}</td>
                <td className="font-bold text-success">₹{asNumber(o.annual_savings).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {cycles.length > 0 && (
        <div className="card table-card">
          <h3 className="card-title">Monitoring History</h3>
          <table className="table">
            <thead><tr><th>#</th><th>Time</th><th>Issues</th><th>Savings</th></tr></thead>
            <tbody>{cycles.map((c, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{formatTimestamp(c.timestamp)}</td>
                <td><span className={`status-badge ${asNumber(c.issues_detected) > 3 ? 'status-alert' : 'status-warning'}`}>{asNumber(c.issues_detected)}</span></td>
                <td className="font-semibold text-success">₹{asNumber(c.total_potential_savings).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MonitoringTab;
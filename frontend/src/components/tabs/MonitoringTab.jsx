import React, { useState } from 'react';
import { Activity, RefreshCw, Upload, TrendingDown, Clock, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

const EmptyState = ({ title, desc, onActionClick }) => (
  <div className="card empty-state">
    <Upload size={48} className="empty-state-icon" />
    <h3 className="empty-state-title">{title}</h3>
    <p className="empty-state-description">{desc}</p>
    <button className="btn btn-primary" onClick={onActionClick}>Upload / Enter Data</button>
  </div>
);

const SeverityBadge = ({ severity }) => {
  const colors = {
    HIGH: { bg: 'rgba(191,49,82,0.12)', color: 'var(--danger)' },
    MEDIUM: { bg: 'rgba(184,121,15,0.12)', color: 'var(--warning)' },
    LOW: { bg: 'rgba(24,140,97,0.12)', color: 'var(--success)' },
  };
  const style = colors[severity] || colors.LOW;
  return (
    <span style={{ background: style.bg, color: style.color, borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
      {severity}
    </span>
  );
};

const MonitoringTab = ({
  hasData, triggerMon, monRunning, monError,
  monitoringStatus, monitoringHistory, monitoringRuns = [],
  setActiveTab, userRole = 'Viewer'
}) => {
  const [runTab, setRunTab] = useState('issues');
  const canTrigger = userRole === 'Analyst' || userRole === 'Admin';
  const summary = monitoringStatus?.summary ?? monitoringStatus ?? {};
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

  const fmtINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatTimestamp = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString();
  };

  // Last run from persisted DB runs
  const lastRun = monitoringRuns.length > 0 ? monitoringRuns[0] : null;
  const prevRun = monitoringRuns.length > 1 ? monitoringRuns[1] : null;

  // Before/after comparison data
  const compareData = lastRun && prevRun ? [
    { name: 'Issues Found', previous: prevRun.issues_found, current: lastRun.issues_found },
    { name: 'Savings (₹K)', previous: Math.round(prevRun.total_estimated_savings / 1000), current: Math.round(lastRun.total_estimated_savings / 1000) },
    { name: 'Records', previous: prevRun.records_scanned, current: lastRun.records_scanned },
  ] : [];

  if (!hasData) {
    return <EmptyState
      title="No Data to Monitor"
      desc="The continuous monitoring system needs your enterprise data to detect cost leakage and inefficiencies. Import your data first."
      onActionClick={() => setActiveTab('data-entry')}
    />;
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="monitoring-header">
        <div className="monitoring-title-group">
          <Activity size={24} className="text-primary" />
          <h2 className="section-heading">Continuous Cost Monitoring</h2>
          <span className="pulse-dot active" />
        </div>
        {canTrigger ? (
          <button
            type="button"
            id="run-monitoring-btn"
            className="btn btn-primary"
            onClick={(e) => { e.preventDefault(); triggerMon(); }}
            disabled={monRunning}
          >
            <RefreshCw size={14} className={monRunning ? 'animate-spin' : ''} />
            {monRunning ? 'Scanning...' : 'Run Monitoring Now'}
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(139,92,246,0.10)', color: '#a78bfa',
            borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600,
          }}>
            <Activity size={13} />
            View-only — Analyst+ can trigger scans
          </div>
        )}
      </div>

      {monError && <div className="alert-banner danger">{monError}</div>}

      {/* Last Run Stats Banner */}
      {lastRun && (
        <div className="last-run-banner">
          <div className="last-run-stat">
            <Layers size={16} />
            <span>Scanned <strong className="font-mono tabular-nums">{Number(lastRun.records_scanned || 0).toLocaleString('en-IN')}</strong> records</span>
          </div>
          <div className="last-run-stat">
            <Activity size={16} />
            <span>Flagged <strong className="font-mono tabular-nums">{Number(lastRun.issues_found || 0).toLocaleString('en-IN')}</strong> issues</span>
          </div>
          <div className="last-run-stat">
            <TrendingDown size={16} />
            <span>Est. savings <strong className="font-mono tabular-nums">{fmtINR(lastRun.total_estimated_savings)}</strong></span>
          </div>
          <div className="last-run-stat" style={{ marginLeft: 'auto' }}>
            <Clock size={14} />
            <span className="font-mono tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Last run: {formatTimestamp(lastRun.timestamp)}
            </span>
          </div>
        </div>
      )}

      {/* Summary metric cards */}
      <div className="monitoring-grid">
        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--danger)' }}>
          <div className="kpi-label">Issues Detected</div>
          <div className="kpi-value font-mono tabular-nums" style={{ color: 'var(--danger)' }}>
            {Number(asNumber(summary.total_issues_detected)).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--success)' }}>
          <div className="kpi-label">Monthly Savings</div>
          <div className="kpi-value font-mono tabular-nums" style={{ color: 'var(--success)' }}>
            {fmtINR(summary.total_monthly_potential_savings)}
          </div>
        </div>
        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--primary)' }}>
          <div className="kpi-label">Annual Impact</div>
          <div className="kpi-value font-mono tabular-nums" style={{ color: 'var(--primary)' }}>
            {fmtINR(summary.total_annual_potential_savings)}
          </div>
        </div>
      </div>

      {/* Tab nav for sections */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.2rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'issues', label: '🔍 Issues' },
          { key: 'history', label: '📜 History' },
          { key: 'compare', label: '📊 Before vs After' },
        ].map(tab => (
          <button
            key={tab.key}
            id={`mon-tab-${tab.key}`}
            className={`btn ${runTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '5px 14px', fontSize: '0.82rem' }}
            onClick={() => setRunTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Issues tab */}
      {runTab === 'issues' && opportunities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {opportunities.map((o, i) => (
            <div key={i} className="issue-card">
              <div className="issue-card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="font-semibold">{o.service || o.id}</span>
                    <SeverityBadge severity={o.severity || 'MEDIUM'} />
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>{o.description}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="font-mono tabular-nums" style={{ color: 'var(--success)', fontWeight: 700 }}>
                    {fmtINR(o.monthly_savings)}/mo
                  </div>
                  <div className="font-mono tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {fmtINR(o.annual_savings)} annually
                  </div>
                </div>
              </div>
              {o.recommended_action && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.82rem', userSelect: 'none' }}>
                    💡 Recommended Action
                  </summary>
                  <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    {o.recommended_action} — <em>{o.implementation_timeframe}</em>
                  </p>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {runTab === 'issues' && opportunities.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
          Run a monitoring cycle to detect issues.
        </div>
      )}

      {/* History tab */}
      {runTab === 'history' && (
        cycles.length > 0 ? (
          <div className="card table-card">
            <h3 className="card-title">Monitoring History</h3>
            <table className="table">
              <thead>
                <tr><th>#</th><th>Time</th><th>Issues</th><th>Savings</th></tr>
              </thead>
              <tbody>
                {cycles.map((c, i) => (
                  <tr key={i}>
                    <td className="font-mono tabular-nums">{i + 1}</td>
                    <td className="font-mono tabular-nums">{formatTimestamp(c.timestamp)}</td>
                    <td>
                      <span className={`status-badge font-mono tabular-nums ${asNumber(c.issues_detected) > 3 ? 'status-alert' : 'status-warning'}`}>
                        {asNumber(c.issues_detected)}
                      </span>
                    </td>
                    <td className="font-semibold text-success font-mono tabular-nums">{fmtINR(c.total_potential_savings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
            No history yet — run your first monitoring cycle.
          </div>
        )
      )}

      {/* Before/After Comparison tab */}
      {runTab === 'compare' && (
        compareData.length > 0 ? (
          <div className="card card-3d">
            <h3 className="card-title">Before vs After — Last 2 Runs</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="previous" name="Previous Run" fill="var(--text-muted)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="current" name="Latest Run" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <div className="card" style={{ flex: 1, minWidth: 160 }}>
                <div className="card-title">Previous Run</div>
                <div className="metric" style={{ fontSize: '1rem' }}>{formatTimestamp(prevRun?.timestamp)}</div>
              </div>
              <div className="card" style={{ flex: 1, minWidth: 160, borderLeft: '4px solid var(--primary)' }}>
                <div className="card-title">Latest Run</div>
                <div className="metric" style={{ fontSize: '1rem' }}>{formatTimestamp(lastRun?.timestamp)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
            Run at least 2 monitoring cycles to see a before/after comparison.
          </div>
        )
      )}
    </div>
  );
};

export default MonitoringTab;
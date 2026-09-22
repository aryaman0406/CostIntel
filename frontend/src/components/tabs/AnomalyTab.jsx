import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, TrendingUp, Shield } from 'lucide-react';

const severityConfig = {
  HIGH: { color: 'var(--danger)', bg: 'rgba(191,49,82,0.10)', label: 'HIGH', icon: '🔴' },
  MEDIUM: { color: 'var(--warning)', bg: 'rgba(184,121,15,0.10)', label: 'MEDIUM', icon: '🟡' },
  LOW: { color: 'var(--success)', bg: 'rgba(24,140,97,0.10)', label: 'LOW', icon: '🟢' },
};

const getSeverity = (score) => {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
};

const ScoreBadge = ({ score }) => {
  const sev = getSeverity(score);
  const cfg = severityConfig[sev];
  return (
    <div
      className="font-mono tabular-nums"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: cfg.bg,
        color: cfg.color,
        borderRadius: 20,
        padding: '3px 12px',
        fontWeight: 700,
        fontSize: '0.8rem',
      }}
    >
      {cfg.icon} {score.toFixed(0)}% {cfg.label}
    </div>
  );
};

const ConfidenceBar = ({ score }) => {
  const sev = getSeverity(score);
  const cfg = severityConfig[sev];
  return (
    <div style={{ background: 'var(--surface-strong)', borderRadius: 8, height: 6, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${score}%`, height: '100%', background: cfg.color, borderRadius: 8, transition: 'width 0.6s ease' }} />
    </div>
  );
};

const fmtINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AnomalyCard = ({ anomaly }) => {
  const sev = getSeverity(anomaly.score);
  const cfg = severityConfig[sev];

  return (
    <div className="anomaly-card" style={{ borderLeft: `4px solid ${cfg.color}` }}>
      <div className="anomaly-card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="font-semibold">{anomaly.vendor || 'Unknown Vendor'}</span>
            <ScoreBadge score={anomaly.score} />
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            {anomaly.category} · <span className="font-mono tabular-nums">{fmtINR(anomaly.amount)}</span> · <span className="font-mono tabular-nums">{anomaly.flagged_at ? new Date(anomaly.flagged_at).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 100 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Detection: <strong style={{ color: 'var(--text-secondary)' }}>{anomaly.method?.toUpperCase()}</strong>
          </div>
          {anomaly.z_score != null && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              z-score: <strong className="font-mono tabular-nums" style={{ color: cfg.color }}>{anomaly.z_score.toFixed(2)}</strong>
            </div>
          )}
        </div>
      </div>
      <ConfidenceBar score={anomaly.score} />
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.82rem', userSelect: 'none' }}>
          Why was this flagged?
        </summary>
        <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
          {anomaly.reason}
        </p>
      </details>
    </div>
  );
};

const AnomalyTab = ({ anomalyData = [], onRescore, userRole = 'Viewer' }) => {
  const [rescoring, setRescoring] = useState(false);
  const [filter, setFilter] = useState('all');
  const canRescore = userRole === 'Analyst' || userRole === 'Admin';

  const handleRescore = async () => {
    setRescoring(true);
    try {
      await onRescore?.();
    } catch (e) {
      console.error('Failed to rescore anomalies:', e);
    }
    setRescoring(false);
  };

  const allAnomalies = Array.isArray(anomalyData) ? anomalyData : [];
  const filtered = filter === 'all'
    ? allAnomalies
    : allAnomalies.filter(a => getSeverity(a.score) === filter.toUpperCase());

  const high = allAnomalies.filter(a => a.score >= 70).length;
  const medium = allAnomalies.filter(a => a.score >= 40 && a.score < 70).length;
  const low = allAnomalies.filter(a => a.score < 40).length;

  return (
    <div className="fade-in">
      <div className="monitoring-header">
        <div className="monitoring-title-group">
          <AlertTriangle size={24} className="text-danger" />
          <h2 className="section-heading">Cost Leak &amp; Anomaly Detector</h2>
        </div>
        {canRescore ? (
          <button
            id="anomaly-rescore-btn"
            className="btn btn-primary"
            onClick={handleRescore}
            disabled={rescoring}
          >
            <RefreshCw size={14} className={rescoring ? 'animate-spin' : ''} />
            {rescoring ? 'Scanning...' : 'Re-score Expenses'}
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(139,92,246,0.10)', color: '#a78bfa',
            borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600,
          }}>
            <Shield size={13} />
            View-only — Analyst+ can re-score
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--primary)' }}>
          <div className="kpi-label">Total Flagged</div>
          <div className="kpi-value font-mono tabular-nums" style={{ color: 'var(--primary)' }}>{allAnomalies.length}</div>
        </div>
        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--danger)' }}>
          <div className="kpi-label">🔴 High Confidence</div>
          <div className="kpi-value font-mono tabular-nums" style={{ color: 'var(--danger)' }}>{high}</div>
        </div>
        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--warning)' }}>
          <div className="kpi-label">🟡 Medium</div>
          <div className="kpi-value font-mono tabular-nums" style={{ color: 'var(--warning)' }}>{medium}</div>
        </div>
        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--success)' }}>
          <div className="kpi-label">🟢 Low</div>
          <div className="kpi-value font-mono tabular-nums" style={{ color: 'var(--success)' }}>{low}</div>
        </div>
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        {['all', 'high', 'medium', 'low'].map(f => (
          <button
            key={f}
            id={`anomaly-filter-${f}`}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 14px', fontSize: '0.82rem' }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {rescoring ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Analyzing expense patterns...</p>
        </div>
      ) : allAnomalies.length === 0 ? (
        <div className="card empty-state">
          <Shield size={48} className="empty-state-icon" style={{ color: 'var(--success)' }} />
          <h3 className="empty-state-title">No Anomalies Detected</h3>
          <p className="empty-state-description">
            Your expense patterns look normal. Add more expense data and click "Re-score Expenses" to run a fresh analysis.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No {filter} confidence anomalies found.
            </div>
          ) : (
            filtered.map((a, i) => <AnomalyCard key={a.id || i} anomaly={a} />)
          )}
        </div>
      )}
    </div>
  );
};

export default AnomalyTab;

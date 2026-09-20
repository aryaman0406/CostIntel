import React, { useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, Filter } from 'lucide-react';

const ACTION_COLORS = {
  chat: { bg: 'var(--primary-soft)', color: 'var(--primary)', label: '💬 Chat' },
  monitoring: { bg: 'rgba(24,140,97,0.12)', color: 'var(--success)', label: '🔍 Monitoring' },
  simulation: { bg: 'rgba(184,121,15,0.12)', color: 'var(--warning)', label: '🎮 Simulation' },
  anomaly: { bg: 'rgba(191,49,82,0.12)', color: 'var(--danger)', label: '⚠️ Anomaly' },
  reconciliation_run: { bg: 'rgba(57,167,255,0.12)', color: 'var(--accent)', label: '🔄 Reconciliation' },
};

const ActionBadge = ({ type }) => {
  const style = ACTION_COLORS[type] || { bg: 'var(--surface-strong)', color: 'var(--text-secondary)', label: type };
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        padding: '2px 10px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
    </span>
  );
};

const LogRow = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const sources = Array.isArray(log.data_sources_used) ? log.data_sources_used : [];

  return (
    <>
      <tr
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(p => !p)}
        className={expanded ? 'expanded-row' : ''}
      >
        <td className="font-mono tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
        </td>
        <td><ActionBadge type={log.action_type} /></td>
        <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.input_summary || '—'}
        </td>
        <td>
          {sources.length > 0
            ? sources.map((s, i) => (
                <span key={i} className="tool-badge font-mono" style={{ marginRight: 4, fontSize: '0.75rem' }}>{s}</span>
              ))
            : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
          }
        </td>
        <td style={{ textAlign: 'center' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5}>
            <div className="log-detail-panel">
              <div className="log-detail-section">
                <strong>Input</strong>
                <p className="font-mono" style={{ fontSize: '0.85rem' }}>{log.input_summary || 'No input recorded.'}</p>
              </div>
              <div className="log-detail-section">
                <strong>AI Output</strong>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{log.output_summary || 'No output recorded.'}</p>
              </div>
              {sources.length > 0 && (
                <div className="log-detail-section">
                  <strong>Data Sources Used</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {sources.map((s, i) => <span key={i} className="tool-badge font-mono">{s}</span>)}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const AuditTrailTab = ({ auditLogs = [], loading = false }) => {
  const [filter, setFilter] = useState('all');

  const filteredLogs = filter === 'all'
    ? auditLogs
    : auditLogs.filter(l => l.action_type === filter);

  return (
    <div className="fade-in">
      <div className="monitoring-header">
        <div className="monitoring-title-group">
          <ClipboardList size={24} className="text-primary" />
          <h2 className="section-heading">AI Audit Trail</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          {['all', 'chat', 'monitoring', 'simulation', 'anomaly', 'reconciliation_run'].map(f => (
            <button
              key={f}
              id={`audit-filter-${f}`}
              className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 12px', fontSize: '0.8rem' }}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'reconciliation_run' ? 'Reconciliation' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        {['chat', 'monitoring', 'simulation', 'anomaly', 'reconciliation_run'].map(type => {
          const count = auditLogs.filter(l => l.action_type === type).length;
          const style = ACTION_COLORS[type] || { color: 'var(--primary)', label: type };
          return (
            <div
              key={type}
              className="kpi-card-minimal"
              style={{ cursor: 'pointer', '--kpi-accent': style.color }}
              onClick={() => setFilter(type)}
            >
              <div className="kpi-label">{style.label}</div>
              <div className="kpi-value font-mono tabular-nums" style={{ color: style.color }}>{count}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Loading audit logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card empty-state">
          <ClipboardList size={48} className="empty-state-icon" />
          <h3 className="empty-state-title">No Audit Logs Yet</h3>
          <p className="empty-state-description">
            AI actions (chat messages, monitoring runs, simulations) will appear here once you start using the platform.
          </p>
        </div>
      ) : (
        <div className="card table-card">
          <h3 className="card-title">
            {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} found
          </h3>
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Input</th>
                <th>Data Sources</th>
                <th style={{ textAlign: 'center' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, i) => (
                <LogRow key={log.id || i} log={log} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditTrailTab;

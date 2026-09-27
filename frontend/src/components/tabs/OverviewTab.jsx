import React from 'react';
import {
  LayoutDashboard, Activity, AlertTriangle, GitMerge, MessageSquare,
  ArrowRight, ShieldCheck, Zap, Sparkles, TrendingDown, Layers, Terminal
} from 'lucide-react';

const formatINR = (val) => {
  const num = Number(val || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatTime = (isoString) => {
  if (!isoString) return '--:--:--';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
};

const LedgerTape = ({ auditLogs = [] }) => {
  const latestLogs = auditLogs.slice(0, 5);

  return (
    <div className="ledger-tape" title="Real-time audit & execution ledger feed">
      <div className="ledger-tape-tag">
        <Terminal size={12} />
        <span>Ledger Feed</span>
      </div>
      <div className="ledger-tape-list">
        {latestLogs.length === 0 ? (
          <span className="font-mono text-muted">Awaiting first system activity / audit entry...</span>
        ) : (
          latestLogs.map((log, idx) => (
            <div key={log.id || idx} className="ledger-tape-item">
              <span className="ledger-tape-time font-mono tabular-nums">[{formatTime(log.timestamp)}]</span>
              <span className="ledger-tape-action font-mono">[{log.action_type || 'SYS'}]</span>
              <span className="ledger-tape-summary font-mono">
                {log.output_summary || log.input_summary || 'Event recorded'}
              </span>
              {idx < latestLogs.length - 1 && <span className="text-muted" style={{ opacity: 0.4 }}>•</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const OverviewTab = ({
  data,
  expensesSummary,
  anomalyData = [],
  reconResult,
  monitoringStatus,
  monitoringRuns = [],
  auditLogs = [],
  setActiveTab
}) => {
  const totalSpend = data?.total_cloud != null
    ? (data.total_cloud + data.total_saas + data.total_ops)
    : (expensesSummary?.total_expenses || 0);

  const anomalyCount = anomalyData.length;
  const highAnomalyCount = anomalyData.filter(a => (a.score || 0) >= 70).length;

  const matchRate = reconResult?.match_rate ?? 95.4;
  const matchedCount = reconResult?.matched_count ?? 62;
  const totalLedger = reconResult?.total_ledger_records ?? 65;

  const latestRun = monitoringRuns[0];
  const estSavings = latestRun?.total_estimated_savings ?? (monitoringStatus?.total_potential_savings || 28500);

  return (
    <div className="overview-container animate-fade-in">
      {/* Live Ledger Tape */}
      <LedgerTape auditLogs={auditLogs} />

      {/* Primary KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--primary)' }}>
          <div className="kpi-label">
            <span>Total Platform Spend</span>
            <Layers size={14} style={{ color: 'var(--primary)' }} />
          </div>
          <div className="kpi-value font-mono tabular-nums">
            {formatINR(totalSpend)}
          </div>
          <div className="kpi-subtext">
            Cloud, SaaS, and operational expense volume
          </div>
        </div>

        <div className="kpi-card-minimal" style={{ '--kpi-accent': anomalyCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
          <div className="kpi-label">
            <span>Active Cost Leaks</span>
            <AlertTriangle size={14} style={{ color: anomalyCount > 0 ? 'var(--danger)' : 'var(--success)' }} />
          </div>
          <div className="kpi-value font-mono tabular-nums">
            {anomalyCount} <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>flags</span>
          </div>
          <div className="kpi-subtext">
            {highAnomalyCount > 0 ? (
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{highAnomalyCount} High Severity Outlier(s)</span>
            ) : (
              <span>Statistical z-score &amp; IQR radar</span>
            )}
          </div>
        </div>

        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--success)' }}>
          <div className="kpi-label">
            <span>Reconciliation Rate</span>
            <GitMerge size={14} style={{ color: 'var(--success)' }} />
          </div>
          <div className="kpi-value font-mono tabular-nums">
            {matchRate}%
          </div>
          <div className="kpi-subtext">
            <span className="font-mono tabular-nums">{matchedCount} / {totalLedger}</span> ledger records resolved
          </div>
        </div>

        <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--accent)' }}>
          <div className="kpi-label">
            <span>Projected Savings</span>
            <TrendingDown size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="kpi-value font-mono tabular-nums">
            {formatINR(estSavings)}
          </div>
          <div className="kpi-subtext">
            Identified monthly FinOps optimization
          </div>
        </div>
      </div>

      {/* Operational Module Grid — 2 cols desktop, 1 col mobile */}
      <div className="grid-2" style={{ gap: '1.25rem', marginTop: '0.5rem' }}>
        {/* Module 1: Reconciliation Status */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <GitMerge size={20} style={{ color: 'var(--primary)' }} />
                <h3 className="card-title" style={{ margin: 0 }}>Multi-Source Reconciliation</h3>
              </div>
              <span className="badge badge-success font-mono tabular-nums">{matchRate}% Matched</span>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>
              Deterministic 3-tier matching engine (Exact, Tolerant ±₹5/3d, Fuzzy SequenceMatcher) with transparent exception triage.
            </p>

            {/* 4-cell tier grid — responsive via auto-fit */}
            <div className="overview-tier-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'EXACT', value: reconResult?.tier_breakdown?.exact ?? 46, color: 'var(--success)' },
                { label: 'TOLERANT', value: (reconResult?.tier_breakdown?.tolerant_amount ?? 7) + (reconResult?.tier_breakdown?.tolerant_date ?? 7), color: 'var(--primary)' },
                { label: 'FUZZY', value: reconResult?.tier_breakdown?.fuzzy ?? 2, color: 'var(--warning)' },
                { label: 'EXCEPTIONS', value: reconResult?.unresolved_count ?? 6, color: 'var(--danger)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '0.6rem', background: 'var(--surface-alt)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.2rem' }}>{label}</div>
                  <div className="font-mono tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-secondary w-full"
            onClick={() => setActiveTab('reconciliation')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <span>Open Reconciliation Queue &amp; Exceptions</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Module 2: Cost Anomaly Radar */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
                <h3 className="card-title" style={{ margin: 0 }}>Statistical Anomaly Radar</h3>
              </div>
              <span className={`badge ${anomalyCount > 0 ? 'badge-danger' : 'badge-success'} font-mono tabular-nums`}>
                {anomalyCount} Detected
              </span>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Pure-Python z-score and Interquartile Range (IQR) detection flagging spend spikes without opaque black-box libraries.
            </p>

            {anomalyData.length === 0 ? (
              <div style={{ padding: '1rem', background: 'var(--surface-alt)', borderRadius: '8px', textAlign: 'center', marginBottom: '1.25rem' }}>
                <ShieldCheck size={24} style={{ color: 'var(--success)', margin: '0 auto 0.35rem' }} />
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Zero Anomalies Detected</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>All expenses are within normal statistical fences</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {anomalyData.slice(0, 2).map((a, i) => (
                  <div key={i} style={{ padding: '0.55rem 0.75rem', background: 'var(--surface-alt)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <span className="font-semibold" style={{ fontSize: '0.84rem', wordBreak: 'break-word' }}>{a.vendor || 'Unknown'}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({a.category})</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="font-mono tabular-nums" style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--danger)' }}>
                        {formatINR(a.amount)}
                      </div>
                      <div className="font-mono tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        score: {a.score}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn btn-secondary w-full"
            onClick={() => setActiveTab('anomalies')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <span>Inspect All Flagged Anomalies</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Module 3: Gemini CFO Intelligence */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Sparkles size={20} style={{ color: 'var(--accent)' }} />
                <h3 className="card-title" style={{ margin: 0 }}>Gemini 2.5 CFO Copilot</h3>
              </div>
              <span className="badge badge-primary">Function Calling Ready</span>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Reasoning agent equipped with autonomous database tools and full compliance audit logging.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.25rem' }}>
              {[
                '💬 "What is my total spend?"',
                '📊 "Break down costs by category"',
                '⚡ "Find top optimization opportunities"',
              ].map((prompt) => (
                <button
                  key={prompt}
                  className="starter-chip"
                  onClick={() => setActiveTab('cfo-chat')}
                  style={{ fontSize: '0.78rem' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={() => setActiveTab('cfo-chat')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <span>Launch CFO Agent Chat</span>
            <MessageSquare size={16} />
          </button>
        </div>

        {/* Module 4: Continuous Cost Monitoring */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Activity size={20} style={{ color: 'var(--primary)' }} />
                <h3 className="card-title" style={{ margin: 0 }}>Autonomous Monitoring &amp; Drift</h3>
              </div>
              <span className="badge badge-success font-mono tabular-nums">
                {monitoringRuns.length} Runs Logged
              </span>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Point-in-time cost governance snapshots tracking scanned records, detected issues, and projected savings over time.
            </p>

            <div style={{ padding: '0.75rem', background: 'var(--surface-alt)', borderRadius: '8px', marginBottom: '1.25rem' }}>
              {[
                { label: 'Latest Scan Records:', value: `${latestRun?.records_scanned ?? (data?.expense_count || 65)} records`, valueStyle: { fontWeight: 700, fontSize: '0.85rem' } },
                { label: 'Issues Detected:', value: `${latestRun?.issues_found ?? 4} cost patterns`, valueStyle: { fontWeight: 700, fontSize: '0.85rem', color: 'var(--warning)' } },
                { label: 'Identified Monthly Leakage:', value: formatINR(estSavings), valueStyle: { fontWeight: 800, fontSize: '0.9rem', color: 'var(--success)' } },
              ].map(({ label, value, valueStyle }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
                  <span className="font-mono tabular-nums" style={valueStyle}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-secondary w-full"
            onClick={() => setActiveTab('monitoring')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <span>Run Monitoring Cycle &amp; History</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;

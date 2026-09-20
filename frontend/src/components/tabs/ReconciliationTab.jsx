import React, { useState } from 'react';
import { GitMerge, RefreshCw, AlertCircle, CheckCircle, Info, ChevronRight, Split, Layers, Filter } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

// ── Tier colour and styling config ───────────────────────────
const TIER_CONFIG = {
  exact:            { color: 'var(--success)', badgeClass: 'recon-tier-exact', label: 'Exact Match', desc: 'Same amount, date & vendor' },
  tolerant_amount:  { color: 'var(--warning)', badgeClass: 'recon-tier-tolerant', label: 'Tolerant (Amount)', desc: 'Date exact, amount ±₹5.00' },
  tolerant_date:    { color: 'var(--warning)', badgeClass: 'recon-tier-tolerant', label: 'Tolerant (Date)', desc: 'Amount exact, date ±3 days' },
  fuzzy:            { color: 'var(--primary)', badgeClass: 'recon-tier-fuzzy', label: 'Fuzzy Vendor', desc: 'Vendor similarity ≥75%, within tolerance' },
};

const EXCEPTION_COLOR = {
  ledger_unmatched: { bg: 'rgba(191,49,82,0.10)', border: 'var(--danger)', icon: '⚠️', label: 'Ledger — no match' },
  statement_orphan: { bg: 'rgba(184,121,15,0.10)', border: 'var(--warning)', icon: '🏦', label: 'Statement only' },
};

// ── Formatters ───────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const friendlyReason = (reason = '') => {
  if (reason === 'orphaned_statement_record')      return 'Bank charge has no matching ledger entry';
  if (reason === 'no_candidate_within_tolerance')  return 'No statement record found within matching window';
  if (reason.startsWith('multiple_ambiguous'))     return `Duplicate bank posting — ${reason.match(/\d+/)?.[0] ?? '2'} identical candidates`;
  if (reason.includes('amount_delta') && reason.includes('date_delta'))
    return `Amount & date both outside tolerance — ${reason.replace(/_/g,' ')}`;
  if (reason.includes('amount_delta'))
    return `Amount delta exceeds ±₹5 tolerance — ${reason.replace(/_/g,' ')}`;
  if (reason.includes('date_delta'))
    return `Date gap exceeds ±3 days tolerance — ${reason.replace(/_/g,' ')}`;
  return reason.replace(/_/g, ' ');
};

// ── KPI / Stat Badge ─────────────────────────────────────────
const StatBadge = ({ label, value, color, sub }) => (
  <div className="kpi-card-minimal" style={{ '--kpi-accent': color }}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value font-mono tabular-nums" style={{ color }}>{value}</div>
    {sub && <div className="kpi-subtext font-mono tabular-nums">{sub}</div>}
  </div>
);

// ── Expandable Matched Record Row ────────────────────────────
const MatchedRecordRow = ({ match, idx }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = TIER_CONFIG[match.tier] || TIER_CONFIG.exact;

  const toggle = () => setExpanded(prev => !prev);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  const isFuzzy = match.tier === 'fuzzy';
  const hasAmountDelta = match.delta_amount > 0;
  const hasDateDelta = match.delta_days > 0;

  return (
    <>
      <tr
        className="recon-row-clickable"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-expanded={expanded}
        style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--surface-alt)' }}
      >
        <td style={{ width: 32, paddingLeft: 12 }}>
          <ChevronRight size={15} className={`recon-chevron ${expanded ? 'open' : ''}`} />
        </td>
        <td>
          <span className="font-mono tabular-nums" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
            {match.ledger_id}
          </span>
        </td>
        <td>
          <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{match.ledger_vendor}</div>
          <div className="font-mono tabular-nums" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Stmt: {match.statement_id} ({match.statement_vendor})
          </div>
        </td>
        <td className="font-mono tabular-nums" style={{ fontWeight: 600 }}>
          {fmt(match.ledger_amount)}
        </td>
        <td className="font-mono tabular-nums" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          {match.ledger_date}
        </td>
        <td>
          <span className={`recon-tier-badge ${cfg.badgeClass}`}>
            {cfg.label}
          </span>
        </td>
        <td className="font-mono tabular-nums" style={{ fontWeight: 700, color: cfg.color, fontSize: '0.84rem' }}>
          {match.confidence.toFixed(1)}%
        </td>
      </tr>

      {/* Expanded math & scoring detail */}
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <div className="recon-detail-wrapper">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                  Scoring & Delta Decomposition — Tier: {cfg.label}
                </strong>
                <span className="font-mono tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Ledger {match.ledger_id} ↔ Statement {match.statement_id}
                </span>
              </div>

              <div className="recon-stat-chips">
                <div className="recon-stat-chip">
                  <span className="recon-stat-chip-label">Amount Delta:</span>
                  <span className="recon-stat-chip-val font-mono tabular-nums" style={{ color: hasAmountDelta ? 'var(--warning)' : 'var(--success)' }}>
                    ₹{match.delta_amount.toFixed(2)}
                  </span>
                </div>

                <div className="recon-stat-chip">
                  <span className="recon-stat-chip-label">Date Delta:</span>
                  <span className="recon-stat-chip-val font-mono tabular-nums" style={{ color: hasDateDelta ? 'var(--warning)' : 'var(--success)' }}>
                    {match.delta_days} day{match.delta_days !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="recon-stat-chip">
                  <span className="recon-stat-chip-label">Vendor Similarity:</span>
                  <span className="recon-stat-chip-val font-mono tabular-nums" style={{ color: isFuzzy ? 'var(--primary)' : 'var(--success)' }}>
                    {(match.vendor_similarity * 100).toFixed(1)}%
                  </span>
                  {isFuzzy && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 4 }}>
                      ("{match.ledger_vendor}" vs "{match.statement_vendor}")
                    </span>
                  )}
                </div>

                <div className="recon-stat-chip">
                  <span className="recon-stat-chip-label">Confidence Score:</span>
                  <span className="recon-stat-chip-val font-mono tabular-nums" style={{ color: cfg.color }}>
                    {match.confidence.toFixed(1)}%
                  </span>
                </div>
              </div>

              {match.ambiguity_note && (
                <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--warning)' }}>
                  ℹ️ {match.ambiguity_note}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ── Exception Row & Ambiguous Comparison Card ────────────────
const ExceptionRow = ({ ex, idx }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = EXCEPTION_COLOR[ex.type] || EXCEPTION_COLOR.ledger_unmatched;
  const l   = ex.ledger;
  const c   = ex.closest_statement_candidate;
  const detail = ex.candidate_match_detail;
  const isAmbiguous = (ex.ambiguous_candidates && ex.ambiguous_candidates.length > 1) ||
                      (ex.reason && ex.reason.startsWith('multiple_ambiguous'));

  const toggle = () => setExpanded(prev => !prev);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <>
      <tr
        className="recon-row-clickable"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-expanded={expanded}
        style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--surface-alt)' }}
      >
        <td style={{ width: 32, paddingLeft: 12 }}>
          <ChevronRight size={15} className={`recon-chevron ${expanded ? 'open' : ''}`} />
        </td>
        <td>
          <span className="font-mono tabular-nums" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
            {l?.id ?? '—'}
          </span>
        </td>
        <td>
          <span style={{ fontWeight: 600 }}>{l?.vendor ?? <em style={{ color: 'var(--text-muted)' }}>—</em>}</span>
        </td>
        <td className="font-mono tabular-nums">{l ? fmt(l.amount) : '—'}</td>
        <td className="font-mono tabular-nums" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          {l?.date ?? '—'}
        </td>

        {/* Closest candidate or Ambiguous badge */}
        <td>
          {isAmbiguous ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--danger)', fontWeight: 600, fontSize: '0.8rem' }}>
              <Split size={13} /> {ex.ambiguous_candidates?.length || 2} Ambiguous Postings
            </span>
          ) : c ? (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              {c.vendor}<br />
              <span className="font-mono tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {c.id} · {c.date}
              </span>
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None found</span>
          )}
        </td>
        <td className="font-mono tabular-nums">{c ? fmt(c.amount) : '—'}</td>

        {/* Reason */}
        <td>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: cfg.bg, borderLeft: `3px solid ${cfg.border}`,
            borderRadius: '0 8px 8px 0', padding: '3px 10px',
            fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)',
          }}>
            {cfg.icon} {friendlyReason(ex.reason)}
          </span>
        </td>
      </tr>

      {/* Expanded View — Side-by-Side Cards for Ambiguous, Scoring Breakdown for Unmatched */}
      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding: 0 }}>
            <div className="recon-detail-wrapper">
              {isAmbiguous ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Split size={16} /> Duplicate Statement Candidates (Ambiguous Reconciliation)
                    </div>
                    <span className="font-mono tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Ledger ID: {l?.id} ({l?.vendor} — {fmt(l?.amount)} on {l?.date})
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Multiple statement transactions matched this ledger entry with identical confidence. Rather than auto-matching arbitrarily, CostIntel flags this as an honest exception for CFO review.
                  </p>

                  <div className="ambiguous-comparison-container">
                    {(ex.ambiguous_candidates && ex.ambiguous_candidates.length > 0 ? ex.ambiguous_candidates : [
                      { statement: { id: 'STMT-0064', vendor: l?.vendor || 'Vendor', amount: l?.amount || 0, date: l?.date }, match_detail: { delta_amount: 0, delta_days: 0, vendor_similarity: 1.0, confidence: 100.0 } },
                      { statement: { id: 'STMT-0065', vendor: l?.vendor || 'Vendor', amount: l?.amount || 0, date: l?.date }, match_detail: { delta_amount: 0, delta_days: 0, vendor_similarity: 1.0, confidence: 100.0 } }
                    ]).map((cand, ci) => (
                      <div key={ci} className="ambiguous-candidate-card" style={{ borderLeft: '4px solid var(--danger)' }}>
                        <div className="ambiguous-candidate-header">
                          <span>Statement Candidate #{ci + 1}</span>
                          <span className="font-mono tabular-nums" style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>
                            {cand.statement.id}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Vendor:</span>
                          <strong>{cand.statement.vendor}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Amount:</span>
                          <strong className="font-mono tabular-nums">{fmt(cand.statement.amount)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Posting Date:</span>
                          <span className="font-mono tabular-nums">{cand.statement.date}</span>
                        </div>
                        <div className="recon-stat-chips" style={{ marginTop: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                          <div className="recon-stat-chip">
                            <span className="recon-stat-chip-label">Δ Amount:</span>
                            <span className="recon-stat-chip-val font-mono tabular-nums">₹{Number(cand.match_detail?.delta_amount || 0).toFixed(2)}</span>
                          </div>
                          <div className="recon-stat-chip">
                            <span className="recon-stat-chip-label">Δ Days:</span>
                            <span className="recon-stat-chip-val font-mono tabular-nums">{cand.match_detail?.delta_days ?? 0}d</span>
                          </div>
                          <div className="recon-stat-chip">
                            <span className="recon-stat-chip-label">Score:</span>
                            <span className="recon-stat-chip-val font-mono tabular-nums" style={{ color: 'var(--danger)' }}>
                              {cand.match_detail?.confidence ?? 100}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <strong style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                    Nearest Candidate Math & Tolerance Analysis
                  </strong>
                  <div className="recon-stat-chips" style={{ marginTop: '0.4rem' }}>
                    {detail ? (
                      <>
                        <div className="recon-stat-chip">
                          <span className="recon-stat-chip-label">Amount Delta:</span>
                          <span className="recon-stat-chip-val font-mono tabular-nums" style={{ color: 'var(--danger)' }}>
                            ₹{detail.delta_amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="recon-stat-chip">
                          <span className="recon-stat-chip-label">Date Lag:</span>
                          <span className="recon-stat-chip-val font-mono tabular-nums" style={{ color: 'var(--danger)' }}>
                            {detail.delta_days} day{detail.delta_days !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="recon-stat-chip">
                          <span className="recon-stat-chip-label">Vendor Similarity:</span>
                          <span className="recon-stat-chip-val font-mono tabular-nums">
                            {(detail.vendor_similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        No statement record found within search window.
                      </span>
                    )}
                    <div className="recon-stat-chip">
                      <span className="recon-stat-chip-label">Status:</span>
                      <span className="recon-stat-chip-val font-mono tabular-nums" style={{ color: 'var(--danger)' }}>
                        Failed all 3 tiers
                      </span>
                    </div>
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

// ── Main Component ───────────────────────────────────────────

const ReconciliationTab = ({ reconResult, reconLoading, onRunRecon }) => {
  const [running, setRunning] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('all'); // 'all' | 'exceptions' | 'exact' | 'tolerant' | 'fuzzy'

  const handleRun = async () => {
    setRunning(true);
    try {
      await onRunRecon?.();
    } catch (e) {
      console.error('Failed to run reconciliation:', e);
    }
    setRunning(false);
  };

  const r = reconResult;

  const tierData = r ? [
    { name: 'Exact', count: r.tier_breakdown?.exact ?? 0, fill: TIER_CONFIG.exact.color },
    { name: 'Tolerant\n(Amount)', count: r.tier_breakdown?.tolerant_amount ?? 0, fill: TIER_CONFIG.tolerant_amount.color },
    { name: 'Tolerant\n(Date)', count: r.tier_breakdown?.tolerant_date ?? 0, fill: TIER_CONFIG.tolerant_date.color },
    { name: 'Fuzzy\nVendor', count: r.tier_breakdown?.fuzzy ?? 0, fill: TIER_CONFIG.fuzzy.color },
  ] : [];

  const matches = r?.matches ?? [];
  const exceptions = r?.exceptions ?? [];
  const matchRate = r?.match_rate ?? 0;
  const matchColor = matchRate >= 90 ? 'var(--success)' : matchRate >= 70 ? 'var(--warning)' : 'var(--danger)';

  // Filter matches based on sub-tab
  const filteredMatches = matches.filter(m => {
    if (activeSubTab === 'all') return true;
    if (activeSubTab === 'exact') return m.tier === 'exact';
    if (activeSubTab === 'tolerant') return m.tier === 'tolerant_amount' || m.tier === 'tolerant_date';
    if (activeSubTab === 'fuzzy') return m.tier === 'fuzzy';
    return true;
  });

  return (
    <div className="fade-in">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="monitoring-header">
        <div className="monitoring-title-group">
          <GitMerge size={24} className="text-primary" />
          <h2 className="section-heading">Multi-Source Reconciliation</h2>
          {r && <span className="pulse-dot active" />}
        </div>
        <button
          id="recon-run-btn"
          className="btn btn-primary"
          onClick={handleRun}
          disabled={running || reconLoading}
        >
          <RefreshCw size={14} className={(running || reconLoading) ? 'animate-spin' : ''} />
          {running || reconLoading ? 'Running...' : 'Run Reconciliation'}
        </button>
      </div>

      {/* ── Empty State ────────────────────────────────────── */}
      {!r && !reconLoading && (
        <div className="card empty-state" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <GitMerge size={52} className="empty-state-icon" style={{ color: 'var(--primary)' }} />
          <h3 className="empty-state-title">No Reconciliation Run Yet</h3>
          <p className="empty-state-description">
            Click "Run Reconciliation" to match internal ledger records against bank/vendor
            statement records using 3-tier fuzzy matching with full scoring decomposition.
          </p>
          <button id="recon-start-btn" className="btn btn-primary" onClick={handleRun} disabled={running}>
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
            {running ? 'Running...' : 'Start Reconciliation'}
          </button>
        </div>
      )}

      {/* ── Loading State ──────────────────────────────────── */}
      {reconLoading && !r && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Reconciling multi-source records...</p>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {r && (
        <>
          {/* Headline Stats Banner */}
          <div className="last-run-banner" style={{ marginBottom: '1.4rem', flexWrap: 'wrap' }}>
            <div className="last-run-stat">
              <CheckCircle size={16} style={{ color: matchColor }} />
              <span>Match rate <strong className="font-mono tabular-nums" style={{ color: matchColor }}>{matchRate.toFixed(1)}%</strong></span>
            </div>
            <div className="last-run-stat">
              <Info size={16} />
              <span>Ledger: <strong className="font-mono tabular-nums">{r.total_ledger_records}</strong> records</span>
            </div>
            <div className="last-run-stat">
              <Info size={16} />
              <span>Statement: <strong className="font-mono tabular-nums">{r.total_statement_records}</strong> records</span>
            </div>
            <div className="last-run-stat">
              <CheckCircle size={16} style={{ color: 'var(--success)' }} />
              <span>Matched: <strong className="font-mono tabular-nums">{r.matched_count}</strong></span>
            </div>
            <div className="last-run-stat">
              <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
              <span>Exceptions: <strong className="font-mono tabular-nums" style={{ color: 'var(--danger)' }}>{r.unresolved_count}</strong></span>
            </div>
            {r.run_at && (
              <div className="last-run-stat" style={{ marginLeft: 'auto' }}>
                <span className="font-mono tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Run at {new Date(r.run_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Metric Cards */}
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <StatBadge label="Match Rate" value={`${matchRate.toFixed(1)}%`} color={matchColor} sub={`${r.matched_count} / ${r.total_ledger_records}`} />
            <StatBadge label="Exact Matches" value={r.tier_breakdown?.exact ?? 0} color={TIER_CONFIG.exact.color} sub="Tier 1 (0 delta)" />
            <StatBadge label="Tolerant" value={(r.tier_breakdown?.tolerant_amount ?? 0) + (r.tier_breakdown?.tolerant_date ?? 0)} color={TIER_CONFIG.tolerant_amount.color} sub="Tier 2 (±₹5.00 / ±3d)" />
            <StatBadge label="Fuzzy Vendor" value={r.tier_breakdown?.fuzzy ?? 0} color={TIER_CONFIG.fuzzy.color} sub="Tier 3 (similarity ≥75%)" />
          </div>

          {/* Tier Breakdown Chart */}
          <div className="card card-3d" style={{ marginBottom: '1.5rem' }}>
            <h3 className="card-title">Match Breakdown by Tier</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tierData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={11} width={90} />
                    <Tooltip formatter={(v) => [v, 'Records matched']} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {tierData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tier Legend Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
                  const count = key === 'tolerant_amount' ? (r.tier_breakdown?.tolerant_amount ?? 0) :
                                key === 'tolerant_date' ? (r.tier_breakdown?.tolerant_date ?? 0) :
                                (r.tier_breakdown?.[key] ?? 0);
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--surface-alt)',
                      borderRadius: 10, padding: '8px 14px',
                      borderLeft: `4px solid ${cfg.color}`,
                    }}>
                      <div style={{ minWidth: 36, textAlign: 'center' }}>
                        <strong className="font-mono tabular-nums" style={{ color: cfg.color, fontSize: '1.1rem' }}>
                          {count}
                        </strong>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cfg.label}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{cfg.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Prominent Exception List ──────────────────────── */}
          <div className="card table-card" style={{ borderTop: '4px solid var(--danger)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={20} /> Exception List — {exceptions.length} Unresolved Record{exceptions.length !== 1 ? 's' : ''}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click any row to expand scoring math, nearest candidate deltas, or ambiguous candidate side-by-side comparison.
                </p>
              </div>
              <div className="font-mono tabular-nums" style={{
                background: 'rgba(191,49,82,0.10)', color: 'var(--danger)',
                borderRadius: 20, padding: '4px 14px', fontWeight: 700, fontSize: '0.85rem',
              }}>
                {(100 - matchRate).toFixed(1)}% unresolved
              </div>
            </div>

            {exceptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--success)', fontWeight: 600 }}>
                <CheckCircle size={32} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                Perfect reconciliation — no exceptions found!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" id="exception-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>Ledger ID</th>
                      <th>Ledger Vendor</th>
                      <th>Ledger Amount</th>
                      <th>Ledger Date</th>
                      <th>Closest Candidate</th>
                      <th>Cand. Amount</th>
                      <th>Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((ex, i) => (
                      <ExceptionRow key={ex.ledger?.id ?? `orphan-${i}`} ex={ex} idx={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Matched Records Section with Scoring Decomposition ── */}
          <div className="card table-card" style={{ borderTop: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={20} className="text-success" /> Matched Records — {matches.length} Records Resolved
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click any matched record to inspect exact amount delta (₹), date delta (days), and vendor difflib similarity score.
                </p>
              </div>

              {/* Sub-tab filter buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: `All (${matches.length})` },
                  { key: 'exact', label: `Exact (${r.tier_breakdown?.exact ?? 0})` },
                  { key: 'tolerant', label: `Tolerant (${(r.tier_breakdown?.tolerant_amount ?? 0) + (r.tier_breakdown?.tolerant_date ?? 0)})` },
                  { key: 'fuzzy', label: `Fuzzy (${r.tier_breakdown?.fuzzy ?? 0})` },
                ].map(tab => (
                  <button
                    key={tab.key}
                    id={`recon-filter-${tab.key}`}
                    className={`btn ${activeSubTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                    onClick={() => setActiveSubTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No records match the selected filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" id="matched-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>Ledger ID</th>
                      <th>Vendor / Pairing</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Resolution Tier</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatches.map((m, i) => (
                      <MatchedRecordRow key={`${m.ledger_id}-${m.statement_id}-${i}`} match={m} idx={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Thresholds Reference ───────────────────────── */}
          <div className="card" style={{ marginTop: '1.2rem' }}>
            <h3 className="card-title" style={{ fontSize: '0.88rem' }}>Matching Engine Thresholds</h3>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>💰 Amount tolerance: <strong>±₹{r.thresholds?.amount_tolerance_inr?.toFixed(2) || '5.00'}</strong></span>
              <span>📅 Date tolerance: <strong>±{r.thresholds?.date_tolerance_days || 3} days</strong></span>
              <span>🔤 Fuzzy threshold: <strong>{((r.thresholds?.fuzzy_vendor_threshold ?? 0.75) * 100).toFixed(0)}% difflib similarity</strong></span>
              <span>📦 Source dataset: <strong>Pre-generated fixture data (65 × 65 records)</strong></span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReconciliationTab;

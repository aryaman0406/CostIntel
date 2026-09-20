/**
 * Features Section — Part A: 4 benefit blocks. Part B: 8-card capability grid.
 */
import React, { useState } from 'react';
import {
  Layers, TrendingUp, MessageSquare, BarChart2,
  GitMerge, AlertTriangle, Bot, Activity,
  Sliders, Calculator, UploadCloud, Shield,
  ArrowUpRight
} from 'lucide-react';
import Reveal from '../components/Reveal';

// ── Part A: Benefit blocks with interactive demos ─────────────────────────

const TIERS = ['Exact', 'Tolerant', 'Fuzzy'];
const TIER_COLORS = { Exact: '#2ee6a6', Tolerant: '#38bdf8', Fuzzy: '#b48cff' };
const TIER_DESCS = {
  Exact:    'Amounts, dates and vendor names match perfectly.',
  Tolerant: 'Within ±₹5 and ±1–3 days — same vendor, minor differences.',
  Fuzzy:    'SequenceMatcher ≥ 0.75 — "AWS" ↔ "Amazon Web Services".',
};

function ReconDemo() {
  const [tier, setTier] = useState('Exact');
  return (
    <div className="feat-demo feat-demo--recon" aria-label="Reconciliation tier demo">
      <div className="feat-demo-tabs" role="group" aria-label="Select matching tier">
        {TIERS.map(t => (
          <button
            key={t}
            className={`feat-tier-btn${tier === t ? ' feat-tier-btn--active' : ''}`}
            style={tier === t ? { borderColor: TIER_COLORS[t], color: TIER_COLORS[t], background: `${TIER_COLORS[t]}18` } : {}}
            onClick={() => setTier(t)}
            aria-pressed={tier === t}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="feat-tier-rows">
        <div className="feat-tier-row" style={{ borderColor: TIER_COLORS[tier], boxShadow: `0 0 10px ${TIER_COLORS[tier]}33` }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>₹12,500 · AWS</span>
          <span className="feat-tier-badge" style={{ color: TIER_COLORS[tier] }}>✓ {tier}</span>
        </div>
        <p className="feat-tier-desc">{TIER_DESCS[tier]}</p>
      </div>
    </div>
  );
}

function DetectDemo() {
  return (
    <div className="feat-demo feat-demo--detect" aria-label="Anomaly detection demo" role="img">
      <div className="feat-chart-wrap">
        <div className="feat-chart-bars">
          {[4200,5100,4800,4600,5200,5000,50000,4900].map((v, i) => {
            const max = 50000;
            const isAnomaly = v > 20000;
            return (
              <div
                key={i}
                className={`feat-chart-bar${isAnomaly ? ' feat-chart-bar--anomaly' : ''}`}
                style={{
                  height: `${(v / max) * 100}%`,
                  background: isAnomaly ? '#ffb547' : '#4f8cff44',
                  borderTop: `2px solid ${isAnomaly ? '#ffb547' : '#4f8cff'}`,
                }}
                title={`₹${v.toLocaleString('en-IN')}`}
              />
            );
          })}
        </div>
        <div className="feat-chart-tooltip" aria-label="Anomaly tooltip">
          <span style={{ color: '#ffb547', fontFamily: 'JetBrains Mono, monospace' }}>₹50,000</span>
          <span>Cloud · z-score 3.86</span>
          <span>900% above avg · 94% confidence</span>
        </div>
      </div>
    </div>
  );
}

function ChatDemo() {
  const MESSAGES = [
    { role: 'user', text: "What's our Cloud spend this month?" },
    { role: 'tool', text: 'get_expense_summary(category="Cloud")' },
    { role: 'tool', text: 'get_category_totals()' },
    { role: 'bot',  text: 'Cloud spend this month is ₹62,300 — 24% over budget. I found 3 anomalies. Want me to run a simulation?' },
  ];
  return (
    <div className="feat-demo feat-demo--chat" aria-label="CFO agent chat demo">
      {MESSAGES.map((m, i) => (
        <div key={i} className={`feat-chat-msg feat-chat-msg--${m.role}`}>
          {m.role === 'tool' ? (
            <span className="feat-tool-chip">
              <span className="feat-tool-dot" aria-hidden="true" />
              {m.text}
            </span>
          ) : (
            <span>{m.text}</span>
          )}
        </div>
      ))}
      <div className="feat-fallback-badge">
        <span>Zero-downtime rule-based fallback</span>
      </div>
    </div>
  );
}

function SimDemo() {
  const [val, setVal] = useState(15);
  const savings = Math.round((val / 100) * 500000);
  return (
    <div className="feat-demo feat-demo--sim" aria-label="Savings simulator teaser">
      <div className="feat-sim-row">
        <label className="feat-sim-label" htmlFor="feat-slider">Cloud spend reduction</label>
        <span className="feat-sim-pct" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{val}%</span>
      </div>
      <input
        id="feat-slider"
        type="range" min={5} max={40} value={val}
        onChange={e => setVal(Number(e.target.value))}
        className="feat-sim-slider"
        aria-label={`Cloud spend reduction: ${val}%`}
      />
      <div className="feat-sim-result">
        <div>
          <span className="feat-sim-label">Estimated monthly savings</span>
          <span className="feat-sim-amount" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{savings.toLocaleString('en-IN')}
          </span>
        </div>
        <span className="feat-sim-note">Illustrative model · Sign up to run on your data</span>
      </div>
    </div>
  );
}

const BENEFITS = [
  {
    icon: Layers,
    color: '#2ee6a6',
    title: 'Reconcile',
    tagline: '3-tier matching engine',
    desc: 'Exact · Tolerant (±₹5 / ±3d) · Fuzzy (SequenceMatcher ≥ 0.75). Every exception gets a root-cause tag. One-click audit-ready PDF.',
    Demo: ReconDemo,
    variant: 'slideLeft',
  },
  {
    icon: TrendingUp,
    color: '#ffb547',
    title: 'Detect',
    tagline: 'Pure-Python Z-score + IQR',
    desc: 'Per-category anomaly scoring with confidence 0–100%. Explainable — every alert shows the exact z-score and deviation.',
    Demo: DetectDemo,
    variant: 'slideRight',
  },
  {
    icon: MessageSquare,
    color: '#7c5cff',
    title: 'Ask',
    tagline: 'Gemini 2.5 CFO Agent',
    desc: 'Autonomous function-calling over your expense data. get_expense_summary · get_category_totals · run_simulation and more. Zero-downtime rule-based fallback.',
    Demo: ChatDemo,
    variant: 'slideLeft',
  },
  {
    icon: BarChart2,
    color: '#4f8cff',
    title: 'Forecast & Monitor',
    tagline: 'Drift · Budget burn · ROI',
    desc: 'Track spend drift over time, get proactive recommendations (duplicate subs, tier downgrades), run what-if scenarios, and export ROI reports.',
    Demo: SimDemo,
    variant: 'slideRight',
  },
];

// ── Part B: 8-card capability grid ────────────────────────────────────────

const CAPABILITIES = [
  { icon: GitMerge,    title: 'Reconciliation Agent',   desc: '3-tier matching with exception triage and PDF export.',       color: '#2ee6a6' },
  { icon: AlertTriangle, title: 'Anomaly Engine',        desc: 'Z-score + IQR detection, per-category, confidence scored.',   color: '#ffb547' },
  { icon: Bot,          title: 'CFO Agent',              desc: 'Gemini 2.5 with 5 autonomous tools + rule-based fallback.',   color: '#7c5cff' },
  { icon: Activity,     title: 'Cost Monitoring',        desc: 'Drift tracking, budget burn-rate, proactive recommendations.', color: '#4f8cff' },
  { icon: Sliders,      title: 'Scenario Simulator',     desc: 'What-if modeling with instant illustrative ROI output.',       color: '#b48cff' },
  { icon: Calculator,   title: 'ROI Calculator',         desc: 'Annualised savings projections from your own spend data.',    color: '#38bdf8' },
  { icon: UploadCloud,  title: 'Expense & Ledger CRUD',  desc: 'CSV bulk ingest with dirty-data validation and soft-delete.', color: '#2ee6a6' },
  { icon: Shield,       title: 'RBAC & Audit Trail',     desc: 'JWT + bcrypt, role-scoped data, immutable AuditLog table.',   color: '#4f8cff' },
];

export default function Features({ onOpenSignup }) {
  return (
    <section id="features" aria-labelledby="features-heading" className="features-section">
      <div className="section-inner">
        <Reveal variant="pop">
          <div className="section-eyebrow"><span>Platform capabilities</span></div>
          <h2 id="features-heading" className="section-h2">
            Everything you need to govern cloud spend
          </h2>
          <p className="section-sub">
            From raw CSV to boardroom-ready audit reports — CostIntel handles the full FinOps pipeline autonomously.
          </p>
        </Reveal>

        {/* Part A */}
        <div className="feat-benefit-list">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon;
            const Demo = b.Demo;
            const isRight = i % 2 !== 0;
            return (
              <div key={b.title} className={`feat-benefit-block${isRight ? ' feat-benefit-block--rev' : ''}`}>
                <Reveal variant={b.variant} delay={100} className="feat-benefit-text">
                  <div className="feat-benefit-icon-wrap" style={{ '--b-color': b.color }}>
                    <Icon size={24} aria-hidden="true" />
                  </div>
                  <h3 className="feat-benefit-title">{b.title}</h3>
                  <p className="feat-benefit-tagline" style={{ color: b.color }}>{b.tagline}</p>
                  <p className="feat-benefit-desc">{b.desc}</p>
                </Reveal>
                <Reveal variant={isRight ? 'slideLeft' : 'slideRight'} delay={200} className="feat-benefit-demo-wrap">
                  <Demo onOpenSignup={onOpenSignup} />
                </Reveal>
              </div>
            );
          })}
        </div>

        {/* Part B — 8-card grid */}
        <Reveal variant="pop" delay={100}>
          <h3 className="feat-grid-heading">Everything included</h3>
        </Reveal>
        <div className="feat-capability-grid">
          {CAPABILITIES.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.title} variant="pop" delay={i * 70}>
                <div className="feat-cap-card">
                  <div className="feat-cap-icon" style={{ color: c.color, background: `${c.color}18`, borderColor: `${c.color}30` }}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="feat-cap-body">
                    <h4 className="feat-cap-title">{c.title}</h4>
                    <p className="feat-cap-desc">{c.desc}</p>
                  </div>
                  <div className="feat-cap-arrow" aria-hidden="true">
                    <ArrowUpRight size={14} />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

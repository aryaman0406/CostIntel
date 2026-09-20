/**
 * HowItWorks — Vertical scroll-filled timeline with 4 steps.
 * Uses GSAP ScrollTrigger if available, falls back to IntersectionObserver.
 */
import React, { useEffect, useRef } from 'react';
import { UploadCloud, GitMerge, Brain, TrendingUp } from 'lucide-react';
import Reveal from '../components/Reveal';

const STEPS = [
  {
    num: '01',
    icon: UploadCloud,
    title: 'Ingest',
    desc: 'Upload your ledger and bank CSVs. Dirty rows are validated row-by-row and rejected with specific reasons (missing date, invalid amount). Clean rows proceed immediately.',
    color: '#4f8cff',
    details: ['CSV or manual entry', 'Row-level validation', 'Dirty-data rejection with reasons', 'Bulk ingest up to thousands of rows'],
  },
  {
    num: '02',
    icon: GitMerge,
    title: 'Reconcile',
    desc: 'The 3-tier engine runs: Exact match first, then Tolerant (±₹5 / ±1–3 days), then Fuzzy vendor name matching. Unmatched rows go to an Exception Queue with root-cause tags.',
    color: '#2ee6a6',
    details: ['Exact · Tolerant · Fuzzy tiers', 'Exception queue with root-cause tags', 'High-accuracy automated matching', 'One-click audit-ready PDF'],
  },
  {
    num: '03',
    icon: Brain,
    title: 'Detect & Reason',
    desc: 'Per-category Z-score + IQR analysis flags anomalies with confidence 0–100%. The Gemini 2.5 CFO agent can answer questions, summarise trends and trigger simulations autonomously.',
    color: '#7c5cff',
    details: ['Pure-Python Z-score + IQR', 'Confidence-scored anomalies', 'Gemini 2.5 CFO agent (5 tools)', 'Rule-based fallback — always available'],
  },
  {
    num: '04',
    icon: TrendingUp,
    title: 'Monitor & Simulate',
    desc: 'Track spend drift, budget burn-rate and get proactive recommendations. Run what-if scenarios, calculate ROI, and export reports. Every action is logged to an immutable audit trail.',
    color: '#38bdf8',
    details: ['Spend drift & budget tracking', 'Proactive recommendations', 'What-if scenario simulator', 'Immutable AuditLog — every action'],
  },
];

export default function HowItWorks() {
  const lineRef = useRef(null);
  const nodeRefs = useRef([]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      if (lineRef.current) lineRef.current.style.height = '100%';
      return;
    }

    // Animate line fill on scroll
    const updateLine = () => {
      const section = document.getElementById('how-it-works');
      if (!section || !lineRef.current) return;
      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const progress = Math.max(0, Math.min(1, (viewH - rect.top) / (rect.height + viewH)));
      lineRef.current.style.height = `${progress * 100}%`;
    };

    window.addEventListener('scroll', updateLine, { passive: true });
    updateLine();
    return () => window.removeEventListener('scroll', updateLine);
  }, []);

  return (
    <section id="how-it-works" aria-labelledby="hiw-heading" className="hiw-section">
      <div className="section-inner">
        <Reveal variant="pop">
          <div className="section-eyebrow"><span>The pipeline</span></div>
          <h2 id="hiw-heading" className="section-h2">How CostIntel works</h2>
          <p className="section-sub">
            From raw CSV upload to boardroom-ready insight — four autonomous steps.
          </p>
        </Reveal>

        <div className="hiw-timeline">
          {/* Vertical line track */}
          <div className="hiw-line-track" aria-hidden="true">
            <div className="hiw-line-fill" ref={lineRef} />
          </div>

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="hiw-step"
                ref={el => nodeRefs.current[i] = el}
              >
                {/* Node */}
                <div className="hiw-node-wrap" aria-hidden="true">
                  <div
                    className="hiw-node"
                    style={{ borderColor: step.color, boxShadow: `0 0 0 4px ${step.color}22` }}
                  >
                    <span className="hiw-node-num" style={{ color: step.color }}>{step.num}</span>
                  </div>
                </div>

                {/* Content */}
                <Reveal variant={i % 2 === 0 ? 'slideLeft' : 'slideRight'} delay={100} className="hiw-content">
                  <div className="hiw-content-card" style={{ '--step-color': step.color }}>
                    <div className="hiw-content-icon" style={{ color: step.color, background: `${step.color}18` }}>
                      <Icon size={22} aria-hidden="true" />
                    </div>
                    <h3 className="hiw-content-title">
                      <span className="hiw-step-label" style={{ color: step.color }}>{step.num}</span>
                      {step.title}
                    </h3>
                    <p className="hiw-content-desc">{step.desc}</p>
                    <ul className="hiw-detail-list" aria-label={`${step.title} details`}>
                      {step.details.map(d => (
                        <li key={d} className="hiw-detail-item">
                          <span className="hiw-detail-arrow" style={{ color: step.color }} aria-hidden="true">→</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

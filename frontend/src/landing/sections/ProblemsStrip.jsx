/**
 * ProblemsStrip — 4-card strip: "Problems We Solve".
 */
import React from 'react';
import { Clock, TrendingUp, Shuffle, Eye } from 'lucide-react';
import Reveal from '../components/Reveal';

const PROBLEMS = [
  {
    icon: Clock,
    title: 'Days lost to manual matching',
    desc: 'Ledger and bank records never agree out of the box. Finance teams spend days reconciling thousands of rows manually, every month.',
    color: 'var(--l-violet)',
  },
  {
    icon: TrendingUp,
    title: 'Cost spikes found weeks late',
    desc: 'Budget overruns are discovered long after the damage is done — when the cloud bill arrives, not when the spike happens.',
    color: 'var(--l-amber)',
  },
  {
    icon: Shuffle,
    title: '"AWS" vs "Amazon Web Services"',
    desc: 'Vendor names in ledgers rarely match bank statements. Simple string matching fails; everything ends up in exceptions.',
    color: 'var(--l-blue)',
  },
  {
    icon: Eye,
    title: 'Black-box tools you can\'t audit',
    desc: 'Most anomaly tools give you a flag with no reason. No proof of why something was flagged. No audit trail. No trust.',
    color: 'var(--l-emerald)',
  },
];

export default function ProblemsStrip() {
  return (
    <section aria-labelledby="problems-heading" className="problems-section">
      <div className="section-inner">
        <Reveal variant="pop">
          <div className="section-eyebrow">
            <span>Why teams switch to CostIntel</span>
          </div>
          <h2 id="problems-heading" className="section-h2">
            Four problems every finance team faces
          </h2>
        </Reveal>

        <div className="problems-grid">
          {PROBLEMS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} variant="pop" delay={i * 80}>
                <div className="problem-card">
                  <div className="problem-icon-wrap" style={{ '--p-color': p.color }}>
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <h3 className="problem-title">{p.title}</h3>
                  <p className="problem-desc">{p.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

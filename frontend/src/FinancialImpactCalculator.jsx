import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, TrendingUp, Shield } from 'lucide-react';

const fmtINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FinancialImpactCalculator = () => {
  const [investment, setInvestment] = useState(100000);
  const [monthlySavings, setMonthlySavings] = useState(15000);
  const [implementationTime, setImplementationTime] = useState(3); // in months

  const calculateImpact = () => {
    const inv = Math.max(0, Number(investment) || 0);
    const sav = Math.max(0, Number(monthlySavings) || 0);
    const annualSavings = sav * 12;
    const roi = inv > 0 ? ((annualSavings - inv) / inv) * 100 : (annualSavings > 0 ? 100 : 0);
    const paybackPeriod = sav > 0 ? (inv / sav) : 0;
    return {
      annualSavings,
      roi: Number.isFinite(roi) ? roi : 0,
      paybackPeriod: Number.isFinite(paybackPeriod) ? paybackPeriod : 0,
    };
  };

  const impact = calculateImpact();

  const chartData = [
    { name: 'Investment', value: -investment },
    { name: 'Annual Savings', value: impact.annualSavings },
  ];

  return (
    <div className="card">
      <h3 className="card-title">Financial Impact Calculator</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div>
          <div className="form-group">
            <label className="form-label">Initial Investment (₹)</label>
            <input
              type="number"
              className="form-input"
              value={investment}
              onChange={(e) => setInvestment(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Projected Monthly Savings (₹)</label>
            <input
              type="number"
              className="form-input"
              value={monthlySavings}
              onChange={(e) => setMonthlySavings(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Implementation Time (Months)</label>
            <input
              type="number"
              className="form-input"
              value={implementationTime}
              onChange={(e) => setImplementationTime(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--success)' }}>
              <div className="kpi-label">Annual Savings</div>
              <div className="kpi-value font-mono tabular-nums" style={{ color: 'var(--success)' }}>{fmtINR(impact.annualSavings)}</div>
            </div>
            <div className="kpi-card-minimal" style={{ '--kpi-accent': 'var(--primary)' }}>
              <div className="kpi-label">ROI</div>
              <div className="kpi-value font-mono tabular-nums" style={{ color: 'var(--primary)' }}>{impact.roi.toFixed(1)}%</div>
            </div>
            <div className="kpi-card-minimal">
              <div className="kpi-label">Payback Period</div>
              <div className="kpi-value font-mono tabular-nums">{impact.paybackPeriod.toFixed(1)} <span style={{ fontSize: '0.85rem' }}>mos</span></div>
            </div>
          </div>
          <div style={{ height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} tickFormatter={(v) => `₹${Math.abs(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={115} stroke="var(--text-secondary)" fontSize={12} tick={{ fill: 'var(--text-primary)', fontWeight: 600 }} />
                <Tooltip formatter={(value) => [fmtINR(Math.abs(value)), value > 0 ? 'Savings' : 'Investment']} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value > 0 ? 'var(--success)' : 'var(--danger)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialImpactCalculator;

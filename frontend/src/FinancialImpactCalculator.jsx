import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, TrendingUp, Shield } from 'lucide-react';

const FinancialImpactCalculator = () => {
  const [investment, setInvestment] = useState(100000);
  const [monthlySavings, setMonthlySavings] = useState(15000);
  const [implementationTime, setImplementationTime] = useState(3); // in months

  const calculateImpact = () => {
    const annualSavings = monthlySavings * 12;
    const roi = ((annualSavings - investment) / investment) * 100;
    const paybackPeriod = investment / monthlySavings; // in months
    return {
      annualSavings,
      roi,
      paybackPeriod,
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
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
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="card-title">Annual Savings</div>
              <div className="metric" style={{ color: 'var(--success)' }}>₹{impact.annualSavings.toLocaleString()}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="card-title">ROI</div>
              <div className="metric" style={{ color: 'var(--primary)' }}>{impact.roi.toFixed(1)}%</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="card-title">Payback Period</div>
              <div className="metric">{impact.paybackPeriod.toFixed(1)} months</div>
            </div>
          </div>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Bar dataKey="value">
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

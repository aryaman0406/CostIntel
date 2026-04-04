import React from 'react';
import { Upload } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const EmptyState = ({ title, desc, onActionClick }) => (
    <div className="card empty-state">
      <Upload size={48} className="empty-state-icon" />
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{desc}</p>
      <button className="btn btn-primary" onClick={onActionClick}>Upload / Enter Data</button>
    </div>
  );

const SimulatorTab = ({ hasData, runSim, simLoading, simulation, setActiveTab }) => {
  if (!hasData) {
    return <EmptyState 
      title="No Data to Simulate" 
      desc="The What-If Simulator needs your cost data. Import data first."
      onActionClick={() => setActiveTab('data-entry')} 
    />;
  }

  return (
    <div className="fade-in">
      <div className="card">
        <h3 className="section-heading">What-If Cost Simulator</h3>
        <p className="card-subtitle">Test optimization strategies calculated from your actual data.</p>
        <div className="button-group">
          <button className="btn btn-secondary" onClick={() => runSim('conservative')} disabled={simLoading}>Conservative</button>
          <button className="btn btn-primary" onClick={() => runSim('balanced')} disabled={simLoading}>Balanced</button>
          <button className="btn btn-danger" onClick={() => runSim('aggressive')} disabled={simLoading}>Aggressive</button>
        </div>
        {simLoading && <p className="loading-text">Running...</p>}
        {simulation && (
          <div className="simulation-results">
            <div className="dashboard-grid">
              <div className="card metric-display"><div className="card-title">Strategy</div><div className="metric capitalize">{simulation.strategy}</div></div>
              <div className="card metric-display"><div className="card-title">Current</div><div className="metric">₹{simulation.current_run_rate?.toLocaleString()}</div></div>
              <div className="card metric-display"><div className="card-title">Savings</div><div className="metric text-success">₹{simulation.projected_monthly_savings?.toLocaleString()}/mo</div></div>
              <div className="card metric-display"><div className="card-title">New Total</div><div className="metric text-primary">₹{simulation.projected_new_total?.toLocaleString()}/mo</div></div>
            </div>
            <div className="info-banners">
              <div className={`alert-banner ${simulation.risk_level === 'High' ? 'danger' : simulation.risk_level === 'Medium' ? 'warning' : 'success'}`}>Risk: <strong>{simulation.risk_level}</strong></div>
              <div className="alert-banner info">ROI: <strong>{simulation.roi_timeline}</strong></div>
              <div className="alert-banner info">Confidence: <strong>{simulation.confidence_score ?? 0}% ({simulation.confidence_band || 'N/A'})</strong></div>
            </div>
            <div className="dashboard-grid" style={{ marginTop: '0.75rem' }}>
              <div className="card metric-display"><div className="card-title">Implementation Cost</div><div className="metric">₹{simulation.one_time_implementation_cost?.toLocaleString?.() ?? 0}</div></div>
              <div className="card metric-display"><div className="card-title">Annual Net Impact</div><div className="metric text-success">₹{simulation.annual_net_impact?.toLocaleString?.() ?? 0}</div></div>
            </div>

            {Array.isArray(simulation.category_breakdown) && simulation.category_breakdown.length > 0 && (
              <div className="card table-card" style={{ marginTop: '0.75rem' }}>
                <h3 className="card-title">Category Breakdown</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Current</th>
                      <th>Reduction</th>
                      <th>Savings</th>
                      <th>Projected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulation.category_breakdown.map((row) => (
                      <tr key={row.category}>
                        <td className="font-semibold">{row.category}</td>
                        <td>₹{Number(row.current || 0).toLocaleString()}</td>
                        <td>{row.reduction_pct}%</td>
                        <td className="text-success">₹{Number(row.projected_savings || 0).toLocaleString()}</td>
                        <td>₹{Number(row.projected_new_total || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {Array.isArray(simulation.assumptions) && simulation.assumptions.length > 0 && (
              <div className="card" style={{ marginTop: '0.75rem' }}>
                <h3 className="card-title">Assumptions</h3>
                {simulation.assumptions.map((text, idx) => (
                  <div key={idx} className="alert-banner info" style={{ marginBottom: '0.5rem' }}>
                    {text}
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <h3 className="card-title">Before vs After</h3>
              <div className="chart-container" style={{ marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: 'Current', value: simulation.current_run_rate }, { name: `After (${simulation.strategy})`, value: simulation.projected_new_total }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      <Cell fill="var(--text-secondary)" />
                      <Cell fill="var(--success)" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulatorTab;
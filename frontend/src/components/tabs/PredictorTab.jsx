import React from 'react';
import { TrendingUp, Upload } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const EmptyState = ({ title, desc, onActionClick }) => (
    <div className="card empty-state">
      <Upload size={48} className="empty-state-icon" />
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{desc}</p>
      <button className="btn btn-primary" onClick={onActionClick}>Upload / Enter Data</button>
    </div>
  );

const PredictorTab = ({ hasData, predictions, setActiveTab }) => {
  if (!hasData) {
    return <EmptyState 
      title="No Cloud Data" 
      desc="The predictor needs cloud cost data to forecast future spending. Import data first."
      onActionClick={() => setActiveTab('data-entry')} 
    />;
  }

  return (
    <div className="fade-in">
      <div className="card-header-icon">
        <TrendingUp size={22} />
        <h2 className="section-heading">Future Cost Explosion Predictor</h2>
      </div>
      
      {predictions?.length > 0 ? (
        <>
          <div className="alert-banner danger">{predictions.length} resource(s) with explosive growth!</div>
          
          <div className="card table-card">
            <h3 className="card-title">Projected Growth (6 Months)</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={predictions.map(p => ({ name: p.resource, current: p.current_cost, projected: p.projected_cost_6m }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="current" fill="var(--accent)" name="Current" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="projected" fill="var(--danger)" name="6mo Projected" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {predictions.map((p, i) => (
            <div key={i} className={`card anomaly-card ${p.severity === 'Critical' ? 'critical' : 'warning'}`}>
              <div className="prediction-content">
                <div>
                  <h4 className="anomaly-title">{p.resource}</h4>
                  <p className="anomaly-cause">{p.warning}</p>
                </div>
                <div className="prediction-amount">
                  <div className="amount-label-sm">Now: ₹{p.current_cost?.toLocaleString()}</div>
                  <div className="amount-value-lg text-danger">+6m: ₹{p.projected_cost_6m?.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="card"><p className="empty-text">No explosive growth detected. Costs are stable.</p></div>
      )}
    </div>
  );
};

export default PredictorTab;
import React from 'react';
import { Zap, CheckCircle, Upload } from 'lucide-react';

const EmptyState = ({ title, desc, onActionClick }) => (
    <div className="card empty-state">
      <Upload size={48} className="empty-state-icon" />
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{desc}</p>
      <button className="btn btn-primary" onClick={onActionClick}>Upload / Enter Data</button>
    </div>
  );

const SpendAutoFixerTab = ({ hasData, analysis, recommendations, executedActions, execAction, setActiveTab }) => {
  if (!hasData) {
    return <EmptyState 
      title="No Data to Fix" 
      desc="The Autonomous Cost Fixer needs your enterprise data. Import data, then run Monitoring to generate actionable recommendations."
      onActionClick={() => setActiveTab('data-entry')} 
    />;
  }

  const recs = recommendations?.recommendations || [];
  const totalSavings = Object.values(executedActions).reduce((s, a) => s + (a.savings || 0), 0);

  return (
    <div className="fade-in">
      <div className="card card-shiny">
        <div className="card-header-icon">
          <Zap size={22} className="text-primary" />
          <h3 className="section-heading">Autonomous Cost Fixer</h3>
        </div>
        <p className="card-subtitle">AI executes cost-saving actions with quantifiable financial impact.</p>

        {analysis && (analysis.inefficiencies?.length > 0 || analysis.duplicates?.length > 0 || analysis.unused_subscriptions?.length > 0) && (
          <div className="analysis-section">
            <h4 className="sub-heading">Spend Analysis</h4>
            {analysis.inefficiencies?.map((x, i) => <div key={i} className="alert-banner warning">{x}</div>)}
            {analysis.duplicates?.map((x, i) => <div key={i} className="alert-banner danger">{x}</div>)}
            {analysis.unused_subscriptions?.map((x, i) => <div key={i} className="alert-banner warning">{x}</div>)}
          </div>
        )}

        <div className="actions-section">
          <h4 className="sub-heading">Corrective Actions</h4>
          {recs.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Service</th>
                    <th>Monthly Savings</th>
                    <th>Annual Savings</th>
                    <th>Priority</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recs.map((r, i) => {
                    const id = r.id || `R_${i}`;
                    const done = !!executedActions[id];
                    return (
                      <tr key={i} className={done ? 'action-executed' : ''}>
                        <td className="font-medium">{r.description}</td>
                        <td className="font-semibold">{r.service}</td>
                        <td className="font-bold text-success">₹{(r.monthly_savings || 0).toLocaleString()}</td>
                        <td className="font-bold text-success">₹{(r.annual_savings || 0).toLocaleString()}</td>
                        <td><span className={`status-badge ${r.severity === 'HIGH' ? 'status-alert' : 'status-warning'}`}>{r.severity}</span></td>
                        <td>
                          {done ? (
                            <span className="status-badge status-active"><CheckCircle size={14} /> Fixed</span>
                          ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => execAction(id, r.issue_type, r.service, r.monthly_savings)}>
                              Auto-Fix
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-text">No recommendations yet. Run <strong>Monitoring</strong> first.</p>
          )}
        </div>

        {Object.keys(executedActions).length > 0 && (
          <div className="alert-banner success summary-banner">
            <CheckCircle size={16} /> {Object.keys(executedActions).length} action(s) executed. Total Savings: ₹{totalSavings.toLocaleString()}/mo
          </div>
        )}
      </div>
    </div>
  );
};

export default SpendAutoFixerTab;
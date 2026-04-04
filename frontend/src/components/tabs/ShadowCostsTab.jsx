import React from 'react';
import { Eye, Upload } from 'lucide-react';

const EmptyState = ({ title, desc, onActionClick }) => (
    <div className="card empty-state">
      <Upload size={48} className="empty-state-icon" />
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{desc}</p>
      <button className="btn btn-primary" onClick={onActionClick}>Upload / Enter Data</button>
    </div>
  );

const ShadowCostsTab = ({ hasData, shadowCosts, setActiveTab }) => {
  if (!hasData) {
    return <EmptyState 
      title="No Employee Data" 
      desc="Shadow Cost detection requires employee expense data. Import data first."
      onActionClick={() => setActiveTab('data-entry')} 
    />;
  }

  return (
    <div className="fade-in">
      <div className="card-header-icon">
        <Eye size={22} />
        <h2 className="section-heading">Shadow Cost Detector</h2>
      </div>
      <p className="card-subtitle">AI detects duplicate tools, unused subscriptions, and unauthorized licenses.</p>
      
      {shadowCosts?.length > 0 ? (
        shadowCosts.map((t, i) => (
          <div key={i} className="card shadow-cost-card">
            <div className="shadow-cost-content">
              <div>
                <h4 className="shadow-cost-title">{t.merchant}</h4>
                <p className="shadow-cost-insight">{t.occurrences} employees — {t.insight}</p>
              </div>
              <div className="shadow-cost-amount">
                <div className="amount-value">₹{t.total_monthly_spend?.toLocaleString()}</div>
                <div className="amount-label">/month lost</div>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="card"><p className="empty-text">No shadow IT detected.</p></div>
      )}
    </div>
  );
};

export default ShadowCostsTab;
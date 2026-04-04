import React from 'react';
import { Upload } from 'lucide-react';

const EmptyState = ({ title, desc, onActionClick }) => (
    <div className="card empty-state">
      <Upload size={48} className="empty-state-icon" />
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{desc}</p>
      <button className="btn btn-primary" onClick={onActionClick}>Upload / Enter Data</button>
    </div>
  );

const AnomaliesTab = ({ hasData, anomalies, setActiveTab }) => {
  if (!hasData) {
    return <EmptyState 
      title="No Data to Analyze" 
      desc="Anomaly detection requires your expense data. Import data first."
      onActionClick={() => setActiveTab('data-entry')} 
    />;
  }

  return (
    <div className="fade-in">
      <h2 className="section-heading">Detected Anomalies</h2>
      {anomalies?.length > 0 ? (
        anomalies.map((a, i) => (
          <div key={i} className={`card anomaly-card ${a.severity === 'Critical' ? 'critical' : 'warning'}`}>
            <div className="anomaly-content">
              <div>
                <h4 className="anomaly-title">{a.message}</h4>
                <p className="anomaly-cause">Root Cause: {a.root_cause}</p>
              </div>
              <span className={`status-badge ${a.severity === 'Critical' ? 'status-alert' : 'status-warning'}`}>{a.severity}</span>
            </div>
          </div>
        ))
      ) : (
        <div className="card"><p className="empty-text">No anomalies detected.</p></div>
      )}
    </div>
  );
};

export default AnomaliesTab;
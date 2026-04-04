import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Upload } from 'lucide-react';

const MetricCard = ({ title, value, change, positive = true }) => (
  <div className="card card-3d">
    <div className="card-title">{title}</div>
    <div className="metric">{value}</div>
    {change && <div className={`metric-change ${positive ? 'positive' : 'negative'}`}>{change}</div>}
  </div>
);

const EmptyState = ({ title, desc, onActionClick }) => (
  <div className="card empty-state">
    <Upload size={48} className="empty-state-icon" />
    <h3 className="empty-state-title">{title}</h3>
    <p className="empty-state-description">{desc}</p>
    <button className="btn btn-primary" onClick={onActionClick}>Upload / Enter Data</button>
  </div>
);

const DashboardTab = ({ data, setActiveTab }) => {
  if (!data?.has_data) {
    return <EmptyState 
      title="No Data Yet" 
      desc="Your dashboard will show real-time analytics once you upload or enter your enterprise cost data. Start by importing your expenses."
      onActionClick={() => setActiveTab('data-entry')} 
    />;
  }

  const totalSpend = data.total_cloud + data.total_saas + data.total_ops;
  const budgetUtilization = ((totalSpend / (data.monthly_budget || 1)) * 100).toFixed(1);

  return (
    <div className="fade-in">
      <div className="dashboard-grid">
        <MetricCard 
          title="Monthly Budget" 
          value={`₹${data.monthly_budget?.toLocaleString()}`} 
          change={`${budgetUtilization}% utilized`}
          positive={totalSpend <= data.monthly_budget}
        />
        <MetricCard 
          title="Total Spend" 
          value={`₹${totalSpend?.toLocaleString()}`} 
          change={`${data.historical_spend?.length || 0} months of data`}
        />
        <MetricCard 
          title="Cloud Costs" 
          value={`₹${data.total_cloud?.toLocaleString()}`} 
          change={`${data.cloud_costs?.length || 0} services`}
        />
        <MetricCard 
          title="SaaS Spend" 
          value={`₹${data.total_saas?.toLocaleString()}`} 
          change={`${data.saas_subscriptions?.length || 0} subscriptions`}
        />
      </div>
      <div className="charts-grid">
        <div className="card card-3d">
          <h3 className="card-title">Spend Trend</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.historical_spend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--primary)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card card-3d">
          <h3 className="card-title">Cost Breakdown</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'Cloud', cost: data.total_cloud }, { name: 'SaaS', cost: data.total_saas }, { name: 'Ops', cost: data.total_ops }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="cost" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {data.cloud_costs?.length > 0 && (
        <div className="card card-3d table-card">
          <h3 className="card-title">Cloud Services</h3>
          <table className="table">
            <thead><tr><th>Service</th><th>Cost</th><th>Utilization</th><th>Trend</th><th>Status</th></tr></thead>
            <tbody>{data.cloud_costs.map((s, i) => (
              <tr key={i}>
                <td className="font-semibold">{s.service}</td>
                <td>₹{s.cost.toLocaleString()}</td>
                <td>{s.utilization}</td>
                <td className={parseInt(s.trend) > 10 ? 'text-danger' : 'text-success'}>{s.trend}</td>
                <td><span className="status-badge status-active">{s.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      
      {data.saas_subscriptions?.length > 0 && (
        <div className="card card-3d table-card">
          <h3 className="card-title">SaaS Subscriptions</h3>
          <table className="table">
            <thead><tr><th>Name</th><th>Cost/mo</th><th>Licensed</th><th>Active</th><th>Utilization</th></tr></thead>
            <tbody>{data.saas_subscriptions.map((s, i) => {
              const u = s.users > 0 ? ((s.active_users / s.users) * 100).toFixed(0) : 0;
              return (
                <tr key={i}>
                  <td className="font-semibold">{s.name}</td>
                  <td>₹{s.cost.toLocaleString()}</td>
                  <td>{s.users}</td>
                  <td>{s.active_users}</td>
                  <td><span className={`status-badge ${parseInt(u) < 50 ? 'status-alert' : 'status-active'}`}>{u}%</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DashboardTab;
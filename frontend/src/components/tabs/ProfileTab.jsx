import React from 'react';
import axios from 'axios';
import { User, Activity, FileText } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const ProfileCard = ({ profile, profilePic, onProfilePicChange }) => (
  <div className="card card-3d">
    <h3 className="card-title"><User size={18} /> Account Details</h3>
    <div className="profile-details">
      <div className="profile-pic-container" onClick={() => document.getElementById('profilePicInput').click()}>
        {profilePic ? (
          <img src={profilePic} alt="Profile" className="profile-pic" />
        ) : (
          <div className="profile-pic-placeholder"><User size={40} /></div>
        )}
        <div className="profile-pic-edit-overlay">EDIT</div>
        <input type="file" id="profilePicInput" accept="image/*" style={{ display: 'none' }} onChange={onProfilePicChange} />
      </div>
      <div className="profile-info">
        <div className="info-row"><span>Email</span><strong>{profile?.email}</strong></div>
        <div className="info-row"><span>Member Since</span><strong>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</strong></div>
        <div className="info-row"><span>Monthly Budget</span><strong>₹{(profile?.monthly_budget || 0).toLocaleString()}</strong></div>
      </div>
    </div>
  </div>
);

const ActivityCard = ({ profile }) => (
  <div className="card card-3d">
    <h3 className="card-title"><Activity size={18} /> Lifetime Activity</h3>
    <div className="activity-metrics">
      <div className="metric-item">
        <div className="metric-value primary">{profile?.expense_count || 0}</div>
        <div className="metric-label">Total Logs</div>
      </div>
      <div className="metric-item">
        <div className="metric-value">₹{(profile?.total_spent || 0).toLocaleString()}</div>
        <div className="metric-label">Lifetime Spend</div>
      </div>
    </div>
  </div>
);

const ExpenseHistory = ({ expenses, onActionClick, onExport }) => (
  <div className="card card-3d">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
      <h3 className="card-title"><FileText size={18} /> Uploaded Expense History</h3>
      <button className="btn btn-secondary btn-sm" onClick={onExport}>Export PDF</button>
    </div>
    {expenses?.length > 0 ? (
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Vendor</th>
              <th>Category</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td className="font-semibold">{e.vendor}</td>
                <td><span className="status-badge">{e.category || '—'}</span></td>
                <td className="font-bold text-right">₹{e.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="empty-table-state">
        <p>No expenses yet. Go to <strong onClick={onActionClick}>Import</strong> to add data.</p>
      </div>
    )}
  </div>
);

const UsersTable = ({ users }) => (
  <div className="card card-3d" style={{ marginTop: '1rem' }}>
    <h3 className="card-title"><User size={18} /> Users (Admin View)</h3>
    {users?.length > 0 ? (
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th className="text-right">Budget</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.full_name || '—'}</td>
                <td>{u.email || '—'}</td>
                <td><span className="status-badge status-info">{u.role || '—'}</span></td>
                <td>
                  <span className={`status-badge ${u.status === 'active' ? 'status-active' : 'status-warning'}`}>
                    {u.status || 'unknown'}
                  </span>
                </td>
                <td className="text-right">₹{(u.monthly_budget || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="empty-table-state">
        <p>No users available.</p>
      </div>
    )}
  </div>
);

const ProfileTab = ({ profile, expensesSummary, profilePic, handleProfilePicChange, setActiveTab, adminUsers, token }) => {
  const handleExportPdf = async () => {
    try {
      const res = await axios.get(`${API_BASE}/report/generate`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'CFO_Cost_Report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export report PDF.');
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="profile-grid">
        <ProfileCard profile={profile} profilePic={profilePic} onProfilePicChange={handleProfilePicChange} />
        <ActivityCard profile={profile} />
      </div>
      <ExpenseHistory expenses={expensesSummary?.expenses} onActionClick={() => setActiveTab('data-entry')} onExport={handleExportPdf} />
      {profile?.role === 'Admin' && <UsersTable users={adminUsers} />}
    </div>
  );
};

export default ProfileTab;
import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, Send, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const DataEntry = ({ token, onExpenseAdded, setActiveTab }) => {
  const [file, setFile] = useState(null);
  const [manual, setManual] = useState({ amount: '', vendor: '', date: '', category: '' });
  const [budget, setBudget] = useState('');
  const [message, setMessage] = useState({ type: '', content: '' });

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    if (message.content) setMessage({ type: '', content: '' });
  };

  const handleManualChange = (e) => {
    setManual({ ...manual, [e.target.name]: e.target.value });
    if (message.content) setMessage({ type: '', content: '' });
  };

  const handleBudgetChange = (e) => {
    setBudget(e.target.value);
    if (message.content) setMessage({ type: '', content: '' });
  };

  const handleFileUpload = async () => {
    if (!file) {
      setMessage({ type: 'error', content: 'Please select a CSV file to upload.' });
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      console.log('Uploading file...', file.name);
      const res = await axios.post(`${API_BASE}/upload-csv`, formData, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      console.log('Upload response:', res.data);
      setMessage({ type: 'success', content: res.data.message });
      await onExpenseAdded(); // Trigger data refresh
      if (setActiveTab) setActiveTab('dashboard');
    } catch (err) {
      console.error('Upload error:', err.response || err);
      setMessage({ type: 'error', content: err.response?.data?.message || 'File upload failed.' });
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manual.amount || !manual.vendor || !manual.date) {
      setMessage({ type: 'error', content: 'Please fill all required fields for the expense.' });
      return;
    }
    try {
      console.log('Adding manual expense...', manual);
      const res = await axios.post(`${API_BASE}/add-expense`, manual, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Manual expense response:', res.data);
      setMessage({ type: 'success', content: res.data.message });
      setManual({ amount: '', vendor: '', date: '', category: '' });
      await onExpenseAdded(); // Trigger data refresh
      if (setActiveTab) setActiveTab('dashboard');
    } catch (err) {
      console.error('Manual expense error:', err.response || err);
      setMessage({ type: 'error', content: err.response?.data?.message || 'Failed to add expense.' });
    }
  };

  const handleBudgetSubmit = async (e) => {
    e.preventDefault();
    if (!budget || isNaN(parseFloat(budget)) || parseFloat(budget) < 0) {
      setMessage({ type: 'error', content: 'Please enter a valid, non-negative number for your budget.' });
      return;
    }
    console.log('Setting budget...', budget);
    try {
      const res = await axios.post(`${API_BASE}/budget`, { budget: parseFloat(budget) }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Budget response:', res.data);
      setMessage({ type: 'success', content: res.data.message });
      setBudget('');
      onExpenseAdded(); // Refresh profile data to show new budget
    } catch (err) {
      console.error('Budget error:', err.response || err);
      setMessage({ type: 'error', content: err.response?.data?.message || 'Failed to set budget.' });
    }
  };
  return (
    <div className="data-entry-container" style={{ maxWidth: '1100px', margin: '0 auto' }}>

      <div className="card card-shiny card-3d" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Import & Budget</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Add expenses via CSV or manual entry, and set your monthly budget to unlock dashboard insights.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        
        {/* Set Monthly Budget */}
        <div className="card card-3d" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}><DollarSign size={22} color="var(--primary)" /> Set Monthly Budget</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', flexGrow: 1 }}>Define your total spending limit for the month to better track your financial goals.</p>
          <form onSubmit={handleBudgetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>₹</span>
              <input
                type="number"
                name="monthly_budget"
                placeholder="e.g., 50000"
                value={budget}
                onChange={handleBudgetChange}
                className="form-input"
                min="0"
                step="100"
                inputMode="numeric"
                style={{ paddingLeft: '2rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}><Send size={16} /> Update Budget</button>
          </form>
        </div>

        {/* Upload CSV */}
        <div className="card card-3d" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}><Upload size={22} color="var(--primary)" /> Upload Expense CSV</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', flexGrow: 1 }}>
            Import multiple expenses at once. Required columns: <strong>Date</strong>, <strong>Vendor</strong>, <strong>Amount</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="file" accept=".csv" onChange={handleFileChange} className="form-input" style={{ padding: '0.55rem 0.75rem' }} />
            <button onClick={handleFileUpload} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}><Upload size={16} /> Process Upload</button>
          </div>
        </div>

        {/* Manual Entry */}
        <div className="card card-3d" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}><FileText size={22} color="var(--primary)" /> Add Single Expense</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Quickly log a one-off expense into your dashboard.</p>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>₹</span>
                <input type="number" name="amount" placeholder="Amount" value={manual.amount} onChange={handleManualChange} required className="form-input" style={{ paddingLeft: '1.75rem' }} />
              </div>
              <input type="text" name="vendor" placeholder="Vendor" value={manual.vendor} onChange={handleManualChange} required className="form-input" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input type="date" name="date" value={manual.date} onChange={handleManualChange} required className="form-input" />
              <input type="text" name="category" placeholder="Category" value={manual.category} onChange={handleManualChange} className="form-input" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}><Send size={16} /> Add Expense</button>
          </form>
        </div>

      </div>

      {message.content && (
        <div className={`alert-banner ${message.type === 'success' ? 'success' : 'danger'}`} style={{ marginTop: '1.25rem' }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.content}</span>
        </div>
      )}
    </div>
  );
};

export default DataEntry;

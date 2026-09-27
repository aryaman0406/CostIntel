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
    if (!file.name.toLowerCase().endsWith('.csv') && file.type && !file.type.includes('csv') && !file.type.includes('text')) {
      setMessage({ type: 'error', content: 'Unsupported file format. Please choose a .csv file (e.g. expenses.csv).' });
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_BASE}/upload-csv`, formData, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setMessage({ type: 'success', content: res.data.message });
      await onExpenseAdded();
      if (setActiveTab) setActiveTab('dashboard');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'File upload failed. Please verify CSV format.';
      setMessage({ type: 'error', content: errMsg });
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(manual.amount);
    if (!manual.vendor || !manual.date) {
      setMessage({ type: 'error', content: 'Please fill all required fields for the expense.' });
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setMessage({ type: 'error', content: 'Please enter a valid positive expense amount (e.g. 500 or 1250.50).' });
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/add-expense`, manual, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMessage({ type: 'success', content: res.data.message });
      setManual({ amount: '', vendor: '', date: '', category: '' });
      await onExpenseAdded();
      if (setActiveTab) setActiveTab('dashboard');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to add expense.';
      setMessage({ type: 'error', content: errMsg });
    }
  };

  const handleBudgetSubmit = async (e) => {
    e.preventDefault();
    const numericBudget = parseFloat(budget);
    if (!budget || isNaN(numericBudget) || numericBudget < 0) {
      setMessage({ type: 'error', content: 'Please enter a valid, non-negative number for your budget.' });
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/budget`, { budget: numericBudget }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const displayMsg = (typeof res.data.message === 'string' && res.data.message.length > 5)
        ? res.data.message
        : `Monthly budget of ₹${numericBudget.toLocaleString()} updated successfully!`;
      setMessage({ type: 'success', content: displayMsg });
      setBudget('');
      onExpenseAdded();
    } catch (err) {
      console.error('Budget error:', err.response || err);
      setMessage({ type: 'error', content: err.response?.data?.message || 'Failed to set budget.' });
    }
  };

  return (
    <div className="data-entry-container">

      <div className="card card-3d" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '1.5rem' }}>
        <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', marginBottom: '0.5rem', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          Import &amp; Budget
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Add expenses via CSV or manual entry, and set your monthly budget to unlock dashboard insights.
        </p>
      </div>

      {/* Cards grid — auto-fit so 1 col on mobile, 2-3 on bigger screens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>

        {/* Set Monthly Budget */}
        <div className="card card-3d" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '1rem', flexWrap: 'wrap' }}>
            <DollarSign size={20} color="var(--primary)" />
            Set Monthly Budget
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', flexGrow: 1 }}>
            Define your total spending limit for the month to better track your financial goals.
          </p>
          <form onSubmit={handleBudgetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }}>₹</span>
              <input
                type="number"
                name="monthly_budget"
                placeholder="e.g., 50000"
                value={budget}
                onChange={handleBudgetChange}
                className="form-input font-mono tabular-nums"
                min="0"
                step="100"
                inputMode="numeric"
                style={{ paddingLeft: '2rem', width: '100%' }}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
              <Send size={15} /> Update Budget
            </button>
          </form>
        </div>

        {/* Upload CSV */}
        <div className="card card-3d" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '1rem', flexWrap: 'wrap' }}>
            <Upload size={20} color="var(--primary)" />
            Upload Expense CSV
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', flexGrow: 1 }}>
            Import multiple expenses at once. Required columns: <strong>Date</strong>, <strong>Vendor</strong>, <strong>Amount</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* File input — styled for mobile tap */}
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '1rem',
              border: `2px dashed var(--border-strong)`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              background: 'var(--surface-alt)',
              transition: 'border-color 0.2s, background 0.2s',
              minHeight: '80px',
              textAlign: 'center',
            }}>
              <Upload size={22} color="var(--primary)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {file ? file.name : 'Tap to choose CSV file'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                {file ? `${(file.size / 1024).toFixed(1)} KB` : '.csv format required'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
            <button
              onClick={handleFileUpload}
              className="btn btn-primary w-full"
              style={{ justifyContent: 'center' }}
              disabled={!file}
            >
              <Upload size={15} /> Process Upload
            </button>
          </div>
        </div>

        {/* Manual Entry */}
        <div className="card card-3d" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '1rem', flexWrap: 'wrap' }}>
            <FileText size={20} color="var(--primary)" />
            Add Single Expense
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Quickly log a one-off expense into your dashboard.
          </p>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Amount + Vendor row — responsive */}
            <div className="data-entry-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }}>₹</span>
                <input
                  type="number"
                  name="amount"
                  placeholder="Amount"
                  value={manual.amount}
                  onChange={handleManualChange}
                  required
                  className="form-input font-mono tabular-nums"
                  style={{ paddingLeft: '1.75rem', width: '100%' }}
                  inputMode="decimal"
                />
              </div>
              <input
                type="text"
                name="vendor"
                placeholder="Vendor name"
                value={manual.vendor}
                onChange={handleManualChange}
                required
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
            {/* Date + Category row — responsive */}
            <div className="data-entry-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              <input
                type="date"
                name="date"
                value={manual.date}
                onChange={handleManualChange}
                required
                className="form-input font-mono"
                style={{ width: '100%' }}
              />
              <input
                type="text"
                name="category"
                placeholder="Category (optional)"
                value={manual.category}
                onChange={handleManualChange}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
              <Send size={15} /> Add Expense
            </button>
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

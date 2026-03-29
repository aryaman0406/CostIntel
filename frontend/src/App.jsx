import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { LayoutDashboard, TrendingDown, AlertTriangle, Eye, TrendingUp, RefreshCw, Send, LogOut, FileText, MessageCircle, X, PlayCircle, Activity, Zap, CheckCircle, Home, Upload, Moon, Sun, DollarSign, User } from 'lucide-react';
import './index.css';
import Auth from './Auth';
import DataEntry from './DataEntry';

import FinancialImpactCalculator from './FinancialImpactCalculator';

const API_BASE = '/api';

function App() {
  const [data, setData] = useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [shadowCosts, setShadowCosts] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [profile, setProfile] = useState(null);
  const [expensesSummary, setExpensesSummary] = useState(null);
  const [monitoringStatus, setMonitoringStatus] = useState(null);
  const [monitoringRecommendations, setMonitoringRecommendations] = useState(null);
  const [monitoringHistory, setMonitoringHistory] = useState(null);
  const [executedActions, setExecutedActions] = useState({});
  const [activeTab, setActiveTab] = useState('features');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [authError, setAuthError] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [monRunning, setMonRunning] = useState(false);
  const [monError, setMonError] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [profilePic, setProfilePic] = useState(localStorage.getItem('profilePic') || null);
  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
        localStorage.setItem('profilePic', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  const navigate = useNavigate();

  // Chatbot
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', content: "Hello! I'm your AI CFO Assistant. Ask me about costs, budgets, or say 'Add 500 for Zoom' to log expenses." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEnd = useRef(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(today.toLocaleDateString('en-US', options));
  }, []);

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(p => [...p, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/chat`, { message: msg }, { headers: { 'Authorization': `Bearer ${token}` } });
      setChatHistory(p => [...p, { role: 'bot', content: res.data.data }]);
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem('access_token'); setToken(null); navigate('/login'); }
      setChatHistory(p => [...p, { role: 'bot', content: '❌ Unable to process. Try again.' }]);
    }
    setChatLoading(false);
  };

  useEffect(() => { if (token) { navigate('/features'); fetchAllData(); } }, [token]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleLogout = () => { localStorage.removeItem('access_token'); setToken(null); navigate('/login'); };

  const fetchAllData = async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    const h = { 'Authorization': `Bearer ${token}` };
    try {
      const results = await Promise.allSettled([
        axios.get(`${API_BASE}/dashboard`, { headers: h }),
        axios.get(`${API_BASE}/analysis`, { headers: h }),
        axios.get(`${API_BASE}/anomalies`, { headers: h }),
        axios.get(`${API_BASE}/shadow-costs`, { headers: h }),
        axios.get(`${API_BASE}/future-predictions`, { headers: h }),
        axios.get(`${API_BASE}/profile`, { headers: h }),
        axios.get(`${API_BASE}/expenses`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/status`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/recommendations`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/history`, { headers: h }),
      ]);

      const getData = (idx) => {
        const r = results[idx];
        return r.status === 'fulfilled' ? r.value?.data?.data : null;
      };
      const getErr = (idx) => (results[idx].status === 'rejected' ? results[idx].reason : null);

      const dash = getData(0);
      if (dash) {
        setData(dash);
      } else {
        const e = getErr(0);
        if (e?.response?.status === 401) {
          setAuthError('Session expired.');
          localStorage.removeItem('access_token');
          setToken(null);
          navigate('/login');
        } else {
          setAuthError(`Dashboard load failed: ${e?.response?.data?.message || e?.message || 'Unknown error'}`);
        }
      }

      const analysisData = getData(1); if (analysisData) setAnalysis(analysisData);
      const anomaliesData = getData(2); if (anomaliesData) setAnomalies(anomaliesData);
      const shadowData = getData(3); if (shadowData) setShadowCosts(shadowData);
      const predData = getData(4); if (predData) setPredictions(predData);
      const profData = getData(5); if (profData) setProfile(profData);
      const expData = getData(6); if (expData) setExpensesSummary(expData);
      const monStatus = getData(7); if (monStatus !== null) setMonitoringStatus(monStatus);
      const monRecs = getData(8); if (monRecs !== null) setMonitoringRecommendations(monRecs);
      const monHist = getData(9); if (monHist !== null) setMonitoringHistory(monHist);
    } catch (err) {
      if (err.response?.status === 401) { setAuthError('Session expired.'); localStorage.removeItem('access_token'); setToken(null); navigate('/login'); }
      else setAuthError(`Failed: ${err.message}`);
    }
    setLoading(false);
  };

  const runSim = async (s) => { setSimLoading(true); try { const r = await axios.post(`${API_BASE}/simulate`, { strategy: s }, { headers: { 'Authorization': `Bearer ${token}` } }); setSimulation(r.data.data); } catch(e){} setSimLoading(false); };

  const triggerMon = async () => {
    setMonRunning(true);
    setMonError('');
    const h = { 'Authorization': `Bearer ${token}` };
    try {
      await axios.post(`${API_BASE}/monitoring/run`, {}, { headers: h });
      const [a,b,c] = await Promise.all([axios.get(`${API_BASE}/monitoring/status`,{headers:h}),axios.get(`${API_BASE}/monitoring/recommendations`,{headers:h}),axios.get(`${API_BASE}/monitoring/history`,{headers:h})]);
      setMonitoringStatus(a.data.data); setMonitoringRecommendations(b.data.data); setMonitoringHistory(c.data.data);
    } catch(e){
      if (e.response?.status === 401) {
        setMonError('Session expired. Please sign in again.');
        localStorage.removeItem('access_token');
        setToken(null);
        navigate('/login');
      } else {
        const msg = e.response?.data?.message || e.message || 'Failed to run monitoring.';
        setMonError(msg);
      }
    }
    setMonRunning(false);
  };

  const handleDownloadReport = async () => {
    try {
      const res = await axios.get(`${API_BASE}/report/generate`, { headers: { 'Authorization': `Bearer ${token}` }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', 'CFO_Cost_Report.pdf');
      document.body.appendChild(link); link.click();
    } catch(e) { alert('Failed to generate report'); }
  };

  const execAction = async (id, type, svc, sav) => {
    try { const r = await axios.post(`${API_BASE}/actions/execute`, { action_id: id, action_type: type, service: svc, savings: sav }, { headers: { 'Authorization': `Bearer ${token}` } }); setExecutedActions(p => ({ ...p, [id]: r.data.data })); } catch(e){ alert('Failed'); }
  };

  if (!token) return <Routes><Route path="/login" element={<Auth setAuthParams={setToken} />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:'1rem' }}><RefreshCw size={40} color="var(--primary)" style={{ animation:'spin 2s linear infinite' }} /><p style={{ color:'var(--text-secondary)' }}>Loading CostIntel AI...</p></div>;

  const hasData = data?.has_data === true;
  const recs = monitoringRecommendations?.recommendations || [];
  const totalSpend = data ? (data.total_cloud + data.total_saas + data.total_ops) : 0;

  // Empty state component
  const EmptyState = ({ title, desc }) => (
    <div className="card" style={{ textAlign:'center', padding:'3rem 2rem' }}>
      <Upload size={48} color="var(--text-muted)" style={{ marginBottom:'1rem' }} />
      <h3 style={{ fontWeight:700, marginBottom:'0.5rem' }}>{title}</h3>
      <p style={{ color:'var(--text-secondary)', fontSize:'0.9rem', marginBottom:'1.5rem', maxWidth:'500px', margin:'0 auto 1.5rem' }}>{desc}</p>
      <button className="btn btn-primary" onClick={() => setActiveTab('data-entry')}>Upload / Enter Data</button>
    </div>
  );

  const dashboardUI = (
    <div style={{ minHeight:'100vh', background:'var(--background)' }} data-theme={theme}>
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="logo" style={{ fontSize:'1.1rem', whiteSpace:'nowrap' }}>CostIntel AI</h1>
            <nav className="nav-tabs" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {[
                ['features', TrendingUp, 'Features'],
                ['dashboard', LayoutDashboard, 'Dashboard'],
                ['data-entry', FileText, 'Import'],
                ['profile', LayoutDashboard, 'Profile'],
                ['monitoring', Activity, 'Monitoring'],
                ['spend', Zap, 'Auto Fixer'],
                ['anomalies', AlertTriangle, 'Anomalies'],
                ['shadow', Eye, 'Shadow Costs'],
                ['predictor', TrendingUp, 'Predictor'],
                ['simulator', PlayCircle, 'Simulator'],
                ['impact', DollarSign, 'Impact Calculator'],
              ].map(([key, Icon, label]) => (
                <button key={key} className={`nav-tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="header-right">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginRight: '1rem' }}>{currentDate}</span>
            <button className="btn-refresh" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button className="btn btn-primary" onClick={handleDownloadReport} style={{ padding:'0.4rem 1rem', fontSize:'0.85rem' }}><FileText size={14} /> PDF Report</button>
            <button className="btn-refresh" onClick={fetchAllData}><RefreshCw size={14} /> Refresh</button>
            <button className="btn-refresh" onClick={handleLogout} style={{ color:'var(--danger)', borderColor:'#FCA5A5' }}><LogOut size={14} /> Logout</button>
          </div>
        </div>
      </header>

      <div className="main-container"><div className="content-area"><div className="dashboard-section">

        {/* ═══ FEATURES & DEMO PAGE ═══ */}
        {activeTab === 'features' && (
          <div className="fade-in" style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem 0' }}>
            <div className="card-shiny card-3d" style={{ padding: '3rem', borderRadius: '24px', textAlign: 'center', marginBottom: '3rem' }}>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-1px' }}>Welcome to CostIntel AI</h1>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', maxWidth: '600px', margin: '0 auto' }}>
                Your autonomous digital CFO. We monitor, analyze, and optimize your enterprise costs so you don't have to.
              </p>
              <button className="btn btn-primary btn-3d" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '12px' }} onClick={() => setActiveTab('dashboard')}>
                Enter Dashboard <TrendingUp size={20} style={{ marginLeft: '0.5rem' }} />
              </button>
            </div>

            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem', textAlign: 'center' }}>Explore Capabilities</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              <div className="card card-3d feature-card" style={{ padding: '1.25rem' }}>
                <img src="/dashboard_preview_1774761879313.png" alt="Dashboard" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px', marginBottom: '1rem' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}><Activity size={24} color="var(--primary)" /><h3 style={{ fontWeight: 700 }}>Intelligent Dashboard</h3></div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Get a real-time, comprehensive overview of your total cloud and SaaS expenditure with advanced data visualizations.</p>
              </div>
              
              <div className="card card-3d feature-card" style={{ padding: '1.25rem' }}>
                <img src="/auto_fixer_preview_1774761893718.png" alt="Auto Fixer" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px', marginBottom: '1rem' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}><Zap size={24} color="var(--primary)" /><h3 style={{ fontWeight: 700 }}>Autonomous Cost Fixer</h3></div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Execute one-click corrective actions to immediately resolve discovered cost inefficiencies.</p>
              </div>

              <div className="card card-3d feature-card" style={{ padding: '1.25rem' }}>
                <img src="/anomalies_preview_1774761909884.png" alt="Anomalies" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px', marginBottom: '1rem' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}><AlertTriangle size={24} color="var(--danger)" /><h3 style={{ fontWeight: 700 }}>Anomaly Detection</h3></div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Ensure you never face unexpected billing surprises with predictive anomaly alerts.</p>
              </div>

              <div className="card card-3d feature-card" style={{ padding: '1.25rem' }}>
                <img src="/shadow_costs_preview_1774761926737.png" alt="Shadow IT" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px', marginBottom: '1rem' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}><Eye size={24} color="var(--success)" /><h3 style={{ fontWeight: 700 }}>Shadow IT Detection</h3></div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Identify overlapping software licenses, duplicate vendor tools, and unapproved expenses.</p>
              </div>

              <div className="card card-3d feature-card" style={{ padding: '1.25rem' }}>
                <img src="/predictor_preview_1774761943359.png" alt="Predictor" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px', marginBottom: '1rem' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}><TrendingUp size={24} color="var(--accent)" /><h3 style={{ fontWeight: 700 }}>Future Predictor</h3></div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>AI models project your resource usage and alert you prior to catastrophic cost explosions.</p>
              </div>
            </div>
          </div>
        )}


        {/* ═══ DASHBOARD ═══ */}
        {activeTab === 'dashboard' && (
          <div className="fade-in">
            {!hasData ? <EmptyState title="No Data Yet" desc="Your dashboard will show real-time analytics once you upload or enter your enterprise cost data. Start by importing your expenses." /> : (<>
              <div className="dashboard-grid">
                <div className="card card-3d"><div className="card-title">Monthly Budget</div><div className="metric">₹{data.monthly_budget?.toLocaleString()}</div><div className="metric-change" style={{color:totalSpend>data.monthly_budget?'var(--danger)':'var(--success)'}}>{((totalSpend/(data.monthly_budget||1))*100).toFixed(1)}% utilized</div></div>
                <div className="card card-3d"><div className="card-title">Total Spend</div><div className="metric">₹{totalSpend?.toLocaleString()}</div><div className="metric-change">{data.historical_spend?.length||0} months of data</div></div>
                <div className="card card-3d"><div className="card-title">Cloud Costs</div><div className="metric" style={{color:'var(--primary)'}}>₹{data.total_cloud?.toLocaleString()}</div><div className="metric-change">{data.cloud_costs?.length||0} services</div></div>
                <div className="card card-3d"><div className="card-title">SaaS Spend</div><div className="metric">₹{data.total_saas?.toLocaleString()}</div><div className="metric-change">{data.saas_subscriptions?.length||0} subscriptions</div></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:'1.25rem', marginBottom:'1.5rem' }}>
                <div className="card card-3d"><h3 className="card-title">Spend Trend</h3><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.historical_spend}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="month" stroke="#94A3B8" fontSize={12} /><YAxis stroke="#94A3B8" fontSize={12} /><Tooltip /><Line type="monotone" dataKey="total" stroke="#F97316" strokeWidth={2.5} dot={{r:4,fill:'#F97316'}} /></LineChart></ResponsiveContainer></div></div>
                <div className="card card-3d"><h3 className="card-title">Cost Breakdown</h3><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{name: 'Cloud', cost: data.total_cloud}, {name: 'SaaS', cost: data.total_saas}, {name: 'Ops', cost: data.total_ops}]}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="name" stroke="#94A3B8" fontSize={12} /><YAxis stroke="#94A3B8" fontSize={12} /><Tooltip /><Bar dataKey="cost" fill="#3B82F6" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></div>
              </div>
              
              {data.cloud_costs?.length > 0 && <div className="card card-3d" style={{marginBottom:'1.25rem'}}><h3 className="card-title">Cloud Services</h3><table className="table"><thead><tr><th>Service</th><th>Cost</th><th>Utilization</th><th>Trend</th><th>Status</th></tr></thead><tbody>{data.cloud_costs.map((s,i) => (<tr key={i}><td style={{fontWeight:600}}>{s.service}</td><td>₹{s.cost.toLocaleString()}</td><td>{s.utilization}</td><td style={{color:parseInt(s.trend)>10?'var(--danger)':'var(--success)'}}>{s.trend}</td><td><span className="status-badge status-active">{s.status}</span></td></tr>))}</tbody></table></div>}
              {data.saas_subscriptions?.length > 0 && <div className="card card-3d" style={{marginBottom:'1.25rem'}}><h3 className="card-title">SaaS Subscriptions</h3><table className="table"><thead><tr><th>Name</th><th>Cost/mo</th><th>Licensed</th><th>Active</th><th>Utilization</th></tr></thead><tbody>{data.saas_subscriptions.map((s,i) => { const u=s.users>0?((s.active_users/s.users)*100).toFixed(0):0; return (<tr key={i}><td style={{fontWeight:600}}>{s.name}</td><td>₹{s.cost.toLocaleString()}</td><td>{s.users}</td><td>{s.active_users}</td><td><span className={`status-badge ${parseInt(u)<50?'status-alert':'status-active'}`}>{u}%</span></td></tr>);})}</tbody></table></div>}
              {data.operational_expenses?.length > 0 && <div className="card card-3d"><h3 className="card-title">Operational Expenses</h3><table className="table"><thead><tr><th>Provider</th><th>Cost</th><th>Category</th></tr></thead><tbody>{data.operational_expenses.slice(0, 5).map((s,i) => (<tr key={i}><td style={{fontWeight:600}}>{s.provider}</td><td>₹{s.cost.toLocaleString()}</td><td><span className="status-badge" style={{background: 'var(--surface-alt)', color: 'var(--text-secondary)'}}>{s.category}</span></td></tr>))}</tbody></table></div>}
            </>)}
          </div>
        )}

        {/* ═══ IMPORT ═══ */}
        {activeTab === 'data-entry' && <DataEntry token={token} onExpenseAdded={fetchAllData} setActiveTab={setActiveTab} />}

        {/* ═══ PROFILE ═══ */}
        {activeTab === 'profile' && (
          <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div className="card card-3d" style={{ background: 'var(--surface)' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={18} color="var(--primary)" /> Account Details</h3>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '1rem' }}>
                  <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary)', cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} onClick={() => document.getElementById('profilePicInput').click()}>
                    {profilePic ? (
                      <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}><User size={40} color="var(--text-secondary)" /></div>
                    )}
                    <div style={{ position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', textAlign: 'center', padding: '0.2rem 0', fontWeight: 'bold' }}>EDIT</div>
                    <input type="file" id="profilePicInput" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePicChange} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Email</span>
                      <strong style={{ fontWeight: 600 }}>{profile?.email}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Member Since</span>
                      <strong style={{ fontWeight: 600 }}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Monthly Budget</span>
                      <strong style={{ fontWeight: 600 }}>₹{(profile?.monthly_budget || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card" style={{ background: 'var(--surface)' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity size={18} color="var(--primary)" /> Lifetime Activity</h3>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, backgroundColor: 'var(--background)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{profile?.expense_count || 0}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Total Logs</div>
                  </div>
                  <div style={{ flex: 1, backgroundColor: 'var(--background)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem' }}>₹{(profile?.total_spent || 0).toLocaleString()}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Lifetime Spend</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={18} color="var(--primary)" /> Complete Expense History</h3>
              {expensesSummary?.expenses?.length > 0 ? (
                <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '1rem', paddingRight: '0.5rem' }}>
                  <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Date</th>
                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Vendor</th>
                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Category</th>
                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensesSummary.expenses.map((e, idx) => (
                        <tr key={e.id} style={{ borderBottom: idx !== expensesSummary.expenses.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '1rem 0.75rem', color: 'var(--text-secondary)' }}>{e.date}</td>
                          <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{e.vendor}</td>
                          <td style={{ padding: '1rem 0.75rem' }}><span className="status-badge" style={{ background: 'var(--background)' }}>{e.category || '—'}</span></td>
                          <td style={{ padding: '1rem 0.75rem', fontWeight: 700, textAlign: 'right' }}>₹{e.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>No expenses yet. Go to <strong style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setActiveTab('data-entry')}>Import</strong> to add data.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ MONITORING ═══ */}
        {activeTab === 'monitoring' && (
          <div className="fade-in">
            {!hasData ? <EmptyState title="No Data to Monitor" desc="The continuous monitoring system needs your enterprise data to detect cost leakage and inefficiencies. Import your data first." /> : (<>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}><Activity size={20} color="var(--primary)" /><h2 style={{fontSize:'1.15rem',fontWeight:700}}>Continuous Cost Monitoring</h2><span className="pulse-dot active" style={{marginLeft:'0.5rem'}}></span></div>
                <button className="btn btn-primary" onClick={triggerMon} disabled={monRunning}><RefreshCw size={14} style={monRunning?{animation:'spin 1s linear infinite'}:{}} /> {monRunning?'Scanning...':'Run Monitoring Now'}</button>
              </div>
              {monError && <div className="alert-banner danger" style={{marginBottom:'1rem'}}>{monError}</div>}
              <div className="monitoring-grid">
                <div className="card" style={{textAlign:'center'}}><div className="card-title">Issues</div><div className="metric" style={{color:'var(--danger)'}}>{monitoringStatus?.summary?.total_issues_detected||0}</div></div>
                <div className="card" style={{textAlign:'center'}}><div className="card-title">Monthly Savings</div><div className="metric" style={{color:'var(--success)'}}>₹{(monitoringStatus?.summary?.total_monthly_potential_savings||0).toLocaleString()}</div></div>
                <div className="card" style={{textAlign:'center'}}><div className="card-title">Annual Impact</div><div className="metric" style={{color:'var(--primary)'}}>₹{(monitoringStatus?.summary?.total_annual_potential_savings||0).toLocaleString()}</div></div>
              </div>
              {monitoringStatus?.summary?.top_3_savings_opportunities?.length > 0 && <div className="card" style={{marginBottom:'1.25rem'}}><h3 className="card-title">Top Savings</h3><table className="table"><thead><tr><th>Service</th><th>Issue</th><th>Monthly</th><th>Annual</th></tr></thead><tbody>{monitoringStatus.summary.top_3_savings_opportunities.map((o,i) => (<tr key={i}><td style={{fontWeight:600}}>{o.service}</td><td>{o.description}</td><td style={{color:'var(--success)',fontWeight:700}}>₹{(o.monthly_savings||0).toLocaleString()}</td><td style={{color:'var(--success)',fontWeight:700}}>₹{(o.annual_savings||0).toLocaleString()}</td></tr>))}</tbody></table></div>}
              {monitoringHistory?.cycles?.length > 0 && <div className="card"><h3 className="card-title">History</h3><table className="table"><thead><tr><th>#</th><th>Time</th><th>Issues</th><th>Savings</th></tr></thead><tbody>{monitoringHistory.cycles.map((c,i) => (<tr key={i}><td>{i+1}</td><td>{new Date(c.timestamp).toLocaleString()}</td><td><span className={`status-badge ${c.issues_detected>3?'status-alert':'status-warning'}`}>{c.issues_detected}</span></td><td style={{color:'var(--success)',fontWeight:600}}>₹{(c.total_potential_savings||0).toLocaleString()}</td></tr>))}</tbody></table></div>}
            </>)}
          </div>
        )}

        {/* ═══ AUTO FIXER ═══ */}
        {activeTab === 'spend' && (
          <div className="fade-in">
            {!hasData ? <EmptyState title="No Data to Fix" desc="The Autonomous Cost Fixer needs your enterprise data. Import data, then run Monitoring to generate actionable recommendations." /> : (
              <div className="card card-shiny">
                <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}><Zap size={18} color="var(--primary)" /><h3 style={{fontSize:'1.15rem',fontWeight:700}}>Autonomous Cost Fixer</h3></div>
                <p style={{color:'var(--text-secondary)',marginBottom:'1rem',fontSize:'0.9rem'}}>AI executes cost-saving actions with quantifiable financial impact.</p>
                {analysis && (analysis.inefficiencies?.length>0||analysis.duplicates?.length>0||analysis.unused_subscriptions?.length>0) && <div style={{marginBottom:'1.5rem'}}><h4 style={{fontSize:'0.85rem',fontWeight:600,marginBottom:'0.5rem',color:'var(--text-secondary)'}}>SPEND ANALYSIS</h4>{analysis.inefficiencies?.map((x,i) => <div key={i} className="alert-banner warning" style={{marginBottom:'0.5rem'}}>{x}</div>)}{analysis.duplicates?.map((x,i) => <div key={i} className="alert-banner danger" style={{marginBottom:'0.5rem'}}>{x}</div>)}{analysis.unused_subscriptions?.map((x,i) => <div key={i} className="alert-banner warning" style={{marginBottom:'0.5rem'}}>{x}</div>)}</div>}
                <h4 style={{fontSize:'0.85rem',fontWeight:600,marginBottom:'0.5rem',color:'var(--text-secondary)'}}>CORRECTIVE ACTIONS</h4>
                {recs.length > 0 ? (<table className="table"><thead><tr><th>Issue</th><th>Service</th><th>Monthly</th><th>Annual</th><th>Priority</th><th>Action</th></tr></thead><tbody>{recs.map((r,i) => { const id=r.id||`R_${i}`; const done=!!executedActions[id]; return (<tr key={i} className={done?'action-executed':''}><td style={{fontWeight:500}}>{r.description}</td><td style={{fontWeight:600}}>{r.service}</td><td style={{color:'var(--success)',fontWeight:700}}>₹{(r.monthly_savings||0).toLocaleString()}</td><td style={{color:'var(--success)',fontWeight:700}}>₹{(r.annual_savings||0).toLocaleString()}</td><td><span className={`status-badge ${r.severity==='HIGH'?'status-alert':'status-warning'}`}>{r.severity}</span></td><td>{done?<span className="status-badge status-active"><CheckCircle size={12}/> Fixed</span>:<button className="btn btn-primary btn-sm" onClick={() => execAction(id,r.issue_type,r.service,r.monthly_savings)}>Auto-Fix</button>}</td></tr>);})}</tbody></table>) : (<p style={{color:'var(--text-secondary)',fontSize:'0.9rem'}}>No recommendations yet. Run <strong>Monitoring</strong> first.</p>)}
                {Object.keys(executedActions).length > 0 && <div className="alert-banner success" style={{marginTop:'1.25rem'}}><CheckCircle size={16}/> {Object.keys(executedActions).length} action(s) executed. Savings: ₹{Object.values(executedActions).reduce((s,a) => s+(a.savings||0),0).toLocaleString()}/mo</div>}
              </div>
            )}
          </div>
        )}

        {/* ═══ ANOMALIES ═══ */}
        {activeTab === 'anomalies' && (
          <div className="fade-in">
            {!hasData ? <EmptyState title="No Data to Analyze" desc="Anomaly detection requires your expense data. Import data first." /> : (<>
              <h2 style={{fontSize:'1.15rem',fontWeight:700,marginBottom:'1rem'}}>Detected Anomalies</h2>
              {anomalies?.length > 0 ? anomalies.map((a,i) => (<div key={i} className="card" style={{marginBottom:'1rem',borderLeft:`3px solid ${a.severity==='Critical'?'var(--danger)':'var(--warning)'}`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h4 style={{fontWeight:600,marginBottom:'0.25rem'}}>{a.message}</h4><p style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>Root Cause: {a.root_cause}</p></div><span className={`status-badge ${a.severity==='Critical'?'status-alert':'status-warning'}`}>{a.severity}</span></div></div>)) : <div className="card"><p style={{color:'var(--text-secondary)'}}>No anomalies detected.</p></div>}
            </>)}
          </div>
        )}

        {/* ═══ SHADOW COSTS ═══ */}
        {activeTab === 'shadow' && (
          <div className="fade-in">
            {!hasData ? <EmptyState title="No Employee Data" desc="Shadow Cost detection requires employee expense data. Import data first." /> : (<>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}><Eye size={18} /><h2 style={{fontSize:'1.15rem',fontWeight:700}}>Shadow Cost Detector</h2></div>
              <p style={{color:'var(--text-secondary)',marginBottom:'1.25rem',fontSize:'0.9rem'}}>AI detects duplicate tools, unused subscriptions, and unauthorized licenses.</p>
              {shadowCosts?.length > 0 ? shadowCosts.map((t,i) => (<div key={i} className="card" style={{marginBottom:'1rem',borderLeft:'3px solid var(--danger)'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h4 style={{fontWeight:600}}>{t.merchant}</h4><p style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>{t.occurrences} employees — {t.insight}</p></div><div style={{textAlign:'right'}}><div style={{color:'var(--danger)',fontWeight:700,fontSize:'1.15rem'}}>₹{t.total_monthly_spend?.toLocaleString()}</div><div style={{color:'var(--text-muted)',fontSize:'0.75rem'}}>/month lost</div></div></div></div>)) : <div className="card"><p style={{color:'var(--text-secondary)'}}>No shadow IT detected.</p></div>}
            </>)}
          </div>
        )}

        {/* ═══ PREDICTOR ═══ */}
        {activeTab === 'predictor' && (
          <div className="fade-in">
            {!hasData ? <EmptyState title="No Cloud Data" desc="The predictor needs cloud cost data to forecast future spending. Import data first." /> : (<>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}><TrendingUp size={18} /><h2 style={{fontSize:'1.15rem',fontWeight:700}}>Future Cost Explosion Predictor</h2></div>
              {predictions?.length > 0 ? (<>
                <div className="alert-banner danger" style={{marginTop:'0.5rem'}}>{predictions.length} resource(s) with explosive growth!</div>
                <div className="card" style={{marginBottom:'1.25rem'}}><h3 className="card-title">Projected Growth (6 Months)</h3><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><BarChart data={predictions.map(p=>({name:p.resource,current:p.current_cost,projected:p.projected_cost_6m}))}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/><XAxis dataKey="name" stroke="#94A3B8" fontSize={12}/><YAxis stroke="#94A3B8" fontSize={12}/><Tooltip/><Bar dataKey="current" fill="#3B82F6" name="Current" radius={[4,4,0,0]}/><Bar dataKey="projected" fill="#EF4444" name="6mo Projected" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
                {predictions.map((p,i) => (<div key={i} className="card" style={{marginBottom:'1rem',borderLeft:`3px solid ${p.severity==='Critical'?'var(--danger)':'var(--warning)'}`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h4 style={{fontWeight:600}}>{p.resource}</h4><p style={{color:'var(--text-secondary)',fontSize:'0.85rem',maxWidth:'500px'}}>{p.warning}</p></div><div style={{textAlign:'right'}}><div style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>Now: ₹{p.current_cost?.toLocaleString()}</div><div style={{color:'var(--danger)',fontWeight:700,fontSize:'1.1rem'}}>+6m: ₹{p.projected_cost_6m?.toLocaleString()}</div></div></div></div>))}
              </>) : <div className="card"><p style={{color:'var(--text-secondary)'}}>No explosive growth detected. Costs are stable.</p></div>}
            </>)}
          </div>
        )}

        {/* ═══ SIMULATOR ═══ */}
        {activeTab === 'simulator' && (
          <div className="fade-in">
            {!hasData ? <EmptyState title="No Data to Simulate" desc="The What-If Simulator needs your cost data. Import data first." /> : (
              <div className="card">
                <h3 style={{fontSize:'1.15rem',fontWeight:700,marginBottom:'0.5rem'}}>What-If Cost Simulator</h3>
                <p style={{color:'var(--text-secondary)',marginBottom:'1.5rem',fontSize:'0.9rem'}}>Test optimization strategies calculated from your actual data.</p>
                <div style={{display:'flex',gap:'0.75rem'}}>
                  <button className="btn btn-secondary" onClick={() => runSim('conservative')} disabled={simLoading}>Conservative</button>
                  <button className="btn btn-primary" onClick={() => runSim('balanced')} disabled={simLoading}>Balanced</button>
                  <button className="btn btn-primary" onClick={() => runSim('aggressive')} disabled={simLoading} style={{background:'var(--danger)'}}>Aggressive</button>
                </div>
                {simLoading && <p style={{marginTop:'1rem',color:'var(--text-secondary)'}}>Running...</p>}
                {simulation && (<div style={{marginTop:'1.5rem'}}>
                  <div className="dashboard-grid">
                    <div className="card" style={{background:'var(--surface)',textAlign:'center'}}><div className="card-title">Strategy</div><div style={{fontSize:'1.3rem',fontWeight:700,textTransform:'capitalize'}}>{simulation.strategy}</div></div>
                    <div className="card" style={{background:'var(--surface)',textAlign:'center'}}><div className="card-title">Current</div><div style={{fontSize:'1.3rem',fontWeight:700}}>₹{simulation.current_run_rate?.toLocaleString()}</div></div>
                    <div className="card" style={{background:'var(--surface)',textAlign:'center'}}><div className="card-title">Savings</div><div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--success)'}}>₹{simulation.projected_monthly_savings?.toLocaleString()}/mo</div></div>
                    <div className="card" style={{background:'var(--surface)',textAlign:'center'}}><div className="card-title">New Total</div><div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--primary)'}}>₹{simulation.projected_new_total?.toLocaleString()}/mo</div></div>
                  </div>
                  <div style={{display:'flex',gap:'1rem',marginTop:'0.5rem'}}>
                    <div className={`alert-banner ${simulation.risk_level==='High'?'danger':simulation.risk_level==='Medium'?'warning':'success'}`} style={{flex:1}}>Risk: <strong>{simulation.risk_level}</strong></div>
                    <div className="alert-banner info" style={{flex:1}}>ROI: <strong>{simulation.roi_timeline}</strong></div>
                  </div>
                  <div className="card" style={{marginTop:'1.25rem'}}><h3 className="card-title">Before vs After</h3><div style={{height:'200px',marginTop:'1rem'}}><ResponsiveContainer width="100%" height="100%"><BarChart data={[{name:'Current',value:simulation.current_run_rate},{name:`After (${simulation.strategy})`,value:simulation.projected_new_total}]}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/><XAxis dataKey="name" stroke="#94A3B8" fontSize={12}/><YAxis stroke="#94A3B8" fontSize={12}/><Tooltip formatter={v=>`₹${v.toLocaleString()}`}/><Bar dataKey="value" radius={[6,6,0,0]}><Cell fill="#94A3B8"/><Cell fill="#10B981"/></Bar></BarChart></ResponsiveContainer></div></div>
                </div>)}
              </div>
            )}
          </div>
        )}
  {/* ═══ IMPACT CALCULATOR ═══ */}
        {activeTab === 'impact' && (
          <div className="fade-in">
            <FinancialImpactCalculator />
          </div>
        )}

      
      </div></div></div>

      {/* CHATBOT */}
      {chatOpen && (<div className="chatbot-floating"><div className="chatbot-header"><div className="chatbot-title">AI CFO Assistant</div><div className="chatbot-subtitle">Ask "Where am I overspending?"</div></div><div className="chat-messages">{chatHistory.map((m,i)=>(<div key={i} className={`message ${m.role}`}><div className="message-content">{m.content}</div></div>))}{chatLoading&&<div className="message bot"><div className="typing-indicator"><div className="typing-dot"></div><div className="typing-dot"></div><div className="typing-dot"></div></div></div>}<div ref={chatEnd}/></div><form className="chat-form" onSubmit={handleChat}><input type="text" className="chat-input" placeholder="Ask about costs..." value={chatInput} onChange={e=>setChatInput(e.target.value)} disabled={chatLoading}/><button type="submit" className="btn-send" disabled={chatLoading}><Send size={16}/></button></form></div>)}
      <button className="chat-fab" onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? <X size={24}/> : <MessageCircle size={24}/>}</button>
    </div>
  );

  return <Routes><Route path="/features" element={dashboardUI} /><Route path="/dashboard" element={dashboardUI} /><Route path="*" element={<Navigate to="/features" replace />} /></Routes>;
}

export default App;

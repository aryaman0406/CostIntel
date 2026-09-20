import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Routes, Route, useNavigate } from 'react-router-dom';

import LandingPage from './landing/LandingPage';
import Auth from './Auth';
import DataEntry from './DataEntry';
import Layout from './components/Layout';
import OverviewTab from './components/tabs/OverviewTab';
import DashboardTab from './components/tabs/DashboardTab';
import ProfileTab from './components/tabs/ProfileTab';
import MonitoringTab from './components/tabs/MonitoringTab';
import SimulatorTab from './components/tabs/SimulatorTab';
import ImpactCalculatorTab from './components/tabs/ImpactCalculatorTab';
import CFOChatTab from './components/tabs/CFOChatTab';
import AuditTrailTab from './components/tabs/AuditTrailTab';
import AnomalyTab from './components/tabs/AnomalyTab';
import ReconciliationTab from './components/tabs/ReconciliationTab';

import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

function App() {
  const [data, setData] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [profile, setProfile] = useState(null);
  const [expensesSummary, setExpensesSummary] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [monitoringStatus, setMonitoringStatus] = useState(null);
  const [monitoringHistory, setMonitoringHistory] = useState(null);
  const [monitoringRuns, setMonitoringRuns] = useState([]);

  // New: anomaly + audit state
  const [anomalyData, setAnomalyData] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Reconciliation state
  const [reconResult, setReconResult] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [simLoading, setSimLoading] = useState(false);
  const [monRunning, setMonRunning] = useState(false);
  const [monError, setMonError] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [profilePic, setProfilePic] = useState(null);

  const navigate = useNavigate();

  // Floating chatbot state (preserved for Layout)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', content: "Hello! I'm your CFO Assistant. Ask me about costs, budgets, or say 'Add 500 for Zoom' to log expenses." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEnd = useRef(null);
  const inactivityTimerRef = useRef(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const performLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    setToken(null);
    navigate('/?modal=login', { replace: true });
  }, [navigate]);

  const getAuthHeaders = useCallback(() => {
    const latestToken = token || localStorage.getItem('access_token');
    return latestToken ? { Authorization: `Bearer ${latestToken}` } : {};
  }, [token]);

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

  // Shared chat API call — used by floating chatbot AND CFOChatTab
  const callChatAPI = useCallback(async (message) => {
    const res = await axios.post(`${API_BASE}/chat`, { message }, { headers: getAuthHeaders() });
    // New response shape: { data: { message, tools_used } }
    // Old shape: { data: string }
    // We handle both.
    return res.data.data;
  }, [getAuthHeaders]);

  // Floating chat handler (backward compat)
  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(p => [...p, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const resData = await callChatAPI(msg);
      // resData might be { message, tools_used } or a plain string
      const text = typeof resData === 'string' ? resData : (resData?.message || JSON.stringify(resData));
      setChatHistory(p => [...p, { role: 'bot', content: text }]);
      if (text && text.includes('✅')) {
        fetchAllData();
      }
    } catch (err) {
      if (err.response?.status === 401) { performLogout(); }
      setChatHistory(p => [...p, { role: 'bot', content: '❌ Unable to process. Try again.' }]);
    }
    setChatLoading(false);
  };

  const fetchAnomalies = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/anomalies`, { headers: getAuthHeaders() });
      setAnomalyData(res.data?.data?.anomalies || []);
    } catch {
      setAnomalyData([]);
    }
  }, [token, getAuthHeaders]);

  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/audit/logs?per_page=50`, { headers: getAuthHeaders() });
      setAuditLogs(res.data?.data?.logs || []);
    } catch {
      setAuditLogs([]);
    }
  }, [token, getAuthHeaders]);

  const fetchLastRecon = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/reconciliation/last-run`, { headers: getAuthHeaders() });
      if (res.data?.data) setReconResult(res.data.data);
    } catch {
      // 404 just means no run yet — that's fine
    }
  }, [token, getAuthHeaders]);

  const fetchAllData = useCallback(async () => {
    if (!token) return;
    const h = getAuthHeaders();
    try {
      const results = await Promise.allSettled([
        axios.get(`${API_BASE}/dashboard`, { headers: h }),
        axios.get(`${API_BASE}/profile`, { headers: h }),
        axios.get(`${API_BASE}/expenses`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/status`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/history`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/runs`, { headers: h }),
        axios.get(`${API_BASE}/anomalies`, { headers: h }),
        axios.get(`${API_BASE}/audit/logs?per_page=50`, { headers: h }),
        axios.get(`${API_BASE}/reconciliation/last-run`, { headers: h }),
      ]);

      const getData = (idx) => results[idx].status === 'fulfilled' ? results[idx].value?.data?.data : null;
      const getErr = (idx) => (results[idx].status === 'rejected' ? results[idx].reason : null);

      if (results[0].status === 'fulfilled') {
        setData(getData(0));
      } else {
        const e = getErr(0);
        if (e?.response?.status === 401) {
          performLogout();
        }
      }

      setProfile(getData(1));
      setExpensesSummary(getData(2));
      setMonitoringStatus(getData(3));
      setMonitoringHistory(getData(4));

      const runsData = getData(5);
      setMonitoringRuns(runsData?.runs || []);

      const anomaliesData = getData(6);
      if (anomaliesData?.anomalies) setAnomalyData(anomaliesData.anomalies);

      const auditData = getData(7);
      if (auditData?.logs) setAuditLogs(auditData.logs);

      const reconData = getData(8);
      if (reconData) setReconResult(reconData);

      const profileData = getData(1);
      if (profileData?.role === 'Admin') {
        try {
          const usersRes = await axios.get(`${API_BASE}/users`, { headers: h });
          const users = usersRes?.data?.data?.users;
          setAdminUsers(Array.isArray(users) ? users : []);
        } catch {
          setAdminUsers([]);
        }
      } else {
        setAdminUsers([]);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        performLogout();
      }
    } finally {
      setLoading(false);
    }
  }, [token, performLogout, getAuthHeaders]);

  useEffect(() => {
    let isMounted = true;
    if (token && isMounted) {
      fetchAllData();
    }
    return () => { isMounted = false; };
  }, [token, fetchAllData]);

  // Fetch anomalies + audit when tab changes to those sections
  useEffect(() => {
    let isMounted = true;
    if (!isMounted) return;
    if (activeTab === 'anomalies') fetchAnomalies();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'reconciliation') fetchLastRecon();
    if (activeTab === 'overview') {
      fetchAuditLogs();
      fetchAnomalies();
      fetchLastRecon();
    }
    return () => { isMounted = false; };
  }, [activeTab, fetchAnomalies, fetchAuditLogs, fetchLastRecon]);

  useEffect(() => {
    if (!token) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        performLogout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetInactivityTimer));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [token, performLogout]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const handleLogout = () => { performLogout(); };

  const runSim = async (s) => {
    setSimLoading(true);
    try {
      const r = await axios.post(`${API_BASE}/simulate`, { strategy: s }, { headers: getAuthHeaders() });
      setSimulation(r.data.data);
    } catch {
      // Keep existing simulation state if API call fails.
    }
    setSimLoading(false);
  };

  const triggerMon = async () => {
    setMonRunning(true);
    setMonError('');
    const h = getAuthHeaders();
    try {
      await axios.post(`${API_BASE}/monitoring/run`, {}, { headers: h });
      const [status, hist, runs] = await Promise.all([
        axios.get(`${API_BASE}/monitoring/status`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/history`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/runs`, { headers: h }),
      ]);
      setMonitoringStatus(status.data.data);
      setMonitoringHistory(hist.data.data);
      setMonitoringRuns(runs.data?.data?.runs || []);
    } catch (e) {
      if (e.response?.status === 401) {
        setMonError('Session expired. Please sign in again.');
        performLogout();
      } else {
        setMonError(e.response?.data?.message || e.message || 'Failed to run monitoring.');
      }
    }
    setMonRunning(false);
  };

  const handleRescore = async () => {
    const h = getAuthHeaders();
    await axios.post(`${API_BASE}/anomalies/score`, {}, { headers: h });
    await fetchAnomalies();
    await fetchAuditLogs();
  };

  const handleRunRecon = async () => {
    setReconLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/reconciliation/run`, {}, { headers: getAuthHeaders() });
      if (res.data?.data) setReconResult(res.data.data);
      // Also refresh audit logs so the new reconciliation_run entry appears
      await fetchAuditLogs();
    } catch (e) {
      console.error('Reconciliation run failed:', e);
    }
    setReconLoading(false);
  };

  if (!token) {
    return (
      <Routes>
        {/* Public landing page — entry point for all unauthenticated visitors */}
        <Route path="/" element={<LandingPage onAuthSuccess={setToken} />} />
        {/* /login kept as an alias for backward-compat deep links */}
        <Route path="/login" element={<Navigate to="/?modal=login" replace />} />
        {/* Old Auth component kept in case it's linked from somewhere else */}
        <Route path="/auth" element={<Auth setAuthParams={setToken} />} />
        {/* Any other path → landing with login modal + redirect hint */}
        <Route
          path="*"
          element={
            <Navigate
              to={`/?modal=login&redirect=${encodeURIComponent(location.pathname + location.search)}`}
              replace
            />
          }
        />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen" data-theme={theme}>
        <div className="loading-logo">
          <Shield size={24} />
        </div>
        <p>Loading CostIntel...</p>
      </div>
    );
  }

  const renderActiveTab = () => {
    const hasData = data?.has_data === true;
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab data={data} setActiveTab={setActiveTab} />;
      case 'data-entry':
        return <DataEntry token={token} onExpenseAdded={fetchAllData} setActiveTab={setActiveTab} />;
      case 'profile':
        return <ProfileTab profile={profile} expensesSummary={expensesSummary} profilePic={profilePic} handleProfilePicChange={handleProfilePicChange} setActiveTab={setActiveTab} adminUsers={adminUsers} token={token} />;
      case 'monitoring':
        return <MonitoringTab hasData={hasData} triggerMon={triggerMon} monRunning={monRunning} monError={monError} monitoringStatus={monitoringStatus} monitoringHistory={monitoringHistory} monitoringRuns={monitoringRuns} setActiveTab={setActiveTab} />;
      case 'simulator':
        return <SimulatorTab hasData={hasData} runSim={runSim} simLoading={simLoading} simulation={simulation} setActiveTab={setActiveTab} />;
      case 'impact':
        return <ImpactCalculatorTab />;
      case 'cfo-chat':
        return <CFOChatTab onChat={callChatAPI} />;
      case 'anomalies':
        return <AnomalyTab anomalyData={anomalyData} onRescore={handleRescore} />;
      case 'audit':
        return <AuditTrailTab auditLogs={auditLogs} />;
      case 'reconciliation':
        return <ReconciliationTab reconResult={reconResult} reconLoading={reconLoading} onRunRecon={handleRunRecon} />;
      case 'overview':
      default:
        return (
          <OverviewTab
            data={data}
            expensesSummary={expensesSummary}
            anomalyData={anomalyData}
            reconResult={reconResult}
            monitoringStatus={monitoringStatus}
            monitoringRuns={monitoringRuns}
            auditLogs={auditLogs}
            setActiveTab={setActiveTab}
          />
        );
    }
  };

  const layoutProps = {
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    handleLogout,
    fetchAllData,
    profile,
    chatOpen,
    setChatOpen,
    chatHistory,
    chatLoading,
    chatInput,
    setChatInput,
    handleChat,
    chatEnd,
  };

  return (
    <Routes>
      {/* When authenticated, / is the dashboard (same as before) */}
      <Route path="/*" element={<Layout {...layoutProps}>{renderActiveTab()}</Layout>} />
    </Routes>
  );
}

export default App;

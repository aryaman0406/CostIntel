import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import Auth from './Auth';
import DataEntry from './DataEntry';
import Layout from './components/Layout';
import FeaturesTab from './components/tabs/FeaturesTab';
import DashboardTab from './components/tabs/DashboardTab';
import ProfileTab from './components/tabs/ProfileTab';
import MonitoringTab from './components/tabs/MonitoringTab';
import SimulatorTab from './components/tabs/SimulatorTab';
import ImpactCalculatorTab from './components/tabs/ImpactCalculatorTab';

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
  const [monitoringRecommendations, setMonitoringRecommendations] = useState(null);
  const [monitoringHistory, setMonitoringHistory] = useState(null);
  
  const [activeTab, setActiveTab] = useState('features');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [simLoading, setSimLoading] = useState(false);
  const [monRunning, setMonRunning] = useState(false);
  const [monError, setMonError] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [profilePic, setProfilePic] = useState(localStorage.getItem('profilePic') || null);

  const navigate = useNavigate();

  // Chatbot state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', content: "Hello! I'm your AI CFO Assistant. Ask me about costs, budgets, or say 'Add 500 for Zoom' to log expenses." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEnd = useRef(null);
  const inactivityTimerRef = useRef(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const performLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    setToken(null);
    navigate('/login');
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

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(p => [...p, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/chat`, { message: msg }, { headers: getAuthHeaders() });
      setChatHistory(p => [...p, { role: 'bot', content: res.data.data }]);
      if (res.data.data && res.data.data.includes('✅')) {
        fetchAllData();
      }
    } catch (err) {
      if (err.response?.status === 401) { performLogout(); }
      setChatHistory(p => [...p, { role: 'bot', content: '❌ Unable to process. Try again.' }]);
    }
    setChatLoading(false);
  };

  const fetchAllData = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    if (!data) {
      setLoading(true);
    }
    const h = getAuthHeaders();
    try {
      const results = await Promise.allSettled([
        axios.get(`${API_BASE}/dashboard`, { headers: h }),
        axios.get(`${API_BASE}/profile`, { headers: h }),
        axios.get(`${API_BASE}/expenses`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/status`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/recommendations`, { headers: h }),
        axios.get(`${API_BASE}/monitoring/history`, { headers: h }),
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
      setMonitoringRecommendations(getData(4));
      setMonitoringHistory(getData(5));

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
    }
    setLoading(false);
  }, [token, performLogout, getAuthHeaders]);

  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [token, fetchAllData]);

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
      const [status, recs, hist] = await Promise.all([
        axios.get(`${API_BASE}/monitoring/status`,{headers:h}),
        axios.get(`${API_BASE}/monitoring/recommendations`,{headers:h}),
        axios.get(`${API_BASE}/monitoring/history`,{headers:h})
      ]);
      setMonitoringStatus(status.data.data); 
      setMonitoringRecommendations(recs.data.data); 
      setMonitoringHistory(hist.data.data);
    } catch(e){
      if (e.response?.status === 401) {
        setMonError('Session expired. Please sign in again.');
        performLogout();
      } else {
        setMonError(e.response?.data?.message || e.message || 'Failed to run monitoring.');
      }
    }
    setMonRunning(false);
  };

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Auth setAuthParams={setToken} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <RefreshCw size={40} className="animate-spin" />
        <p>Loading CostIntel AI...</p>
      </div>
    );
  }

  const renderActiveTab = () => {
    const hasData = data?.has_data === true;
    switch (activeTab) {
      case 'dashboard': return <DashboardTab data={data} setActiveTab={setActiveTab} />;
      case 'data-entry': return <DataEntry token={token} onExpenseAdded={fetchAllData} setActiveTab={setActiveTab} />;
      case 'profile': return <ProfileTab profile={profile} expensesSummary={expensesSummary} profilePic={profilePic} handleProfilePicChange={handleProfilePicChange} setActiveTab={setActiveTab} adminUsers={adminUsers} token={token} />;
      case 'monitoring': return <MonitoringTab hasData={hasData} triggerMon={triggerMon} monRunning={monRunning} monError={monError} monitoringStatus={monitoringStatus} monitoringHistory={monitoringHistory} setActiveTab={setActiveTab} />;
      case 'simulator': return <SimulatorTab hasData={hasData} runSim={runSim} simLoading={simLoading} simulation={simulation} setActiveTab={setActiveTab} />;
      case 'impact': return <ImpactCalculatorTab />;
      case 'features':
      default:
        return <FeaturesTab setActiveTab={setActiveTab} />;
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
    chatEnd
  };

  return (
    <Routes>
      <Route path="/*" element={<Layout {...layoutProps}>{renderActiveTab()}</Layout>} />
    </Routes>
  );
}

export default App;

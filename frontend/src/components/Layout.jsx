import React, { useState } from 'react';
import {
  LayoutGrid, LayoutDashboard, UploadCloud, Activity, AlertTriangle,
  Sliders, MessageSquare, GitMerge, ClipboardList, Calculator, User,
  Moon, Sun, RefreshCw, LogOut, MessageCircle, X, Menu, Shield,
  ChevronRight, Send, Zap, Bell
} from 'lucide-react';

const NAV_GROUPS = [
  {
    title: 'General',
    items: [
      { key: 'overview', icon: LayoutGrid, label: 'Overview' },
    ],
  },
  {
    title: 'Expenses',
    items: [
      { key: 'dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
      { key: 'data-entry', icon: UploadCloud,      label: 'Import / Ingest' },
    ],
  },
  {
    title: 'Intelligence & AI',
    items: [
      { key: 'monitoring', icon: Activity,       label: 'Monitoring' },
      { key: 'anomalies',  icon: AlertTriangle,  label: 'Anomalies' },
      { key: 'simulator',  icon: Sliders,        label: 'Simulator' },
      { key: 'cfo-chat',   icon: MessageSquare,  label: 'CFO Chat' },
    ],
  },
  {
    title: 'Governance & Tools',
    items: [
      { key: 'reconciliation', icon: GitMerge,     label: 'Reconcile' },
      { key: 'audit',          icon: ClipboardList, label: 'Audit Trail' },
      { key: 'impact',         icon: Calculator,    label: 'Impact Calc' },
    ],
  },
];

const SidebarItem = ({ item, activeTab, setActiveTab, closeMobile }) => {
  const IconComponent = item.icon;
  const isActive = activeTab === item.key;

  return (
    <button
      className={`sidebar-item ${isActive ? 'active' : ''}`}
      onClick={() => {
        setActiveTab(item.key);
        if (closeMobile) closeMobile();
      }}
    >
      <div className="sidebar-item-icon">
        <IconComponent size={16} />
      </div>
      <span>{item.label}</span>
    </button>
  );
};

const Sidebar = ({
  activeTab,
  setActiveTab,
  handleLogout,
  profile,
  mobileOpen,
  setMobileOpen,
}) => {
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {mobileOpen && <div className="mobile-backdrop" onClick={closeMobile} />}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div
            className="sidebar-logo"
            onClick={() => { setActiveTab('overview'); closeMobile(); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('overview')}
          >
            <div className="sidebar-logo-icon">
              <Shield size={15} />
            </div>
            <div className="sidebar-brand-name">CostIntel</div>
          </div>
          <span className="sidebar-badge">FinOps AI</span>
          <button className="sidebar-close-btn" onClick={closeMobile} title="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="nav-group">
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => (
                <SidebarItem
                  key={item.key}
                  item={item}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  closeMobile={closeMobile}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div
            className="user-profile-summary"
            onClick={() => { setActiveTab('profile'); closeMobile(); }}
            title="View Profile Settings"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('profile')}
          >
            <div className="user-avatar-circle">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info-text">
              <div className="user-info-name">{profile?.full_name || 'User'}</div>
              <div className="user-info-role font-mono tabular-nums">{profile?.role || 'Viewer'}</div>
            </div>
            <ChevronRight size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          </div>

          <div className="sidebar-footer-actions">
            <button className="btn-icon btn-icon-danger" onClick={handleLogout} title="Logout" style={{ flex: 1 }}>
              <LogOut size={15} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

const TopBar = ({ activeTab, setMobileOpen, theme, toggleTheme, fetchAllData }) => {
  let currentLabel = 'Overview';
  for (const group of NAV_GROUPS) {
    const found = group.items.find(i => i.key === activeTab);
    if (found) { currentLabel = found.label; break; }
  }
  if (activeTab === 'profile') currentLabel = 'Profile & Users';

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          title="Open Navigation"
        >
          <Menu size={17} />
        </button>
        <div className="breadcrumb-trail">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>CostIntel</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{currentLabel}</span>
        </div>

        {/* 3D Live status indicator */}
        <div className="live-beacon">
          <span className="beacon-dot" />
          <span>Live Agent</span>
        </div>
      </div>

      <div className="top-bar-right">
        <button className="btn-icon" onClick={fetchAllData} title="Refresh Data">
          <RefreshCw size={15} />
        </button>

        {/* Eye-catching Theme Switcher Pill */}
        <div
          className="theme-switch-pill"
          onClick={toggleTheme}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleTheme()}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          <div className={`theme-switch-option ${theme === 'light' ? 'active' : ''}`}>
            <Sun size={13} />
            <span>Light</span>
          </div>
          <div className={`theme-switch-option ${theme === 'dark' ? 'active' : ''}`}>
            <Moon size={13} />
            <span>Dark</span>
          </div>
        </div>
      </div>
    </header>
  );
};

const Chatbot = ({ chatOpen, setChatOpen, chatHistory, chatLoading, chatInput, setChatInput, handleChat, chatEnd }) => (
  <>
    {chatOpen && (
      <div className="chatbot-floating">
        <div className="chatbot-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="chatbot-title">
              <Zap size={15} />
              CFO Assistant
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={15} />
            </button>
          </div>
          <div className="chatbot-subtitle">Your cost management expert</div>
        </div>

        <div className="chat-messages">
          {chatHistory.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <div className="message-content">{m.content}</div>
            </div>
          ))}
          {chatLoading && (
            <div className="message bot">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={chatEnd} />
        </div>

        <form className="chat-form" onSubmit={handleChat}>
          <input
            type="text"
            className="chat-input"
            placeholder="Ask about costs..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={chatLoading}
          />
          <button type="submit" className="btn-send" disabled={chatLoading}>
            <Send size={15} />
          </button>
        </form>
      </div>
    )}

    <button className="chat-fab" onClick={() => setChatOpen(!chatOpen)} title="Open Floating CFO Chat">
      {chatOpen ? <X size={22} /> : <MessageCircle size={22} />}
    </button>
  </>
);

const Layout = ({ children, ...props }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout" data-theme={props.theme}>
      <Sidebar {...props} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="main-wrapper">
        <TopBar {...props} setMobileOpen={setMobileOpen} />
        <main className="main-container">
          <div className="content-area">
            {children}
          </div>
        </main>
      </div>
      <Chatbot {...props} />
    </div>
  );
};

export default Layout;
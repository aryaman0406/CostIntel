import React from 'react';
import { LayoutDashboard, TrendingUp, FileText, User, Activity, PlayCircle, DollarSign, Moon, Sun, RefreshCw, LogOut, MessageCircle, X } from 'lucide-react';
import { Send } from 'lucide-react';

const NavItem = ({ tabKey, activeTab, setActiveTab, icon, label }) => {
  const IconComponent = icon;
  return (
    <button
      key={tabKey}
      className={`nav-tab ${activeTab === tabKey ? 'active' : ''}`}
      onClick={() => setActiveTab(tabKey)}
    >
      <IconComponent size={16} />
      <span>{label}</span>
    </button>
  );
};

const Header = ({ activeTab, setActiveTab, theme, toggleTheme, handleLogout, fetchAllData, profile }) => {
  const navItems = [
    { key: 'features', icon: TrendingUp, label: 'Features' },
    { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { key: 'data-entry', icon: FileText, label: 'Import' },
    { key: 'profile', icon: User, label: 'Profile' },
    { key: 'monitoring', icon: Activity, label: 'Monitoring' },
    { key: 'simulator', icon: PlayCircle, label: 'Simulator' },
    { key: 'impact', icon: DollarSign, label: 'Impact Calculator' },
  ];

  const navTabsRef = React.useRef(null);

  React.useEffect(() => {
    const el = navTabsRef.current;
    if (el) {
      const onWheel = (e) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }
  }, []);

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="logo">CostIntel</h1>
          <nav className="nav-tabs" ref={navTabsRef}>
            {navItems.map(item => (
              <NavItem key={item.key} tabKey={item.key} icon={item.icon} label={item.label} activeTab={activeTab} setActiveTab={setActiveTab} />
            ))}
          </nav>
        </div>
        <div className="header-right">
          <button className="btn-icon" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="btn-icon" onClick={fetchAllData} title="Refresh Data">
            <RefreshCw size={18} />
          </button>
          <div className="profile-menu">
            <span className="profile-name">{profile?.full_name || 'User'}</span>
            <button className="btn-icon" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
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
          <div className="chatbot-title">CFO Assistant</div>
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
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
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
            <Send size={16} />
          </button>
        </form>
      </div>
    )}
    <button className="chat-fab" onClick={() => setChatOpen(!chatOpen)}>
      {chatOpen ? <X size={24} /> : <MessageCircle size={24} />}
    </button>
  </>
);


const Layout = ({ children, ...props }) => {
  return (
    <div className="app-layout" data-theme={props.theme}>
      <Header {...props} />
      <main className="main-container">
        <div className="content-area">
          {children}
        </div>
      </main>
      <Chatbot {...props} />
    </div>
  );
};

export default Layout;
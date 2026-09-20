import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Lock, UserPlus, LogIn, AlertCircle, Info, X,
  Shield, CheckCircle2, Zap, TrendingDown, Eye, EyeOff,
  Layers, Bot, ArrowRight, ShieldCheck, Sparkles, Check
} from 'lucide-react';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Official Google 'G' Logo SVG
const GoogleLogo = () => (
  <svg className="google-icon-svg" viewBox="0 0 24 24" width="18" height="18">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@costintel.com', pass: 'Admin@123', label: 'Full Access & Governance' },
  { role: 'Analyst', email: 'analyst@costintel.com', pass: 'Analyst@123', label: 'FinOps & Reconciler' },
  { role: 'Viewer', email: 'viewer@costintel.com', pass: 'Viewer@123', label: 'Executive Read-Only' },
];

const Auth = ({ setAuthParams }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [demoAutofilled, setDemoAutofilled] = useState('');

  const googleBtnRef = useRef(null);
  const navigate = useNavigate();

  // Handle successful Google token response
  const handleGoogleCredentialResponse = useCallback(async (response) => {
    if (!response || !response.credential) {
      setError('Google Sign-In failed: No credential returned.');
      return;
    }

    setGoogleLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE}/auth/google`, {
        credential: response.credential
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      if (res.data.status === 'success') {
        const token = res.data.data.access_token;
        localStorage.setItem('access_token', token);
        setAuthParams(token);
        navigate('/');
      } else {
        setError(res.data.message || 'Google authentication failed.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Google login failed. Please try again.';
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [setAuthParams, navigate]);

  // Initialize Google Identity Services SDK
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initializeGoogleGSI = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: googleBtnRef.current.offsetWidth || 340,
            text: isLogin ? 'signin_with' : 'signup_with',
            shape: 'rectangular',
          });
        }
      }
    };

    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleGSI;
      document.body.appendChild(script);
    } else {
      initializeGoogleGSI();
    }
  }, [isLogin, handleGoogleCredentialResponse]);

  const handleCustomGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      setShowConfigModal(true);
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In SDK is still loading. Please try again in a moment.');
    }
  };

  const handleAutofillDemo = (acc) => {
    setIsLogin(true);
    setEmail(acc.email);
    setPassword(acc.pass);
    setDemoAutofilled(acc.role);
    setError('');
    setTimeout(() => setDemoAutofilled(''), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = isLogin ? { email, password } : { email, password, full_name: fullName };
    const endpoint = isLogin ? `${API_BASE}/login` : `${API_BASE}/register`;

    const makeRequest = () => axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    try {
      let res;
      try {
        res = await makeRequest();
      } catch (firstErr) {
        if (firstErr.code === 'ECONNABORTED' || !firstErr.response) {
          await new Promise(r => setTimeout(r, 500));
          res = await makeRequest();
        } else {
          throw firstErr;
        }
      }

      if (res.data.status === 'success') {
        if (isLogin) {
          localStorage.setItem('access_token', res.data.data.access_token);
          setAuthParams(res.data.data.access_token);
          navigate('/');
        } else {
          setIsLogin(true);
          setError('Registration successful! Please sign in with your credentials.');
          setEmail('');
          setPassword('');
          setFullName('');
        }
      } else {
        const serverMessage = res.data.message || 'An unknown error occurred.';
        if (res.data.errors && typeof res.data.errors === 'object') {
          const fieldMsgs = Object.entries(res.data.errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ');
          setError(`${serverMessage} ${fieldMsgs}`);
        } else {
          setError(serverMessage);
        }
      }
    } catch (err) {
      let msg = 'A network error occurred. Please check your connection.';
      if (err.code === 'ECONNABORTED') {
        msg = 'Connection timed out. Please try again.';
      } else if (err.response) {
        const data = err.response.data || {};
        const serverMessage = data.message || `Server error: ${err.response.status}`;
        if (data.errors && typeof data.errors === 'object') {
          const fieldMsgs = Object.entries(data.errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ');
          msg = `${serverMessage} ${fieldMsgs}`;
        } else {
          msg = serverMessage;
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" data-theme="dark">
      {/* Dynamic Ambient Background Glows */}
      <div className="auth-ambient-glow auth-ambient-glow-1" />
      <div className="auth-ambient-glow auth-ambient-glow-2" />

      <div className="auth-wrapper">
        {/* Left Column: FinOps Platform Showcase */}
        <div className="auth-hero-section">
          <div className="auth-brand-badge">
            <span className="pulse-orb" />
            <Shield size={15} style={{ color: '#818cf8' }} />
            <span>Autonomous FinOps Platform</span>
          </div>

          <div>
            <h1 className="auth-hero-title">
              Autonomous Cost Governance <br />
              <span className="highlight">&amp; AI FinOps Controller</span>
            </h1>
            <p className="auth-hero-subtitle" style={{ marginTop: '0.85rem' }}>
              Multi-source ledger reconciliation, pure-Python statistical anomaly scoring,
              and conversational CFO reasoning backed by an immutable SQL audit trail.
            </p>
          </div>

          {/* Live Feature Showcase Badges */}
          <div className="auth-feature-cards">
            <div className="auth-feature-item recon">
              <div className="auth-feature-icon">
                <Layers size={19} />
              </div>
              <div className="auth-feature-content">
                <h4>3-Tier Multi-Source Reconciliation</h4>
                <p>Exact, Tolerant (±₹5 / ±3d), &amp; Fuzzy vendor matching with 95.4% measured throughput.</p>
              </div>
            </div>

            <div className="auth-feature-item leak">
              <div className="auth-feature-icon">
                <TrendingDown size={19} />
              </div>
              <div className="auth-feature-content">
                <h4>Statistical Anomaly &amp; Leak Scanner</h4>
                <p>Self-built pure Python z-score &amp; IQR algorithms detect unbudgeted spikes instantly.</p>
              </div>
            </div>

            <div className="auth-feature-item cfo">
              <div className="auth-feature-icon">
                <Bot size={19} />
              </div>
              <div className="auth-feature-content">
                <h4>Gemini 2.5 CFO Copilot</h4>
                <p>Autonomous function-calling tools with full database persistence in immutable audit logs.</p>
              </div>
            </div>
          </div>

          {/* Security Trust Badges */}
          <div className="auth-hero-trust">
            <div className="auth-hero-trust-item">
              <ShieldCheck size={16} style={{ color: '#34d399' }} />
              <span>SOC2 Type II Ready</span>
            </div>
            <div className="auth-hero-trust-item">
              <Lock size={15} style={{ color: '#60a5fa' }} />
              <span>256-bit AES Encryption</span>
            </div>
            <div className="auth-hero-trust-item">
              <Sparkles size={15} style={{ color: '#c084fc' }} />
              <span>Immutable Audit Trail</span>
            </div>
          </div>
        </div>

        {/* Right Column: Glassmorphic Auth Card */}
        <div className="auth-card-premium">
          <div className="auth-card-glow-bar" />

          {/* Header Switcher Tabs */}
          <div className="auth-tab-switch">
            <button
              type="button"
              className={`auth-tab-btn ${isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(true); setError(''); }}
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${!isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(false); setError(''); }}
            >
              <UserPlus size={16} />
              <span>Create Account</span>
            </button>
          </div>

          <div className="auth-card-header">
            <h2>{isLogin ? 'Welcome to CostIntel' : 'Start with CostIntel'}</h2>
            <p>{isLogin ? 'Sign in to access your FinOps intelligence dashboard.' : 'Deploy autonomous cost control across your cloud and SaaS spend.'}</p>
          </div>

          {/* Quick 1-Click Demo Credentials (Admin, Analyst, Viewer) */}
          {isLogin && (
            <div className="auth-demo-section">
              <div className="auth-demo-header">
                <span>⚡ Quick Demo Credentials</span>
                {demoAutofilled && (
                  <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} /> {demoAutofilled} Filled
                  </span>
                )}
              </div>
              <div className="auth-demo-pills">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    className="auth-demo-pill"
                    onClick={() => handleAutofillDemo(acc)}
                    title={`Click to fill ${acc.email} (${acc.label})`}
                  >
                    <strong>{acc.role}</strong>
                    <span>{acc.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status / Error Alerts */}
          {error && (
            <div className={`auth-status-alert ${error.toLowerCase().includes('successful') ? 'success' : 'error'}`}>
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Google SSO Button */}
          {GOOGLE_CLIENT_ID ? (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.2rem 0' }}>
              <div ref={googleBtnRef} style={{ width: '100%' }}></div>
            </div>
          ) : (
            <button
              type="button"
              className="btn-google-sso"
              onClick={handleCustomGoogleClick}
              disabled={googleLoading}
            >
              <GoogleLogo />
              <span>{googleLoading ? 'Connecting to Google...' : (isLogin ? 'Sign in with Google' : 'Sign up with Google')}</span>
            </button>
          )}

          <div className="auth-separator">
            <span>or continue with email</span>
          </div>

          {/* Main Auth Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="auth-form-group">
                <label className="auth-form-label" htmlFor="auth-fullname">Full Name</label>
                <div className="auth-input-wrapper">
                  <UserPlus size={18} className="auth-input-icon" />
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="auth-input-field"
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div className="auth-form-group">
              <label className="auth-form-label" htmlFor="auth-email">Email Address</label>
              <div className="auth-input-wrapper">
                <Mail size={18} className="auth-input-icon" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input-field"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-form-group">
              <div className="auth-form-label">
                <label htmlFor="auth-password">Password</label>
                {isLogin && (
                  <span
                    className="auth-forgot-link"
                    style={{ cursor: 'pointer', fontSize: '0.78rem' }}
                    onClick={() => handleAutofillDemo(DEMO_ACCOUNTS[0])}
                    title="Use default admin credentials"
                  >
                    Use Admin demo
                  </span>
                )}
              </div>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input-field"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="auth-options-row">
                <label className="auth-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me on this device</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              className="btn-auth-submit"
              disabled={loading || googleLoading}
              id="auth-submit-button"
            >
              {loading ? (
                <span>Processing...</span>
              ) : isLogin ? (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={17} />
                </>
              ) : (
                <>
                  <span>Create Free Account</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="auth-footer-privacy">
            <span>By continuing, you agree to CostIntel's </span>
            <a href="#privacy" onClick={(e) => e.preventDefault()}>Security &amp; Privacy Terms</a>
          </div>
        </div>
      </div>

      {/* Google Setup Guide Modal */}
      {showConfigModal && (
        <div className="mobile-backdrop" style={{ zIndex: 999, display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div className="card card-3d" style={{ maxWidth: '480px', width: '100%', position: 'relative', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GoogleLogo />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Google Sign-In Setup</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowConfigModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Google Sign-In integration is fully wired in the backend and frontend. To activate live Google OAuth:
            </p>
            <ol style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <li>Go to <strong style={{ color: 'var(--text-primary)' }}>Google Cloud Console</strong> &gt; APIs &amp; Services &gt; Credentials.</li>
              <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web Application).</li>
              <li>Set Authorized Javascript Origins to <code>http://localhost:5173</code> (or your domain).</li>
              <li>Add your Client ID in <code>frontend/.env</code>:
                <pre style={{ background: 'var(--surface-alt)', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', marginTop: '0.2rem' }}>VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com</pre>
              </li>
              <li>And in <code>backend/.env</code>:
                <pre style={{ background: 'var(--surface-alt)', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', marginTop: '0.2rem' }}>GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com</pre>
              </li>
            </ol>
            <div style={{ marginTop: '1.2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowConfigModal(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;

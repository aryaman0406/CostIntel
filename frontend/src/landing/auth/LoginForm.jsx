/**
 * LoginForm — Glass-card login form with Google SSO, email/password, demo pills.
 * Reuses existing backend contract: POST /api/login, POST /api/auth/google
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Check, Zap } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
  </svg>
);

const DEMO_ACCOUNTS = [
  { role: 'Admin',   email: 'admin@costintel.com',   pass: 'Admin@123',   label: 'Full Access' },
  { role: 'Analyst', email: 'analyst@costintel.com', pass: 'Analyst@123', label: 'FinOps' },
  { role: 'Viewer',  email: 'viewer@costintel.com',  pass: 'Viewer@123',  label: 'Read-Only' },
];

export default function LoginForm({ onSuccess, onSwitchToSignup, prefillEmail = '' }) {
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [demoFilled, setDemoFilled] = useState('');

  const googleBtnRef = useRef(null);
  const errorRef     = useRef(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  // Google GSI init
  const handleGoogleResponse = useCallback(async (response) => {
    if (!response?.credential) { setError('Google Sign-In failed.'); return; }
    setGoogleLoading(true); setError('');
    try {
      const res = await axios.post(`${API_BASE}/auth/google`, { credential: response.credential }, { timeout: 15000 });
      if (res.data.status === 'success') {
        localStorage.setItem('access_token', res.data.data.access_token);
        onSuccess(res.data.data.access_token);
      } else {
        setError(res.data.message || 'Google login failed.'); triggerShake();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google login failed.'); triggerShake();
    } finally { setGoogleLoading(false); }
  }, [onSuccess]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const init = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline', size: 'large',
          width: googleBtnRef.current.offsetWidth || 380,
          text: 'signin_with', shape: 'rectangular',
        });
      }
    };
    if (!document.getElementById('google-gsi-script')) {
      const s = document.createElement('script');
      s.id = 'google-gsi-script'; s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true; s.onload = init;
      document.body.appendChild(s);
    } else { init(); }
  }, [handleGoogleResponse]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${API_BASE}/login`, { email, password }, { timeout: 15000 });
      if (res.data.status === 'success') {
        localStorage.setItem('access_token', res.data.data.access_token);
        onSuccess(res.data.data.access_token);
      } else {
        setError(res.data.message || 'Login failed.'); triggerShake();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials.'); triggerShake();
    } finally { setLoading(false); }
  };

  const autofillDemo = (acc) => {
    setEmail(acc.email); setPassword(acc.pass);
    setDemoFilled(acc.role); setError('');
    setTimeout(() => setDemoFilled(''), 2500);
  };

  return (
    <div className="lf-root">
      {/* Google SSO */}
      {GOOGLE_CLIENT_ID ? (
        <div className="lf-google-wrap" ref={googleBtnRef} />
      ) : (
        <button type="button" className="lf-google-btn" onClick={() => setError('Google not configured.')} disabled={googleLoading}>
          <GoogleIcon /><span>{googleLoading ? 'Connecting…' : 'Continue with Google'}</span>
        </button>
      )}

      <div className="lf-divider"><span>or continue with email</span></div>

      {/* Error */}
      {error && (
        <div
          className={`lf-error${shake ? ' lf-shake' : ''}`}
          role="alert"
          aria-live="assertive"
          ref={errorRef}
        >
          <AlertCircle size={15} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="lf-form" noValidate>
        <div className="lf-field">
          <label htmlFor="lf-email" className="lf-label">Email address</label>
          <div className="lf-input-wrap">
            <Mail size={16} className="lf-icon" aria-hidden="true" />
            <input
              id="lf-email"
              type="email"
              className="lf-input"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
              aria-required="true"
              inputMode="email"
            />
          </div>
        </div>

        <div className="lf-field">
          <label htmlFor="lf-password" className="lf-label">Password</label>
          <div className="lf-input-wrap">
            <Lock size={16} className="lf-icon" aria-hidden="true" />
            <input
              id="lf-password"
              type={showPw ? 'text' : 'password'}
              className="lf-input"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              aria-required="true"
            />
            <button
              type="button"
              className="lf-eye"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="lf-options-row">
          <label className="lf-remember">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
            <span>Remember me</span>
          </label>
        </div>

        <button
          type="submit"
          className="lf-submit"
          disabled={loading || googleLoading}
          id="lf-submit-btn"
        >
          {loading
            ? <span className="lf-spinner" aria-label="Signing in…" />
            : <><span>Sign In to Dashboard</span><ArrowRight size={16} aria-hidden="true" /></>
          }
        </button>
      </form>

      {/* Demo accounts */}
      <div className="lf-demo-section">
        <div className="lf-demo-header">
          <Zap size={13} aria-hidden="true" />
          <span>Try a demo as</span>
          {demoFilled && <span className="lf-demo-filled"><Check size={11} aria-hidden="true" />{demoFilled} filled</span>}
        </div>
        <div className="lf-demo-pills" role="group" aria-label="Demo account shortcuts">
          {DEMO_ACCOUNTS.map(acc => (
            <button
              key={acc.role}
              type="button"
              className="lf-demo-pill"
              onClick={() => autofillDemo(acc)}
              title={`Pre-fill ${acc.role} demo credentials (${acc.email})`}
              aria-label={`Fill demo credentials for ${acc.role}: ${acc.label}`}
            >
              <strong>{acc.role}</strong>
              <span>{acc.label}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="lf-switch">
        New here?{' '}
        <button type="button" className="lf-link" onClick={onSwitchToSignup}>
          Create an account
        </button>
      </p>
    </div>
  );
}

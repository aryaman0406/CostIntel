/**
 * SignupWizard — 3-step progressive signup modal.
 * Step 1: Account (Google or email+password)
 * Step 2: About you (full name, role note)
 * Step 3: Confirm + terms → success animation → redirect
 *
 * Backend contract: POST /api/register { email, password, full_name }
 * → always creates Viewer. Role picker deliberately omitted.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import {
  ArrowRight, ArrowLeft, AlertCircle, Check, CheckCircle2,
  Eye, EyeOff, User, Mail, Lock
} from 'lucide-react';

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

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ff5c7a', '#ffb547', '#38bdf8', '#2ee6a6'];
  return { score, label: labels[score], color: colors[score] };
}

export default function SignupWizard({ onSuccess, onSwitchToLogin, onOpenPrivacy, prefillEmail = '' }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [stepError, setStepError] = useState({});

  const googleBtnRef = useRef(null);
  const headingRef   = useRef(null);
  const liveRef      = useRef(null);

  const pw = passwordStrength(password);

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 600); };

  // Move focus to heading on step change for screen readers
  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
    setError('');
  }, [step]);

  // Google GSI
  const handleGoogleResponse = useCallback(async (response) => {
    if (!response?.credential) { setError('Google Sign-In failed.'); return; }
    setGoogleLoading(true); setError('');
    try {
      const res = await axios.post(`${API_BASE}/auth/google`, { credential: response.credential }, { timeout: 15000 });
      if (res.data.status === 'success') {
        localStorage.setItem('access_token', res.data.data.access_token);
        setSuccess(true);
        setTimeout(() => onSuccess(res.data.data.access_token), 1800);
      } else {
        setError(res.data.message || 'Google signup failed.'); triggerShake();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google signup failed.'); triggerShake();
    } finally { setGoogleLoading(false); }
  }, [onSuccess]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || step !== 1) return;
    const init = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline', size: 'large',
          width: googleBtnRef.current.offsetWidth || 380,
          text: 'signup_with', shape: 'rectangular',
        });
      }
    };
    if (window.google?.accounts?.id) init();
    else {
      const s = document.getElementById('google-gsi-script');
      if (s) s.onload = init;
    }
  }, [step, handleGoogleResponse]);

  const validateStep1 = () => {
    const errs = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Valid email required';
    if (!password || password.length < 8) errs.password = 'Min 8 characters';
    setStepError(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!fullName.trim() || fullName.trim().length < 2) errs.fullName = 'Full name required';
    setStepError(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (step === 1 && !validateStep1()) { triggerShake(); return; }
    if (step === 2 && !validateStep2()) { triggerShake(); return; }
    setStep(s => s + 1);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && step < 3) { e.preventDefault(); goNext(); } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) { setError('Please accept the terms to continue.'); triggerShake(); return; }
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${API_BASE}/register`,
        { email, password, full_name: fullName },
        { timeout: 15000 }
      );
      if (res.data.status === 'success' || res.status === 201) {
        // Auto-login after registration
        const loginRes = await axios.post(`${API_BASE}/login`, { email, password }, { timeout: 15000 });
        if (loginRes.data.status === 'success') {
          localStorage.setItem('access_token', loginRes.data.data.access_token);
          setSuccess(true);
          setTimeout(() => onSuccess(loginRes.data.data.access_token), 1800);
        } else {
          setError('Account created! Please sign in.'); triggerShake();
        }
      } else {
        const msg = res.data.message || 'Registration failed.';
        const fieldErrors = res.data.errors || {};
        const combined = Object.values(fieldErrors).join(' ') || msg;
        setError(combined); triggerShake();
      }
    } catch (err) {
      const data = err.response?.data || {};
      const fieldErrors = data.errors || {};
      const combined = Object.values(fieldErrors).join(' ') || data.message || 'Registration failed.';
      setError(combined); triggerShake();
    } finally { setLoading(false); }
  };

  // ─── SUCCESS SCREEN ───────────────────────────────────────────
  if (success) {
    return (
      <div className="sw-success">
        <div className="sw-check-circle">
          <CheckCircle2 size={48} aria-hidden="true" />
        </div>
        <h3>Welcome to CostIntel!</h3>
        <p>Redirecting to your dashboard…</p>
      </div>
    );
  }

  const STEP_LABELS = ['Account', 'About you', 'Confirm'];

  return (
    <div className={`sw-root${shake ? ' lf-shake' : ''}`} onKeyDown={handleKeyDown}>
      {/* Stepper */}
      <div className="sw-stepper" role="list">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          const isCurrent = s === step;
          const isDone    = s < step;
          return (
            <React.Fragment key={s}>
              <div
                className={`sw-step${isCurrent ? ' sw-step--current' : ''}${isDone ? ' sw-step--done' : ''}`}
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div className="sw-step-dot">
                  {isDone ? <Check size={12} aria-hidden="true" /> : <span>{s}</span>}
                </div>
                <span className="sw-step-label">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && <div className={`sw-step-line${isDone ? ' sw-step-line--done' : ''}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Live region for step announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" ref={liveRef}>
        Step {step} of 3: {STEP_LABELS[step - 1]}
      </div>

      {/* Error */}
      {error && (
        <div className="lf-error" role="alert" aria-live="assertive">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ── STEP 1: ACCOUNT ───── */}
      {step === 1 && (
        <div className="sw-step-content">
          <h3 ref={headingRef} tabIndex={-1} className="sw-step-heading">Create your account</h3>

          {GOOGLE_CLIENT_ID ? (
            <div className="lf-google-wrap" ref={googleBtnRef} />
          ) : (
            <button type="button" className="lf-google-btn" disabled={googleLoading}>
              <GoogleIcon /><span>Continue with Google</span>
            </button>
          )}

          <div className="lf-divider"><span>or with email</span></div>

          <div className="lf-field">
            <label htmlFor="sw-email" className="lf-label">Email address</label>
            <div className="lf-input-wrap">
              <Mail size={16} className="lf-icon" aria-hidden="true" />
              <input
                id="sw-email" type="email" className={`lf-input${stepError.email ? ' lf-input--error' : ''}`}
                placeholder="name@company.com" value={email}
                onChange={e => { setEmail(e.target.value); setStepError(p => ({...p, email: ''})); }}
                autoComplete="email" required aria-required="true" inputMode="email"
                aria-describedby={stepError.email ? 'sw-email-err' : undefined}
              />
            </div>
            {stepError.email && <span id="sw-email-err" className="lf-field-error" role="alert">{stepError.email}</span>}
          </div>

          <div className="lf-field">
            <label htmlFor="sw-password" className="lf-label">Password</label>
            <div className="lf-input-wrap">
              <Lock size={16} className="lf-icon" aria-hidden="true" />
              <input
                id="sw-password" type={showPw ? 'text' : 'password'}
                className={`lf-input${stepError.password ? ' lf-input--error' : ''}`}
                placeholder="Min 8 characters" value={password}
                onChange={e => { setPassword(e.target.value); setStepError(p => ({...p, password: ''})); }}
                autoComplete="new-password" required aria-required="true"
                aria-describedby="sw-pw-strength"
              />
              <button type="button" className="lf-eye" onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              </button>
            </div>
            {password && (
              <div id="sw-pw-strength" className="sw-strength" aria-live="polite">
                <div className="sw-strength-bar">
                  {[1,2,3,4].map(n => (
                    <div key={n} className="sw-strength-seg"
                      style={{ background: n <= pw.score ? pw.color : 'var(--l-border)' }} />
                  ))}
                </div>
                <span style={{ color: pw.color }}>{pw.label}</span>
              </div>
            )}
            {stepError.password && <span className="lf-field-error" role="alert">{stepError.password}</span>}
          </div>

          <button type="button" className="lf-submit" onClick={goNext}>
            <span>Continue</span><ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── STEP 2: ABOUT YOU ── */}
      {step === 2 && (
        <div className="sw-step-content">
          <h3 ref={headingRef} tabIndex={-1} className="sw-step-heading">Tell us about you</h3>

          <div className="lf-field">
            <label htmlFor="sw-name" className="lf-label">Full name</label>
            <div className="lf-input-wrap">
              <User size={16} className="lf-icon" aria-hidden="true" />
              <input
                id="sw-name" type="text"
                className={`lf-input${stepError.fullName ? ' lf-input--error' : ''}`}
                placeholder="Jane Doe" value={fullName}
                onChange={e => { setFullName(e.target.value); setStepError(p => ({...p, fullName: ''})); }}
                autoComplete="name" required aria-required="true"
              />
            </div>
            {stepError.fullName && <span className="lf-field-error" role="alert">{stepError.fullName}</span>}
          </div>

          <div className="sw-role-note" role="note">
            <div className="sw-role-note-icon">ℹ</div>
            <p>All new accounts start as <strong>Viewer</strong>. Your admin can grant Analyst or Admin access once you're in.</p>
          </div>

          <div className="sw-nav-row">
            <button type="button" className="lf-back" onClick={() => setStep(1)}>
              <ArrowLeft size={16} aria-hidden="true" /><span>Back</span>
            </button>
            <button type="button" className="lf-submit sw-submit-grow" onClick={goNext}>
              <span>Continue</span><ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: CONFIRM ──── */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="sw-step-content" noValidate>
          <h3 ref={headingRef} tabIndex={-1} className="sw-step-heading">Almost there!</h3>

          <div className="sw-summary">
            <div className="sw-summary-row"><span>Email</span><strong>{email}</strong></div>
            <div className="sw-summary-row"><span>Name</span><strong>{fullName}</strong></div>
            <div className="sw-summary-row"><span>Role</span><strong>Viewer (default)</strong></div>
          </div>

          <label className="sw-terms-label">
            <input
              type="checkbox" checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              aria-required="true"
            />
            <span>
              I agree to CostIntel's{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (onOpenPrivacy) onOpenPrivacy();
                }}
                className="lf-link"
                style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
              >
                Security &amp; Privacy Terms
              </button>
            </span>
          </label>

          <div className="sw-nav-row">
            <button type="button" className="lf-back" onClick={() => setStep(2)}>
              <ArrowLeft size={16} aria-hidden="true" /><span>Back</span>
            </button>
            <button type="submit" className="lf-submit sw-submit-grow" disabled={loading || !agreed} id="sw-create-btn">
              {loading
                ? <span className="lf-spinner" aria-label="Creating account…" />
                : <><span>Create account</span><ArrowRight size={16} aria-hidden="true" /></>
              }
            </button>
          </div>
        </form>
      )}

      <p className="lf-switch">
        Already have an account?{' '}
        <button type="button" className="lf-link" onClick={onSwitchToLogin}>Sign in</button>
      </p>
    </div>
  );
}

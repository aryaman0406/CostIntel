/**
 * LandingPage — Top-level orchestrator for the CostIntel public landing page.
 * Responsibilities:
 *   - Initialise Lenis smooth scroll (exposes window.__lenis for auth modal pause)
 *   - Read ?modal=login|signup and ?redirect= query params → auto-open modal
 *   - Theme state management (dark/light, persisted in localStorage)
 *   - Auth modal open/close state + mode switching
 *   - Post-login redirect: save token → navigate to redirect path or '/'
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Lenis from 'lenis';

import './LandingPage.css';

import Navbar            from './components/Navbar';
import CustomCursor      from './components/CustomCursor';
import AuthModal         from './auth/AuthModal';
import PrivacyModal      from './components/PrivacyModal';

import Hero              from './sections/Hero';
import ProblemsStrip     from './sections/ProblemsStrip';
import Features          from './sections/Features';
import HowItWorks        from './sections/HowItWorks';
import FinalCTA          from './sections/FinalCTA';
import Footer            from './sections/Footer';

// ── Theme helpers ──────────────────────────────────────────────
function getInitialTheme() {
  try { return localStorage.getItem('theme') || 'dark'; } catch { return 'dark'; }
}

function setDocumentTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* storage unavailable */
  }
}

export default function LandingPage({ onAuthSuccess }) {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();

  // Determine if user is already authenticated
  const existingToken  = (() => { try { return localStorage.getItem('access_token'); } catch { return null; } })();

  // Theme
  const [theme, setTheme]               = useState(getInitialTheme);
  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      setDocumentTheme(next);
      return next;
    });
  }, []);
  useEffect(() => { setDocumentTheme(theme); }, [theme]);

  // Auth modal state
  const redirectPath   = params.get('redirect') || '/';
  const initialModal   = params.get('modal');   // 'login' | 'signup' | null
  const initialEmail   = params.get('email')  || '';

  const [modalOpen,    setModalOpen]    = useState(!!initialModal);
  const [modalMode,    setModalMode]    = useState(initialModal === 'signup' ? 'signup' : 'login');
  const [prefillEmail, setPrefillEmail] = useState(initialEmail);
  const [privacyOpen,  setPrivacyOpen]  = useState(false);

  const openLogin   = useCallback(() => { setModalMode('login');  setModalOpen(true); }, []);
  const openSignup  = useCallback((email = '') => {
    const cleanEmail = typeof email === 'string' ? email : '';
    setPrefillEmail(cleanEmail);
    setModalMode('signup');
    setModalOpen(true);
  }, []);
  const closeModal  = useCallback(() => {
    setModalOpen(false);
    setPrefillEmail('');
    // Clean modal param from URL without navigation
    const url = new URL(window.location);
    url.searchParams.delete('modal');
    url.searchParams.delete('redirect');
    url.searchParams.delete('email');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const openPrivacy  = useCallback(() => setPrivacyOpen(true), []);
  const closePrivacy = useCallback(() => setPrivacyOpen(false), []);

  const handleAuthSuccess = useCallback((token) => {
    // Token is already stored by LoginForm/SignupWizard
    if (token) localStorage.setItem('access_token', token);
    setModalOpen(false);
    if (onAuthSuccess && token) {
      onAuthSuccess(token);
    }
    // Brief delay so the success animation finishes
    setTimeout(() => navigate(redirectPath === '/' ? '/' : redirectPath, { replace: true }), 400);
  }, [navigate, onAuthSuccess, redirectPath]);

  const handleModeChange = useCallback((mode) => {
    setModalMode(mode);
  }, []);

  const goToDashboard = useCallback(() => {
    const t = localStorage.getItem('access_token');
    if (onAuthSuccess && t) {
      onAuthSuccess(t);
    }
    navigate('/', { replace: true });
  }, [navigate, onAuthSuccess]);

  // Custom cursor
  const [cursorDisabled, setCursorDisabled] = useState(() => {
    try { return localStorage.getItem('cursor_disabled') === 'true'; } catch { return false; }
  });
  const toggleCursor = useCallback(() => {
    setCursorDisabled(v => {
      const next = !v;
      try {
        localStorage.setItem('cursor_disabled', String(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  // Lenis smooth scroll initialisation
  const lenisRef = useRef(null);
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration:   1.1,
      easing:     (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    });

    window.__lenis = lenis;
    lenisRef.current = lenis;

    let rafId;
    const raf = (time) => { lenis.raf(time); rafId = requestAnimationFrame(raf); };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      window.__lenis = null;
    };
  }, []);

  // Pause / resume Lenis when modal opens/closes
  useEffect(() => {
    const lenis = window.__lenis;
    if (!lenis) return;
    if (modalOpen || privacyOpen) lenis.stop();
    else lenis.start();
  }, [modalOpen, privacyOpen]);

  return (
    <div className="landing-page" id="landing-root">
      {/* Skip link rendered inside Navbar */}

      <CustomCursor disabled={cursorDisabled} />

      <Navbar
        token={existingToken}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenLogin={openLogin}
        onOpenSignup={openSignup}
        onGoToDashboard={goToDashboard}
      />

      <main id="main-content">
        <Hero
          onOpenSignup={openSignup}
          onOpenLogin={openLogin}
        />

        <ProblemsStrip />

        <Features
          onOpenSignup={openSignup}
        />

        <HowItWorks />

        <FinalCTA
          onOpenSignup={openSignup}
          onOpenLogin={openLogin}
        />
      </main>

      <Footer
        onOpenSignup={openSignup}
        onOpenPrivacy={openPrivacy}
        cursorDisabled={cursorDisabled}
        onToggleCursor={toggleCursor}
      />

      {/* Auth modal — rendered as portal to <body> */}
      {modalOpen && (
        <AuthModal
          mode={modalMode}
          onClose={closeModal}
          onSuccess={handleAuthSuccess}
          onModeChange={handleModeChange}
          onOpenPrivacy={openPrivacy}
          prefillEmail={prefillEmail}
        />
      )}

      {/* Privacy & Security Notice Modal */}
      <PrivacyModal
        isOpen={privacyOpen}
        onClose={closePrivacy}
      />
    </div>
  );
}

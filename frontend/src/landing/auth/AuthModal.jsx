/**
 * AuthModal — Glass dialog modal containing LoginForm or SignupWizard.
 * - role="dialog", aria-modal="true", aria-labelledby
 * - Focus trapped inside, Esc closes, backdrop click closes
 * - Focus returns to trigger element on close
 * - Pauses Lenis while open
 * - Full-screen sheet on mobile, centered card on desktop
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import LoginForm from './LoginForm';
import SignupWizard from './SignupWizard';

// Focus-trapping utility
function trapFocus(container) {
  const focusables = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return () => {};
  const first = focusables[0];
  const last  = focusables[focusables.length - 1];

  const handler = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  };
  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}

export default function AuthModal({
  mode,           // 'login' | 'signup'
  onClose,
  onSuccess,      // (token) => void
  onModeChange,   // ('login' | 'signup') => void
  onOpenPrivacy,
  prefillEmail = '',
}) {
  const dialogRef    = useRef(null);
  const triggerRef   = useRef(document.activeElement);
  const titleId      = 'auth-modal-title';

  // Lock body scroll + pause Lenis
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Pause Lenis if present
    const lenis = window.__lenis;
    if (lenis) lenis.stop();

    return () => {
      document.body.style.overflow = prev;
      if (lenis) lenis.start();
    };
  }, []);

  // Focus management + trap
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Move focus into modal
    const firstFocusable = dialog.querySelector(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) firstFocusable.focus();

    const cleanupTrap = trapFocus(dialog);
    return cleanupTrap;
  }, [mode]);

  // Close on Esc
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    const triggerEl = triggerRef.current;
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to trigger
      if (triggerEl && typeof triggerEl.focus === 'function') {
        triggerEl.focus();
      }
    };
  }, [handleKeyDown]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSuccess = (token) => {
    onClose();
    onSuccess(token);
  };

  const modal = (
    <div
      className="am-backdrop"
      onClick={handleBackdropClick}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="am-dialog"
      >
        {/* Header */}
        <div className="am-header">
          <div className="am-header-brand">
            <div className="am-logo-dot" aria-hidden="true" />
            <span className="am-logo-text">CostIntel</span>
          </div>
          <div className="am-tab-switch" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={`am-tab${mode === 'login' ? ' am-tab--active' : ''}`}
              onClick={() => onModeChange('login')}
              id="am-tab-login"
            >
              Sign In
            </button>
            <button
              role="tab"
              aria-selected={mode === 'signup'}
              className={`am-tab${mode === 'signup' ? ' am-tab--active' : ''}`}
              onClick={() => onModeChange('signup')}
              id="am-tab-signup"
            >
              Sign Up
            </button>
          </div>
          <button
            className="am-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Title (sr-only when we have visual tabs) */}
        <h2 id={titleId} className="sr-only">
          {mode === 'login' ? 'Sign in to CostIntel' : 'Create a CostIntel account'}
        </h2>

        {/* Body */}
        <div className="am-body">
          {mode === 'login' ? (
            <LoginForm
              onSuccess={handleSuccess}
              onSwitchToSignup={() => onModeChange('signup')}
              prefillEmail={prefillEmail}
            />
          ) : (
            <SignupWizard
              onSuccess={handleSuccess}
              onSwitchToLogin={() => onModeChange('login')}
              onOpenPrivacy={onOpenPrivacy}
              prefillEmail={prefillEmail}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

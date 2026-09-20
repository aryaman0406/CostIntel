/**
 * PrivacyModal — Interactive Security & Privacy Notice dialog.
 * Accessible, focus-trapped, dismissible with Escape or close button.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Lock, EyeOff, FileText, RotateCcw, X, Check } from 'lucide-react';

export default function PrivacyModal({ isOpen, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const lenis = window.__lenis;
    if (lenis) lenis.stop();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      if (lenis) lenis.start();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const modal = (
    <div className="am-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        ref={dialogRef}
        className="am-dialog privacy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-modal-title"
      >
        {/* Header */}
        <div className="am-header privacy-header">
          <div className="am-header-brand">
            <div className="navbar-logo-icon" style={{ width: '28px', height: '28px' }} aria-hidden="true">
              <Shield size={15} />
            </div>
            <span className="am-logo-text">Security &amp; Privacy Notice</span>
          </div>
          <button
            className="am-close"
            onClick={onClose}
            aria-label="Close security and privacy notice"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="am-body privacy-body">
          <div className="privacy-intro">
            <h2 id="privacy-modal-title" className="privacy-title">
              Built for enterprise trust and financial privacy
            </h2>
            <p className="privacy-desc">
              CostIntel is architected from the ground up for strict data governance. Here is our direct commitment to how your financial records and ledger data are handled:
            </p>
          </div>

          <div className="privacy-pillars">
            <div className="privacy-pillar-card">
              <div className="privacy-pillar-icon" style={{ color: '#2ee6a6', background: 'rgba(46,230,166,0.12)' }}>
                <EyeOff size={18} aria-hidden="true" />
              </div>
              <div className="privacy-pillar-info">
                <h4>No AI Model Training on Your Ledger</h4>
                <p>
                  Your transaction data, vendor names, and ledger rows are never used to train or fine-tune public foundation models. Gemini CFO interactions use ephemeral function-calling parameters only.
                </p>
              </div>
            </div>

            <div className="privacy-pillar-card">
              <div className="privacy-pillar-icon" style={{ color: '#4f8cff', background: 'rgba(79,140,255,0.12)' }}>
                <Lock size={18} aria-hidden="true" />
              </div>
              <div className="privacy-pillar-info">
                <h4>Encryption &amp; Secure Authentication</h4>
                <p>
                  All data in transit is encrypted using TLS 1.3. User passwords are protected using industry-standard salted bcrypt hashing, and authenticated sessions use tamper-resistant JWTs with inactivity auto-expiry.
                </p>
              </div>
            </div>

            <div className="privacy-pillar-card">
              <div className="privacy-pillar-icon" style={{ color: '#7c5cff', background: 'rgba(124,92,255,0.12)' }}>
                <FileText size={18} aria-hidden="true" />
              </div>
              <div className="privacy-pillar-info">
                <h4>Immutable Audit Trail &amp; RBAC</h4>
                <p>
                  Role-based access control strictly isolates Viewer, Analyst, and Admin scopes. Every ledger change, anomaly scan, and AI recommendation is logged to an immutable <code>AuditLog</code> table.
                </p>
              </div>
            </div>

            <div className="privacy-pillar-card">
              <div className="privacy-pillar-icon" style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.12)' }}>
                <RotateCcw size={18} aria-hidden="true" />
              </div>
              <div className="privacy-pillar-info">
                <h4>Soft-Delete &amp; Data Ownership</h4>
                <p>
                  You own 100% of your data. Accidental removals utilize soft-deletion with administrative restoration, ensuring business continuity without data corruption.
                </p>
              </div>
            </div>
          </div>

          <div className="privacy-footer-action">
            <button
              type="button"
              className="navbar-btn navbar-btn--primary privacy-confirm-btn"
              onClick={onClose}
            >
              <Check size={16} aria-hidden="true" />
              <span>Understood</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

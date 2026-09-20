/**
 * Footer — Logo, nav links, Privacy Terms, optional newsletter (feature-flagged),
 * config-driven social icons, copyright.
 */
import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { navLinks } from '../../content/navLinks';
import { socialLinks } from '../../content/social';

const NEWSLETTER_ENABLED = import.meta.env.VITE_NEWSLETTER_ENABLED === 'true';

function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg('Please enter a valid email.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
        setMsg('Thanks! You\'re on the list.');
        setEmail('');
      } else {
        setStatus('error');
        setMsg('Something went wrong. Try again.');
      }
    } catch {
      setStatus('error');
      setMsg('Network error. Try again.');
    }
  };

  if (status === 'success') {
    return <p className="footer-nl-success" role="status">{msg}</p>;
  }

  return (
    <form className="footer-nl-form" onSubmit={handleSubmit} aria-label="Newsletter signup">
      <label htmlFor="footer-nl-email" className="sr-only">Email for newsletter</label>
      <div className="footer-nl-row">
        <input
          id="footer-nl-email"
          type="email"
          className="footer-nl-input"
          placeholder="your@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setStatus('idle'); setMsg(''); }}
          autoComplete="email"
          aria-label="Email for newsletter"
          inputMode="email"
        />
        <button type="submit" className="footer-nl-btn" disabled={status === 'loading'}>
          {status === 'loading' ? '…' : 'Subscribe'}
        </button>
      </div>
      {status === 'error' && <p className="footer-nl-error" role="alert">{msg}</p>}
    </form>
  );
}

const SOCIAL_ICONS = {
  twitter: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  linkedin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  github: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
};

export default function Footer({ onOpenPrivacy, cursorDisabled, onToggleCursor }) {
  const year = new Date().getFullYear();

  const scrollTo = (href) => {
    if (href.startsWith('#')) {
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      const lenis = window.__lenis;
      const headerH = 72;
      if (lenis) {
        lenis.scrollTo(el, { offset: -headerH, duration: 1.1 });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      window.history.replaceState(null, '', href);
    }
  };

  return (
    <footer className="footer" role="contentinfo">
      <div className="section-inner footer-inner">
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <div className="footer-logo">
              <Shield size={18} aria-hidden="true" />
              <span>CostIntel</span>
            </div>
            <p className="footer-tagline">
              Autonomous Cost Governance & AI FinOps Controller for finance teams.
            </p>
            {/* Social icons — renders nothing if socialLinks is empty */}
            {socialLinks.length > 0 && (
              <div className="footer-social" aria-label="Social links">
                {socialLinks.map(link => (
                  <a
                    key={link.platform}
                    href={link.url}
                    aria-label={link.label || `CostIntel on ${link.platform}`}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="footer-social-link"
                  >
                    {SOCIAL_ICONS[link.platform] || link.platform}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="footer-nav" aria-label="Footer navigation">
            <h4 className="footer-nav-heading">Navigation</h4>
            <ul className="footer-nav-list">
              {navLinks.map(link => (
                <li key={link.href}>
                  <button
                    type="button"
                    className="footer-nav-link"
                    onClick={() => scrollTo(link.href)}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <div className="footer-legal-col">
            <h4 className="footer-nav-heading">Legal</h4>
            <ul className="footer-nav-list">
              <li>
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="footer-nav-link"
                  aria-label="Open Security & Privacy Notice"
                >
                  Security &amp; Privacy Notice
                </button>
              </li>
            </ul>
          </div>

          {/* Newsletter — hidden unless VITE_NEWSLETTER_ENABLED=true */}
          {NEWSLETTER_ENABLED && (
            <div className="footer-nl-col">
              <h4 className="footer-nav-heading">Stay updated</h4>
              <Newsletter />
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <p className="footer-copy">© {year} CostIntel. All rights reserved.</p>
          <div className="footer-bottom-links">
            {/* Custom cursor toggle */}
            <button
              type="button"
              className="footer-cursor-toggle"
              onClick={onToggleCursor}
              aria-pressed={cursorDisabled}
              aria-label={cursorDisabled ? 'Enable custom cursor' : 'Disable custom cursor'}
            >
              {cursorDisabled ? 'Enable custom cursor' : 'Disable custom cursor'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

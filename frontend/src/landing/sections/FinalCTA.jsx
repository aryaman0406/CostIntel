/**
 * FinalCTA — Full-width glow banner with email capture.
 * Submitting opens signup modal with email pre-filled.
 */
import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Reveal from '../components/Reveal';

export default function FinalCTA({ onOpenSignup, onOpenLogin }) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    onOpenSignup(email);
    setEmail('');
    setTouched(false);
  };

  return (
    <section id="get-started" aria-labelledby="cta-heading" className="cta-section">
      {/* Glow bg */}
      <div className="cta-glow" aria-hidden="true" />

      <div className="section-inner cta-inner">
        <Reveal variant="scale" delay={0}>
          <div className="cta-card">
            <div className="cta-eyebrow">Ready when you are</div>
            <h2 id="cta-heading" className="cta-heading">
              Stop chasing mismatches.<br />
              <span className="cta-heading-grad">Let the controller do it.</span>
            </h2>
            <p className="cta-sub">
              Get started in minutes. No CSV too messy. No anomaly too subtle.
            </p>

            <form className="cta-form" onSubmit={handleSubmit} noValidate aria-label="Start sign-up form">
              <div className="cta-input-wrap">
                <input
                  type="email"
                  className={`cta-input${touched && !isValid ? ' cta-input--error' : ''}`}
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setTouched(false); }}
                  onBlur={() => setTouched(true)}
                  autoComplete="email"
                  aria-label="Your email address"
                  aria-describedby={touched && !isValid ? 'cta-email-err' : undefined}
                  inputMode="email"
                />
                <button type="submit" className="cta-submit-btn" aria-label="Get started with CostIntel">
                  <span>Get Started</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
              {touched && !isValid && (
                <span id="cta-email-err" className="cta-email-error" role="alert">
                  Please enter a valid email address.
                </span>
              )}
            </form>

            <p className="cta-login-link">
              Already have an account?{' '}
              <button type="button" className="lf-link" onClick={onOpenLogin}>Log in</button>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

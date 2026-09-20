/**
 * Navbar — Sticky glass nav with scroll-spy, theme toggle, auth buttons.
 * Mobile: hamburger + focus-trapped drawer.
 * Authenticated: shows "Go to Dashboard" instead of Log In / Sign Up.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Sun, Moon, Menu, X } from 'lucide-react';
import { navLinks } from '../../content/navLinks';
import ScrollProgress from './ScrollProgress';

export default function Navbar({ token, theme, toggleTheme, onOpenLogin, onOpenSignup, onGoToDashboard }) {
  const [scrolled, setScrolled] = useState(false);
  const [overHero, setOverHero] = useState(true);
  const [activeSection, setActiveSection] = useState('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef(null);
  const hamburgerRef = useRef(null);

  const closeDrawer = () => {
    setMobileOpen(false);
    hamburgerRef.current?.focus();
  };

  // Scroll solidification & over-hero detection
  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const heroThreshold = (window.innerHeight || 800) - 80;
      setScrolled(scrollY > 40);
      setOverHero(scrollY < heroThreshold);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const lenis = window.__lenis;
    if (lenis) {
      lenis.on('scroll', onScroll);
    }
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (lenis) lenis.off('scroll', onScroll);
    };
  }, []);

  // High-precision scroll-spy based on real-time viewport section positions
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // When at the top of the page, always activate 'home'
      if (scrollY < 160) {
        setActiveSection('home');
        return;
      }

      // When reaching the bottom of the page, activate 'get-started'
      if (windowHeight + scrollY >= docHeight - 80) {
        setActiveSection('get-started');
        return;
      }

      const sectionIds = navLinks.map(l => l.href.replace('#', '')).filter(Boolean);
      const headerThreshold = 140; // Trigger threshold below sticky navbar

      let activeId = 'home';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= headerThreshold) {
            activeId = id;
          }
        }
      }
      setActiveSection(activeId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const lenis = window.__lenis;
    if (lenis) {
      lenis.on('scroll', handleScroll);
    }

    handleScroll(); // Initial check on mount

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (lenis) lenis.off('scroll', handleScroll);
    };
  }, []);

  // Focus trap in mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusables = drawer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length) focusables[0].focus();

    const handler = (e) => {
      if (e.key === 'Escape') closeDrawer();
      if (e.key !== 'Tab') return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last)  { e.preventDefault(); first.focus(); }
    };
    drawer.addEventListener('keydown', handler);
    return () => drawer.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  const scrollToSection = (href) => {
    setMobileOpen(false);
    const id = href.replace('#', '');
    setActiveSection(id);
    const el = document.getElementById(id);
    if (!el) return;
    const lenis = window.__lenis;
    const headerH = 72;
    if (lenis) {
      lenis.scrollTo(el, { offset: -headerH, duration: 1.1 });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Update URL hash and move focus for screen readers
    window.history.replaceState(null, '', href);
    setTimeout(() => {
      const heading = el.querySelector('h1,h2,h3,[tabindex="-1"]');
      if (heading) heading.focus({ preventScroll: true });
    }, 600);
  };

  return (
    <>
      {/* Skip to content */}
      <a href="#home" className="skip-link" onClick={e => { e.preventDefault(); scrollToSection('#home'); }}>
        Skip to content
      </a>

      <header
        className={`navbar${scrolled ? ' navbar--solid' : ''}${overHero ? ' navbar--over-hero' : ''}`}
        data-over-hero={overHero ? 'true' : 'false'}
        role="banner"
      >
        {/* Logo */}
        <div className="navbar-logo" onClick={() => scrollToSection('#home')} role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && scrollToSection('#home')} aria-label="CostIntel — scroll to top">
          <div className="navbar-logo-icon" aria-hidden="true">
            <Shield size={16} />
          </div>
          <span className="navbar-logo-text">CostIntel</span>
        </div>

        {/* Center nav */}
        <nav className="navbar-links" aria-label="Primary">
          {navLinks.map(link => {
            const id = link.href.replace('#', '');
            const isActive = activeSection === id;
            return (
              <button
                key={link.href}
                className={`navbar-link${isActive ? ' navbar-link--active' : ''}`}
                onClick={() => scrollToSection(link.href)}
                aria-current={isActive ? 'true' : undefined}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="navbar-actions">
          <button
            className="navbar-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-pressed={theme === 'light'}
          >
            {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>

          {token ? (
            <button className="navbar-btn navbar-btn--primary" onClick={onGoToDashboard} id="nav-dashboard-btn">
              Go to Dashboard
            </button>
          ) : (
            <>
              <button className="navbar-btn navbar-btn--outline" onClick={onOpenLogin} id="nav-login-btn">
                Log In
              </button>
              <button className="navbar-btn navbar-btn--primary" onClick={() => onOpenSignup('')} id="nav-signup-btn">
                Sign Up
              </button>
            </>
          )}

          {/* Hamburger */}
          <button
            ref={hamburgerRef}
            className="navbar-hamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-drawer"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>

        {/* Scroll progress */}
        <ScrollProgress />
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={closeDrawer} aria-hidden="true" />
      )}
      <div
        id="mobile-drawer"
        ref={drawerRef}
        className={`mobile-drawer${mobileOpen ? ' mobile-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!mobileOpen}
      >
        <div className="mobile-drawer-header">
          <span className="navbar-logo-text">CostIntel</span>
          <button className="mobile-drawer-close" onClick={closeDrawer} aria-label="Close navigation menu">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="mobile-drawer-nav" aria-label="Mobile navigation">
          {navLinks.map(link => (
            <button
              key={link.href}
              className="mobile-drawer-link"
              onClick={() => scrollToSection(link.href)}
            >
              {link.label}
            </button>
          ))}
        </nav>
        <div className="mobile-drawer-footer">
          <button
            className="navbar-theme-toggle"
            onClick={() => { toggleTheme(); }}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          {!token && (
            <button className="navbar-btn navbar-btn--outline" onClick={() => { closeDrawer(); onOpenLogin(); }}>
              Log In
            </button>
          )}
          {token && (
            <button className="navbar-btn navbar-btn--primary" onClick={() => { closeDrawer(); onGoToDashboard(); }}>
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </>
  );
}

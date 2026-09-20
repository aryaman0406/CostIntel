/**
 * Hero Section — Full-screen cinematic video hero for CostIntel.
 * Features:
 * - Full-bleed background video with dark scrim & film grain (HeroBackdrop)
 * - Animated "CostIntel" wordmark reveal with letter-split & light sweep (Wordmark)
 * - High-contrast centered column: Eyebrow, Tagline, Subheadline, CTAs, Dark Glass Proof Chips
 * - Scroll-driven scrub: hero recedes into background as user scrolls down
 * - ScrollCue indicator at bottom center
 * - Accessible video pause/play toggle at bottom right
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import HeroBackdrop from './hero/HeroBackdrop';
import Wordmark from './hero/Wordmark';
import ScrollCue from './hero/ScrollCue';
import { heroContent } from '../../content/hero';

export default function Hero({ onOpenSignup }) {
  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const scrollCueRef = useRef(null);

  const [isHeroVisible, setIsHeroVisible] = useState(true);

  // IntersectionObserver to detect if hero is in view & control video
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeroVisible(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  // Scroll scrub: hero content recedes as user scrolls down
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const heroH = window.innerHeight;

      if (scrollY <= 10) {
        if (contentRef.current) {
          contentRef.current.style.transform = 'translate3d(0, 0px, 0) scale(1)';
          contentRef.current.style.opacity = '1';
        }
        if (scrollCueRef.current) {
          scrollCueRef.current.style.opacity = '1';
          scrollCueRef.current.style.pointerEvents = 'auto';
        }
        return;
      }

      if (scrollY > heroH * 1.5) return;

      const progress = Math.min(1, Math.max(0, scrollY / (heroH * 0.85)));

      // Content recedes: translateY(0 -> -40px), scale(1 -> 0.96), opacity(1 -> 0)
      if (contentRef.current) {
        const translateY = -progress * 40;
        const scale = 1 - progress * 0.04;
        const opacity = Math.max(0, 1 - progress * 1.3);
        contentRef.current.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
        contentRef.current.style.opacity = opacity;
      }

      // Scroll cue fades out immediately on scroll
      if (scrollCueRef.current) {
        const cueOpacity = Math.max(0, 1 - progress * 4);
        scrollCueRef.current.style.opacity = cueOpacity;
        scrollCueRef.current.style.pointerEvents = progress > 0.1 ? 'none' : 'auto';
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const lenis = window.__lenis;
    if (lenis) {
      lenis.on('scroll', handleScroll);
    }
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (lenis) lenis.off('scroll', handleScroll);
    };
  }, []);

  const scrollToFeatures = () => {
    const el = document.getElementById('features');
    if (!el) return;
    const lenis = window.__lenis;
    const headerH = 72;
    if (lenis) {
      lenis.scrollTo(el, { offset: -headerH, duration: 1.1 });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToProblems = () => {
    const nextSection = document.querySelector('.problems-section') || document.getElementById('features');
    if (!nextSection) return;
    const lenis = window.__lenis;
    const headerH = 72;
    if (lenis) {
      lenis.scrollTo(nextSection, { offset: -headerH, duration: 1.1 });
    } else {
      nextSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="home" ref={heroRef} className="hero-cinematic-section" aria-label="CostIntel Hero">
      {/* 1. Full-bleed video backdrop + dark scrim + accessibility toggle */}
      <HeroBackdrop isHeroVisible={isHeroVisible} containerRef={heroRef} />

      {/* 2. Centered Content Stack */}
      <div className="hero-cinematic-inner">
        <div ref={contentRef} className="hero-cinematic-content">
          {/* Eyebrow Chip */}
          <div className="hero-cinematic-eyebrow">
            <span className="hero-eyebrow-dot" aria-hidden="true" />
            <span>{heroContent.eyebrow}</span>
          </div>

          {/* Large Wordmark: CostIntel */}
          <Wordmark />

          {/* Tagline */}
          <p className="hero-cinematic-tagline">
            <span>{heroContent.taglineFirstHalf}</span>
            <span className="hero-tagline--grad">{heroContent.taglineSecondHalf}</span>
          </p>

          {/* Subheadline */}
          <p className="hero-cinematic-sub">
            {heroContent.subheadline}
          </p>

          {/* Action CTAs */}
          <div className="hero-cinematic-ctas">
            <button
              type="button"
              className="hero-cta-primary hero-btn-cinematic-primary"
              onClick={() => onOpenSignup('')}
              id="hero-signup-btn"
              aria-label="Get started — open signup"
            >
              <span>{heroContent.ctaPrimary}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hero-cta-secondary hero-btn-cinematic-glass"
              onClick={scrollToFeatures}
              aria-label="Learn more — scroll to features"
            >
              <span>{heroContent.ctaSecondary}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </button>
          </div>

          {/* Dark Glass Proof Chips (1 row on desktop, 2x2 on mobile) */}
          <div className="hero-cinematic-proof" role="list" aria-label="Platform highlights">
            {heroContent.proofChips.map(({ stat, label }) => (
              <div
                key={stat}
                className="hero-glass-chip"
                role="listitem"
              >
                <span className="hero-chip-stat">{stat}</span>
                <span className="hero-chip-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Bottom Scroll Cue */}
      <div ref={scrollCueRef} className="hero-scroll-cue-wrap">
        <ScrollCue onScrollClick={scrollToProblems} />
      </div>
    </section>
  );
}


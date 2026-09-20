/**
 * ScrollCue — Animated bottom-center scroll indicator with "Scroll" label.
 * Smooth-scrolls to the next section when clicked.
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function ScrollCue({ onScrollClick }) {
  const handleClick = (e) => {
    e.preventDefault();
    if (onScrollClick) {
      onScrollClick();
    } else {
      const nextSection = document.querySelector('.problems-section') || document.getElementById('features');
      if (nextSection) {
        const lenis = window.__lenis;
        const headerH = 72;
        if (lenis) {
          lenis.scrollTo(nextSection, { offset: -headerH, duration: 1.1 });
        } else {
          nextSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <button
      type="button"
      className="hero-scroll-cue-btn"
      onClick={handleClick}
      aria-label="Scroll to next section"
    >
      <span className="hero-scroll-cue-text">Scroll</span>
      <ChevronDown size={16} className="hero-scroll-cue-icon" aria-hidden="true" />
    </button>
  );
}

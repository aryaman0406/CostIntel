/**
 * ScrollProgress — 3px gradient bar fixed at bottom edge of the header.
 * Scales scaleX(0→1) based on scroll progress. aria-hidden decorative.
 */
import React, { useEffect, useState } from 'react';

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop || document.body.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? scrolled / total : 0);
    };

    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '3px',
        background: 'var(--grad-brand)',
        transformOrigin: 'left center',
        transform: `scaleX(${progress})`,
        transition: 'transform 60ms linear',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}

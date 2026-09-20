/**
 * Reveal — Universal scroll-reveal wrapper.
 * Uses IntersectionObserver + CSS custom properties.
 * Falls back: content always visible if JS/observer is unavailable.
 *
 * Props:
 *   variant  : 'pop' | 'slideLeft' | 'slideRight' | 'scale' (default: 'pop')
 *   delay    : number (ms, default: 0)
 *   threshold: number (0–1, default: 0.15)
 *   as       : string (element tag, default: 'div')
 *   className: string
 *   children : ReactNode
 */

import React, { useRef, useEffect } from 'react';

const VARIANTS = {
  pop:        { opacity: 0, transform: 'translateY(28px) scale(0.92)', filter: 'blur(0px)' },
  slideLeft:  { opacity: 0, transform: 'translateX(-40px) scale(0.96)' },
  slideRight: { opacity: 0, transform: 'translateX(40px) scale(0.96)' },
  scale:      { opacity: 0, transform: 'scale(0.88)' },
  fade:       { opacity: 0, transform: 'translateY(12px)' },
};

const EASING = {
  pop:        'cubic-bezier(0.34, 1.56, 0.64, 1)',
  slideLeft:  'cubic-bezier(0.22, 1, 0.36, 1)',
  slideRight: 'cubic-bezier(0.22, 1, 0.36, 1)',
  scale:      'cubic-bezier(0.34, 1.56, 0.64, 1)',
  fade:       'cubic-bezier(0.22, 1, 0.36, 1)',
};

export default function Reveal({
  children,
  variant = 'pop',
  delay = 0,
  threshold = 0.12,
  duration = 650,
  className = '',
  style = {},
  ...props
}) {
  const ref = useRef(null);

  // Respect prefers-reduced-motion — use fade instead of rich animation
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const effectiveVariant = prefersReduced ? 'fade' : variant;
  const effectiveDuration = prefersReduced ? 350 : duration;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    // Reserve space — start invisible but layout is already correct
    const initial = VARIANTS[effectiveVariant];
    Object.assign(el.style, initial, {
      willChange: 'opacity, transform',
      transition: 'none',
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Small RAF to ensure the initial styles are painted before we transition
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transition = `opacity ${effectiveDuration}ms ${EASING[effectiveVariant]} ${delay}ms,
                                     transform ${effectiveDuration}ms ${EASING[effectiveVariant]} ${delay}ms,
                                     filter ${effectiveDuration}ms ease ${delay}ms`;
              el.style.opacity = '1';
              el.style.transform = 'translateY(0) translateX(0) scale(1)';
              el.style.filter = 'blur(0px)';
              // Clean up will-change after animation completes
              setTimeout(() => {
                if (el) el.style.willChange = 'auto';
              }, effectiveDuration + delay + 100);
            });
          });
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [effectiveVariant, delay, threshold, effectiveDuration]);

  return (
    <div ref={ref} className={className} style={style} {...props}>
      {children}
    </div>
  );
}

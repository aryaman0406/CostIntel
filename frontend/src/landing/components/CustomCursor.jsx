/**
 * CustomCursor — Desktop-only dot + trailing ring cursor.
 * Enabled only: (hover: hover) AND (pointer: fine) AND no prefers-reduced-motion.
 * Never hides native cursor in form fields, inputs, modals.
 * aria-hidden, pointer-events: none. Supports footer toggle to disable.
 */
import React, { useEffect, useRef, useState } from 'react';

const RING_SIZE = 38;
const DOT_SIZE  = 8;

export default function CustomCursor({ disabled = false }) {
  const ringRef = useRef(null);
  const dotRef  = useRef(null);
  const posRef  = useRef({ x: -200, y: -200 });
  const ringPos = useRef({ x: -200, y: -200 });
  const rafRef  = useRef(null);
  const [hoveringInteractive, setHoveringInteractive] = useState(false);

  useEffect(() => {
    if (disabled) return;

    // Only enable on fine-pointer hover-capable devices
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches || mqReduced.matches) return;

    document.body.style.cursor = 'none';

    const onMove = (e) => {
      posRef.current = { x: e.clientX, y: e.clientY };

      const target = e.target;
      const isInteractive =
        target.closest('a, button, input, textarea, select, [role="button"], [tabindex]') !== null;
      const isFormField =
        target.closest('input, textarea, select, [contenteditable="true"]') !== null;
      const isModal = target.closest('.am-dialog, .am-backdrop, [role="dialog"]') !== null;

      // Restore native cursor in form fields and modals
      if (isFormField || isModal) {
        document.body.style.cursor = 'auto';
      } else {
        document.body.style.cursor = 'none';
      }

      setHoveringInteractive(isInteractive && !isFormField && !isModal);
    };

    const animate = () => {
      const { x, y } = posRef.current;
      const lerp = 0.12;
      ringPos.current.x += (x - ringPos.current.x) * lerp;
      ringPos.current.y += (y - ringPos.current.y) * lerp;

      const dot  = dotRef.current;
      const ring = ringRef.current;
      if (dot) {
        dot.style.left = `${x - DOT_SIZE / 2}px`;
        dot.style.top  = `${y - DOT_SIZE / 2}px`;
      }
      if (ring) {
        ring.style.left = `${ringPos.current.x - RING_SIZE / 2}px`;
        ring.style.top  = `${ringPos.current.y - RING_SIZE / 2}px`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
      document.body.style.cursor = '';
    };
  }, [disabled]);

  if (disabled) return null;

  const sharedStyle = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: 99999,
    borderRadius: '50%',
    transition: 'width 200ms, height 200ms, background 200ms, border-color 200ms',
  };

  return (
    <>
      {/* Trailing ring */}
      <div
        ref={ringRef}
        aria-hidden="true"
        style={{
          ...sharedStyle,
          width:  RING_SIZE,
          height: RING_SIZE,
          border: `1.5px solid ${hoveringInteractive ? 'var(--l-violet)' : 'rgba(124,92,255,0.5)'}`,
          background: hoveringInteractive ? 'rgba(124,92,255,0.08)' : 'transparent',
          transform: hoveringInteractive ? 'scale(1.35)' : 'scale(1)',
          transition: 'transform 300ms var(--ease-smooth), border-color 200ms',
        }}
      />
      {/* Dot */}
      <div
        ref={dotRef}
        aria-hidden="true"
        style={{
          ...sharedStyle,
          width:  DOT_SIZE,
          height: DOT_SIZE,
          background: 'var(--l-violet)',
          opacity: hoveringInteractive ? 0.6 : 1,
        }}
      />
    </>
  );
}

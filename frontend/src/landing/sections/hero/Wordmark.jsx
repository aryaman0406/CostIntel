/**
 * Wordmark — Cinematic animated brand wordmark for CostIntel.
 * Features:
 * - Display size clamp(3.2rem, 2.5rem + 5.5vw, 6.2rem) in Space Grotesk
 * - Letter-by-letter masked rising reveal with blur-to-sharp & CSS stagger
 * - Single light-sweep sheen transition across the letters
 * - Accessible single <h1> semantics for screen readers and SEO
 */

import React from 'react';
import { heroContent } from '../../../content/hero';

const LETTERS = heroContent.wordmark.split('');

export default function Wordmark() {
  return (
    <h1 className="hero-wordmark-heading">
      {/* Visual letter-by-letter reveal */}
      <span className="hero-wordmark-letters" aria-hidden="true">
        {LETTERS.map((char, index) => (
          <span key={index} className="hero-letter-mask">
            <span
              className="hero-letter-char"
              style={{ animationDelay: `${index * 25}ms` }}
            >
              {char}
            </span>
          </span>
        ))}
        {/* Single light sweep highlight */}
        <span className="hero-wordmark-sheen" />
      </span>

      {/* Screen Reader & SEO text */}
      <span className="sr-only">{heroContent.accessibleHeadline}</span>
    </h1>
  );
}

/**
 * Hero Content & Asset Configuration
 * Centralized configuration for video sources, poster, wordmark, copy and proof chips.
 */

export const heroAssets = {
  poster: '/assets/hero/hero-poster.webp',
  webm1080: '/assets/hero/hero-1080.webm',
  mp41080: '/assets/hero/hero-1080.mp4',
  mp4720: '/assets/hero/hero-720.mp4',
};

export const heroContent = {
  eyebrow: 'AUTONOMOUS FINOPS PLATFORM',
  wordmark: 'CostIntel',
  accessibleHeadline: 'CostIntel: Autonomous Cost Governance & AI FinOps Controller',
  taglineFirstHalf: 'Autonomous Cost Governance ',
  taglineSecondHalf: '& AI FinOps Controller',
  subheadline:
    'Reconcile every ledger against every bank statement, catch cost leaks with explainable statistics, and ask a Gemini-powered CFO agent anything, all backed by an immutable audit trail.',
  ctaPrimary: 'Get Started',
  ctaSecondary: 'Learn More',
  proofChips: [
    { stat: '3-Tier', label: 'Matching Engine' },
    { stat: 'Z-Score + IQR', label: 'Anomaly Detection' },
    { stat: '5 AI Tools', label: 'CFO Agent Copilot' },
    { stat: '100%', label: 'Audit-Trail Logged' },
  ],
};

/**
 * HeroBackdrop — Full-bleed cinematic background video backdrop with:
 * - Responsive source selection (720p on mobile/slow conn, 1080p WebM/MP4 on desktop)
 * - LCP poster image with ~600ms crossfade to playing video
 * - Dark scrim gradient overlay (WCAG AA text contrast >= 4.5:1) + film grain
 * - Autoplay error handling, offscreen auto-pause, visibilitychange pause
 * - Accessible WCAG 2.2.2 video pause/play toggle button (40px glass circle)
 * - Aurora-mesh CSS gradient fallback if video/poster is missing
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { heroAssets } from '../../../content/hero';

function getInitialVideoConfig() {
  if (typeof window === 'undefined') return { src: heroAssets.mp41080, type: 'video/mp4' };
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const isSaveData = navigator.connection?.saveData === true;
  const isSlowConn = navigator.connection?.effectiveType === 'slow-2g' || navigator.connection?.effectiveType === '2g';
  if (prefersReducedMotion || isSaveData || isSlowConn) {
    return { src: null, type: 'video/mp4' };
  }
  if (window.innerWidth < 768) {
    return { src: heroAssets.mp4720, type: 'video/mp4' };
  }
  return { src: heroAssets.webm1080 || heroAssets.mp41080, type: heroAssets.webm1080 ? 'video/webm' : 'video/mp4' };
}

export default function HeroBackdrop({ isHeroVisible = true }) {
  const [videoConfig] = useState(getInitialVideoConfig);
  const videoSrc = videoConfig.src;
  const videoType = videoConfig.type;
  const [videoReady, setVideoReady] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(() => {
    try {
      return sessionStorage.getItem('costintel_hero_video_paused') === 'true';
    } catch {
      return false;
    }
  });
  const [videoFailed, setVideoFailed] = useState(false);

  const videoRef = useRef(null);

  // Handle video play/pause based on visibility, tab state, and user preference
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (isPausedByUser || !isHeroVisible || document.hidden) {
      video.pause();
    } else {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setVideoPlaying(true);
            setVideoFailed(false);
          })
          .catch(() => {
            // Silently fallback to poster on policy restriction or Low Power Mode
            setVideoPlaying(false);
          });
      }
    }
  }, [isHeroVisible, isPausedByUser, videoSrc]);

  // Pause on tab visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) {
        video.pause();
      } else if (!isPausedByUser && isHeroVisible) {
        video.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isHeroVisible, isPausedByUser]);

  const handleVideoCanPlay = () => {
    setVideoReady(true);
    const video = videoRef.current;
    if (video && !isPausedByUser && isHeroVisible && !document.hidden) {
      video.play().catch(() => {});
    }
  };

  const handleVideoError = () => {
    setVideoFailed(true);
    setVideoReady(false);
  };

  const toggleUserPlayPause = useCallback(() => {
    setIsPausedByUser((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('costintel_hero_video_paused', String(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return (
    <div className="hero-backdrop-container" aria-hidden="true">
      {/* 1. Aurora-mesh fallback layer */}
      <div className="hero-aurora-mesh" />

      {/* 2. Poster image (High priority LCP) */}
      <img
        src={heroAssets.poster}
        alt=""
        fetchPriority="high"
        className={`hero-poster-image${videoReady && videoPlaying ? ' hero-poster-image--hidden' : ''}`}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />

      {/* 3. Full-bleed background video */}
      {videoSrc && !videoFailed && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className={`hero-bg-video${videoReady && videoPlaying ? ' hero-bg-video--visible' : ''}`}
          onCanPlay={handleVideoCanPlay}
          onError={handleVideoError}
        >
          <source src={videoSrc} type={videoType} />
        </video>
      )}

      {/* 4. Film Grain & Vignette Texture Overlay */}
      <div className="hero-grain-overlay" />

      {/* 5. Scrim Gradient Overlay for WCAG AA text contrast */}
      <div className="hero-scrim-overlay" />

      {/* 6. WCAG 2.2.2 Accessibility Video Toggle (Bottom Right) */}
      {videoSrc && !videoFailed && (
        <button
          type="button"
          className="hero-video-toggle-btn"
          onClick={toggleUserPlayPause}
          aria-label={isPausedByUser || !videoPlaying ? 'Play background video' : 'Pause background video'}
          aria-pressed={!isPausedByUser && videoPlaying}
          title={isPausedByUser || !videoPlaying ? 'Play video' : 'Pause video'}
        >
          {isPausedByUser || !videoPlaying ? (
            <Play size={15} className="hero-video-toggle-icon" aria-hidden="true" />
          ) : (
            <Pause size={15} className="hero-video-toggle-icon" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}

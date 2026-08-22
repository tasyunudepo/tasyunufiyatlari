'use client';

import { Pause, Play, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

export default function OperationVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullVideo, setShowFullVideo] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const video = videoRef.current;
    if (!video || media.matches) return;

    void video.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, []);

  useEffect(() => {
    if (!showFullVideo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowFullVideo(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showFullVideo]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <>
      <figure className="group relative aspect-video overflow-hidden rounded-[1.35rem] border border-black/10 bg-[#d8d4ca] shadow-[0_24px_70px_rgba(24,22,17,0.14)]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          loop
          playsInline
          preload="metadata"
          poster="/video/ozer-grup-depo-hero-poster.webp"
          aria-label="Forklift, depo stoğu ve sevkiyata hazırlanan ürünlerin gerçek görüntüsü"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          <source src="/video/ozer-grup-depo-hero.webm" type="video/webm" />
          <source src="/video/ozer-grup-depo-hero.mp4" type="video/mp4" />
        </video>

        <figcaption className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm sm:right-4 sm:top-4 sm:text-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]" aria-hidden="true" />
          İstanbul / Tuzla Depo
        </figcaption>

        <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/65 via-black/10 to-transparent p-3 pt-12 sm:p-4 sm:pt-16">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white backdrop-blur-sm transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={isPlaying ? 'Videoyu duraklat' : 'Videoyu oynat'}
            >
              {isPlaying ? <Pause size={17} weight="fill" /> : <Play size={17} weight="fill" />}
            </button>
            <button
              type="button"
              onClick={() => setShowFullVideo(true)}
              className="hidden rounded-full border border-white/25 bg-black/65 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:inline-flex"
            >
              Tam videoyu izle
            </button>
          </div>
        </div>
      </figure>

      {showFullVideo && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Tam depo ve sevkiyat videosu"
          onClick={() => setShowFullVideo(false)}
        >
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowFullVideo(false)}
              className="absolute -top-12 right-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white"
              aria-label="Videoyu kapat"
            >
              <X size={20} weight="bold" />
            </button>
            <video
              src="/video/ozer-grup-depo-full.mp4"
              poster="/video/ozer-grup-depo-hero-poster.webp"
              className="max-h-[82vh] w-full rounded-2xl bg-black"
              controls
              playsInline
              autoPlay
              preload="none"
            />
          </div>
        </div>
      )}
    </>
  );
}

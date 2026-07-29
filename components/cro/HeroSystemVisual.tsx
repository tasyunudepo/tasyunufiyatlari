'use client';

import Image from 'next/image';

const PINS = [
  'Taşyünü & EPS levha',
  'Yapıştırma harcı',
  'Sıva harcı',
  'Plastik dübel',
  'Donatı filesi',
  'Fileli köşe profili',
  'Kaplama astarı',
  'Mineral kaplama',
] as const;

export default function HeroSystemVisual() {
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[28px] border border-fe-border/70 bg-[radial-gradient(circle_at_top,rgba(212,170,84,0.10),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-5 shadow-[0_28px_70px_rgba(0,0,0,0.28)]">
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

        <div className="grid items-center gap-3 sm:gap-4 grid-cols-[minmax(0,0.85fr)_minmax(150px,1.15fr)] sm:grid-cols-[minmax(0,0.98fr)_minmax(170px,0.82fr)]">
          <div className="relative mx-auto w-full max-w-[170px] sm:max-w-none">
            <Image
              src="/images/hero/sistem-kesiti.webp"
              alt="Mantolama sistem kesiti"
              width={800}
              height={1200}
              priority
              className="h-auto w-full object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.28)]"
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
              8 Ana Kalem
            </p>
            <ul className="space-y-1 sm:space-y-1.5">
              {PINS.map((label, index) => (
                <li key={label} className="flex items-center gap-2 sm:gap-2.5">
                  <span className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full border border-brand/25 bg-brand/12 text-[9px] sm:text-[10px] font-bold text-brand">
                    {index + 1}
                  </span>
                  <span className="text-[12px] sm:text-[13px] leading-snug text-fe-text/88">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

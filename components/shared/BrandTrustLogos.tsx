'use client';

import Image from 'next/image';

const TRUST_BRANDS = [
  {
    src: '/images/markalogolar/filli-boya-mantolama.webp',
    alt: 'Filli Boya',
    width: 126,
    height: 34,
  },
  {
    src: '/images/markalogolar/dalmaçyalı-taşyünü- fiyatları.webp',
    alt: 'Dalmaçyalı',
    width: 136,
    height: 34,
  },
  {
    src: '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    alt: 'Fawori',
    width: 112,
    height: 34,
  },
  {
    // Koyu zemin için beyaz versiyon (açık zeminde bonus-logo-red.svg).
    src: '/images/markalogolar/bonus-logo.svg',
    alt: 'Bonus',
    width: 90,
    height: 34,
  },
] as const;

interface BrandTrustLogosProps {
  compact?: boolean;
  title?: string;
  variant?: 'hero' | 'inline' | 'heroRail';
}

export default function BrandTrustLogos({
  compact = false,
  title = 'Tekliflerde karşılaştırdığımız markalar',
  variant = 'inline',
}: BrandTrustLogosProps) {
  const isHero = variant === 'hero';
  const isHeroRail = variant === 'heroRail';

  return (
    <div
      className={
        isHero
          ? 'relative space-y-5'
          : isHeroRail
            ? 'space-y-3'
            : compact
              ? 'space-y-3'
              : 'space-y-4'
      }
    >
      {isHero && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -inset-y-6 opacity-80"
          style={{
            background:
              'radial-gradient(220px 120px at 18% 72%, rgba(212,170,84,0.12), transparent 72%), radial-gradient(260px 130px at 84% 64%, rgba(212,170,84,0.10), transparent 74%)',
          }}
        />
      )}

      <div className={isHero ? 'relative space-y-1.5' : isHeroRail ? 'space-y-2' : ''}>
        <p
          className={
            isHero
              ? 'text-[12px] font-semibold uppercase tracking-[0.3em] text-brand'
              : isHeroRail
                ? 'text-[13px] font-semibold uppercase tracking-[0.26em] text-brand'
                : 'text-[11px] font-semibold uppercase tracking-[0.18em] text-brand'
          }
        >
          {title}
        </p>

        {isHero && (
          <p className="max-w-[320px] text-sm leading-relaxed text-fe-muted">
            Ürün, kalınlık, metraj ve şehir koşullarını birlikte değerlendiriyoruz.
          </p>
        )}
      </div>

      <ul
        className={
          isHero
            ? 'relative flex items-center justify-start gap-x-6 xl:gap-x-8'
            : isHeroRail
              ? 'grid grid-cols-4 gap-2.5'
              : 'flex flex-wrap items-center gap-2.5 sm:gap-3.5'
        }
      >
        {TRUST_BRANDS.map((brand) => (
          <li
            key={brand.src}
            className={
              isHero
                ? 'flex h-24 min-w-[132px] items-center justify-center rounded-2xl border border-[#caa35a]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] px-4 opacity-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_40px_rgba(0,0,0,0.18)] transition-all duration-200 hover:translate-y-[-1px] hover:border-[#caa35a]/18 hover:opacity-100'
                : isHeroRail
                  ? 'flex h-16 items-center justify-center rounded-xl border border-[#caa35a]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-[#caa35a]/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]'
                  : compact
                    ? 'flex h-10 items-center opacity-80 transition-opacity hover:opacity-100'
                    : 'flex h-12 items-center opacity-85 transition-opacity hover:opacity-100'
            }
          >
            <Image
              src={brand.src}
              alt={brand.alt}
              width={brand.width}
              height={brand.height}
              className={
                isHero
                  ? 'h-14 w-auto object-contain drop-shadow-[0_0_18px_rgba(212,170,84,0.10)]'
                  : isHeroRail
                    ? 'h-8 w-auto object-contain'
                    : compact
                      ? 'h-5 w-auto object-contain'
                      : 'h-7 w-auto object-contain'
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

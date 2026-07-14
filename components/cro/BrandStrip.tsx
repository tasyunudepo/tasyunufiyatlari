import Image from 'next/image';

const BRANDS = [
  // Koyu zemin + grayscale filtre: beyaz versiyon (açık zeminde bonus-logo-red.svg)
  { src: '/images/markalogolar/bonus-logo.svg',                      alt: 'Bonus taşyünü' },
  { src: '/images/markalogolar/Knauf Mineral yünleri.webp',         alt: 'Knauf taşyünü' },
  { src: '/images/markalogolar/Tekno Taşyünü ve EPs Fiyatları.webp', alt: 'Tekno toz grubu ve aksesuar ürünleri' },
  { src: '/images/markalogolar/dalmaçyalı-taşyünü- fiyatları.webp',  alt: 'Dalmaçyalı taşyünü' },
  { src: '/images/markalogolar/fawori-taşyünü- fiyatları.webp',      alt: 'Fawori taşyünü' },
  { src: '/images/markalogolar/filli-boya-mantolama.webp',           alt: 'Filli Boya mantolama' },
] as const;

export function BrandStrip() {
  return (
    <section
      aria-labelledby="brand-baslik"
      className="border-y border-fe-border/40 bg-fe-surface/60 py-10 sm:py-12"
    >
      <div className="max-w-[1200px] mx-auto px-4">
        <p
          id="brand-baslik"
          className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-brand"
        >
          Çalıştığımız Markalar
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6 items-center">
          {BRANDS.map((b) => (
            <li key={b.src} className="flex items-center justify-center">
              <Image
                src={b.src}
                alt={b.alt}
                width={140}
                height={56}
                className="h-10 sm:h-12 w-auto object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// /urunler hub marka chip filter row + sıralama dropdown.
// NOT sticky (SiteHeader zaten sticky — iki sticky katman çakışır).
// Markalar ürün merkezinin marka listesinden gelir; TEKNO 26 Ekim 2026'dan beri ön yüzde yok.
// Sıralama dropdown UI-only; hub statik liste (mantolama workflow sırası).

import Link from 'next/link';
import type { HubBrand } from '@/lib/catalog/hub';

type Props = {
  markalar: HubBrand[];
  totalUrun: number;
};

export default function FilterBar({ markalar, totalUrun }: Props) {
  return (
    <div className="bg-hub-card border-b border-hub-rule-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Marka chip row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-hub-muted mr-2">
            Marka
          </span>
          <Link
            href="/urunler"
            prefetch={false}
            className="px-3.5 py-1.5 rounded-full bg-hub-dark text-hub-warm text-[13px] font-medium tracking-[-0.005em] inline-flex items-center gap-2"
            aria-current="page"
          >
            Tümü
            <span className="font-mono text-[10px] tracking-wider opacity-70">{totalUrun}</span>
          </Link>
          {markalar.map((m) => (
            <Link
              key={m.slug}
              href={`/marka/${m.slug}`}
              prefetch={false}
              className="px-3.5 py-1.5 rounded-full bg-hub-card border border-hub-rule text-hub-ink text-[13px] font-medium tracking-[-0.005em] inline-flex items-center gap-2 hover:border-hub-gold hover:text-hub-gold transition-colors"
            >
              {m.name}
              <span className="font-mono text-[10px] tracking-wider text-hub-muted">{m.total}</span>
            </Link>
          ))}
        </div>

        {/* Sıralama dropdown — semantik, click-handler yok */}
        <details className="relative group">
          <summary className="list-none cursor-pointer px-3.5 py-1.5 rounded-md border border-hub-rule text-[12.5px] text-hub-ink-2 inline-flex items-center gap-2 hover:border-hub-rule-strong">
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-hub-muted">Sırala</span>
            <span className="font-medium">Mantolama sırası</span>
            <span className="text-hub-muted text-[10px]">▾</span>
          </summary>
          <ul className="absolute right-0 top-full mt-1 bg-hub-card border border-hub-rule rounded-md shadow-lg py-1 min-w-[200px] z-30 text-[13px]">
            <li className="px-4 py-2 bg-hub-bg-card-2 text-hub-ink font-medium">Mantolama sırası</li>
            <li className="px-4 py-2 text-hub-ink-2 hover:bg-hub-card-2 cursor-pointer">İsim A → Z</li>
            <li className="px-4 py-2 text-hub-ink-2 hover:bg-hub-card-2 cursor-pointer">Marka</li>
            <li className="px-4 py-2 text-hub-ink-2 hover:bg-hub-card-2 cursor-pointer">Ürün sayısı</li>
          </ul>
        </details>
      </div>
    </div>
  );
}

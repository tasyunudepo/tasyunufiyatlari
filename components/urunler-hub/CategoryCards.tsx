// /urunler hub kategori kartları.
// Layout (v4):
//   Row 1 (2-col): Taşyünü + EPS  (eşit hero kartlar)
//   Row 2 (4-col): Yapıştırıcı + Dübel + File + Fileli Köşe
//   Row 3 (4-col): Sıva + Astar + Kaplama + Komple Sistem (1-col, koyu)
// Numaralandırma sıralı: 01-02 levhalar, 03-09 aksesuarlar, ↗ Komple Sistem.
// Mantolama workflow bilgisi descriptions içinde kalır.

import Link from 'next/link';
import Image from 'next/image';
import type { HubKategoriRow, HubBadge } from '@/lib/catalog/hub';

type Props = { kategoriler: HubKategoriRow[] };

export default function CategoryCards({ kategoriler }: Props) {
  const map = new Map(kategoriler.map((k) => [k.slug, k]));
  const tasyunu      = map.get('tasyunu-levha');
  const eps          = map.get('eps-levha');
  const yapistirici  = map.get('yapistirici');
  const dubel        = map.get('dubel');
  const file         = map.get('file');
  const fileliKose   = map.get('fileli-kose-profilleri');
  const siva         = map.get('siva');
  const astar        = map.get('astar');
  const kaplama      = map.get('kaplama');

  return (
    <section className="bg-hub-warm py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">

        {/* ─── Row 1: 2-col → Taşyünü + EPS ───────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6">
          {tasyunu && <HeroCard k={tasyunu} num="01" highlight={{ label: 'A1 Yangın', color: 'green' }} priority />}
          {eps     && <HeroCard k={eps}     num="02" highlight={{ label: 'Ekonomik', color: 'amber' }} priority />}
        </div>

        {/* ─── Row 2: mobile 2-col / tablet 3-col / desktop 4-col ─── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {yapistirici && <CompactCard k={yapistirici} num="03" priority />}
          {dubel       && <CompactCard k={dubel}       num="04" />}
          {file        && <CompactCard k={file}        num="05" />}
          {fileliKose  && <CompactCard k={fileliKose}  num="06" />}
        </div>

        {/* ─── Row 3: mobile 2-col / tablet 3-col / desktop 4-col ─── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {siva    && <CompactCard k={siva}    num="07" />}
          {astar   && <CompactCard k={astar}   num="08" />}
          {kaplama && <CompactCard k={kaplama} num="09" />}
          <CompleSystemCard />
        </div>
      </div>
    </section>
  );
}

// ─── Hero kart (Taşyünü + EPS) ─────────────────────────────────
function HeroCard({
  k,
  num,
  highlight,
  priority = false,
}: {
  k: HubKategoriRow;
  num: string;
  highlight?: { label: string; color: 'green' | 'amber' };
  priority?: boolean;
}) {
  const badgeClass =
    highlight?.color === 'green'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'bg-amber-50 text-amber-800 border border-amber-200';

  return (
    <Link
      href={`/urunler/${k.slug}`}
      prefetch={false}
      className="group relative bg-hub-card border border-hub-rule rounded-2xl overflow-hidden hover:border-hub-rule-strong hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
    >
      {/* Image 16:10 — object-cover */}
      <div className="relative aspect-[16/10] bg-hub-card-2 overflow-hidden">
        {k.hero_image && (
          <Image
            src={k.hero_image}
            alt={k.title}
            fill
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 50vw"
            className="object-cover"
            priority={priority}
          />
        )}
        {highlight && (
          <span
            className={`absolute top-3 right-3 text-[10.5px] font-mono tracking-[0.10em] uppercase font-medium px-2.5 py-1 rounded ${badgeClass}`}
          >
            {highlight.label}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-7 lg:p-8 flex-1 flex flex-col">
        <div className="font-mono text-[11px] tracking-[0.16em] text-hub-gold mb-3">
          {num} · {k.title.toUpperCase()}
        </div>
        <h3 className="text-2xl lg:text-3xl font-bold tracking-[-0.025em] leading-[1.05] text-hub-ink mb-3">
          {k.title}
        </h3>
        <p className="text-[14px] leading-relaxed text-hub-ink-2 max-w-[44ch] mb-6">
          {k.desc}
        </p>

        {/* 3 spec — full-width yay (sol·orta·sağ) */}
        <div className="flex justify-between items-start gap-4 pt-4 mt-auto border-t border-hub-rule pr-14">
          <Spec value={k.urun_sayisi}            label="Ürün" />
          <Spec value={k.marka_sayisi}           label="Marka"   align="center" />
          <Spec value={k.thickness_range ?? '—'} label="Kalınlık" align="right" />
        </div>
      </div>

      {/* Sağ-alt dolu ok (36x36 gold-soft) — birincil kategori affordance.
          Aksesuar kartlardaki outline ok'tan büyük + dolu → hiyerarşi:
          dolu daire = ana kategori, outline daire = destek kategori. */}
      <span
        aria-hidden
        className="absolute right-6 bottom-6 w-9 h-9 rounded-full bg-hub-gold-soft text-hub-dark flex items-center justify-center text-sm leading-none transition-transform duration-200 group-hover:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}

function Spec({
  value, label, align = 'left',
}: {
  value: number | string;
  label: string;
  align?: 'left' | 'center' | 'right';
}) {
  const alignCls =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <div className={alignCls}>
      <div className="font-bold text-lg tracking-[-0.015em] text-hub-ink tabular-nums whitespace-nowrap">
        {value}
      </div>
      <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-hub-muted mt-0.5">
        {label}
      </div>
    </div>
  );
}

// ─── Kompakt aksesuar kartı ──────────────────────────────────
function CompactCard({ k, num, priority = false }: { k: HubKategoriRow; num: string; priority?: boolean }) {
  // Dübel görseli yatay yayılan → object-cover kırpma riski. İstisna: contain + padding.
  const isDubel = k.slug === 'dubel';
  const imgClass = isDubel ? 'object-contain p-4' : 'object-cover';

  return (
    <Link
      href={`/urunler/${k.slug}`}
      prefetch={false}
      className="group bg-hub-card border border-hub-rule rounded-2xl overflow-hidden hover:border-hub-rule-strong hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
    >
      {/* Image 1:1 — object-cover (Dübel istisnası: object-contain p-4) */}
      <div className="relative aspect-square bg-hub-card-2 overflow-hidden">
        {k.hero_image && (
          <Image
            src={k.hero_image}
            alt={k.title}
            fill
            sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
            className={imgClass}
            priority={priority}
          />
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="font-mono text-[10.5px] tracking-[0.16em] text-hub-gold mb-1.5">
          {num}
        </div>
        <h4 className="text-[19px] font-semibold tracking-[-0.018em] leading-tight text-hub-ink mb-1.5">
          {k.title}
        </h4>
        <p className="text-[12.5px] leading-snug text-hub-ink-2/80 mb-auto line-clamp-2">
          {k.desc}
        </p>
        <div className="mt-4 pt-3 border-t border-hub-rule flex items-center justify-between gap-2">
          <BadgeChip badge={k.badge} brands={k.marka_sayisi} urun={k.urun_sayisi} />
          <span
            aria-hidden
            className="shrink-0 w-6 h-6 rounded-full border border-hub-gold text-hub-gold flex items-center justify-center text-[11px] leading-none transition-transform duration-200 group-hover:translate-x-1"
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

function BadgeChip({ badge, brands, urun }: { badge: HubBadge; brands: number; urun: number }) {
  const isSystem = badge === 'sistem';
  const labelMap: Record<HubBadge, string> = {
    tekil:  'Tekil',
    sistem: 'Sistem içinde',
    mixed:  'Tekil + Sistem',
  };
  return (
    <span className="font-mono text-[10px] tracking-[0.04em] inline-flex items-center gap-1.5 min-w-0">
      <span
        className={`shrink-0 px-1.5 py-0.5 rounded-sm ${
          isSystem
            ? 'border border-hub-muted/50 text-hub-muted'
            : 'border border-hub-gold text-hub-gold'
        }`}
      >
        {labelMap[badge]}
      </span>
      <span className="text-hub-muted truncate">{brands} marka · {urun} ürün</span>
    </span>
  );
}

// ─── Komple Sistem kartı (1-col, koyu zemin) ────────────────
function CompleSystemCard() {
  return (
    <Link
      href="/#mantolama-hesaplayici"
      prefetch={false}
      className="group bg-hub-dark text-hub-warm rounded-2xl p-6 flex flex-col justify-between hover:translate-y-[-2px] transition-transform duration-200 border border-hub-dark min-h-[100%]"
    >
      <div>
        <div className="font-mono text-[10px] sm:text-[10.5px] tracking-[0.18em] text-hub-gold-soft mb-3">
          ↗ TÜM SİSTEM
        </div>
        <h3 className="text-[16px] sm:text-[19px] font-bold tracking-[-0.02em] leading-tight text-hub-warm mb-2">
          Komple Mantolama Paketi
        </h3>
        <p className="text-[11px] sm:text-[12.5px] leading-snug text-hub-warm/70 line-clamp-3">
          Levha + dübel + file + sıva + harç. Şehir, kalınlık ve m² verin —
          fabrika çıkışı paket fiyatınızı hesaplayın.
        </p>
      </div>
      <div className="mt-5 pt-3 border-t border-hub-warm/15 flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] sm:text-[10.5px] tracking-[0.14em] uppercase font-medium text-hub-gold-soft">
          Hesap Makinesi
        </span>
        <span
          aria-hidden
          className="shrink-0 w-7 h-7 rounded-full bg-hub-gold-soft text-hub-dark flex items-center justify-center text-[12px] leading-none transition-transform duration-200 group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </Link>
  );
}

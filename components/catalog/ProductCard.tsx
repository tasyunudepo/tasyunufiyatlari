import Link from 'next/link';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';
import PriceDisplay from './PriceDisplay';
import ProductImage from './ProductImage';
import {
  formatThicknessSummary,
  getDensityBadge,
  getDensitySourceLabel,
} from '@/lib/catalog/sections';
import type { CatalogProductView } from '@/lib/catalog/types';
import { getProfileByModel } from '@/lib/technical-profiles';

interface ProductCardProps {
  product: CatalogProductView;
  kategori: string; // URL segmenti için
  /** Ekran üstü kartlarda LCP görseli lazy kalmasın (next/image priority) */
  imagePriority?: boolean;
  tone?: 'dark' | 'warm';
  query?: string;
}

const SALES_MODE_BADGE: Record<string, { label: string; color: string }> = {
  single_only:      { label: 'Direkt Alım',   color: 'bg-green-900/50 text-green-400 border-green-800'  },
  single_or_quote:  { label: 'Alım / Teklif', color: 'bg-fe-raised/50 text-fe-muted border-fe-border'   },
  quote_only:       { label: 'Teklif',         color: 'bg-brand-900/50 text-brand-400 border-brand-800' },
  system_only:      { label: 'Sistem Ürünü',   color: 'bg-fe-raised text-fe-muted border-fe-border'   },
};

export default function ProductCard({
  product,
  kategori,
  imagePriority = false,
  tone = 'dark',
  query,
}: ProductCardProps) {
  const badge = SALES_MODE_BADGE[product.rules.sales_mode] ?? SALES_MODE_BADGE.quote_only;
  const href = `/urunler/${kategori}/${product.slug}${query ? `?${query}` : ''}`;
  const isWarm = tone === 'warm';

  // Kartın ayırt edici bilgileri: yoğunluk (föy beyanı; aile kartında
  // varyantlar birleşik) + tek satır kalınlık özeti. Kalınlık çip
  // listesi kart alanını yiyip bilgi taşımıyordu (21 Temmuz kararı).
  const densityBadge =
    product.product_type === 'plate' && product.material_type === 'tasyunu'
      ? getDensityBadge(product.model)
      : null;
  const densitySource = isWarm ? getDensitySourceLabel(product.model) : null;
  const productModel = product.model ?? '';
  const isComparisonEligible = getProfileByModel(productModel)?.comparisonEligible === true;
  const thicknessSummary = formatThicknessSummary(product.thickness_options);

  // Fiyatsız durumda genel "şehir ve miktara göre değişir" yerine
  // yönlendiren mikro-metin (fiyat kararı decision.ts'te kalır).
  const emptyNote =
    product.rules.sales_mode === 'quote_only'
      ? 'Proje bazlı teklif — ürün detayından talep oluşturun'
      : product.rules.requires_city_for_pricing
        ? 'Şehrini seç, m² fiyatını anında gör'
        : undefined;

  const cardClass = isWarm
    ? 'group flex h-full min-w-0 flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_10px_28px_rgba(39,31,17,0.09)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(39,31,17,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hub-gold focus-visible:ring-offset-4 focus-visible:ring-offset-hub-warm'
    : 'group block overflow-hidden rounded-xl border border-fe-border bg-fe-raised/40 transition-all duration-150 hover:border-brand-500/50 hover:bg-fe-raised/70';

  const badgeClass = isWarm
    ? product.rules.sales_mode === 'single_only'
      ? 'border-[#b9d6c7] bg-[#e8f5ee] text-[#145a42]'
      : 'border-hub-rule bg-hub-card-2 text-hub-ink-2'
    : badge.color;

  if (isWarm) {
    const comparisonHref = `/tasyunu-karsilastir?entry=category&focus=${encodeURIComponent(productModel)}`;

    return (
      <article className="group grid h-full min-w-0 overflow-hidden rounded-[14px] bg-white shadow-[0_10px_28px_rgba(39,31,17,0.09)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(39,31,17,0.13)] lg:grid-cols-[42%_58%]">
        <Link
          href={href}
          prefetch={false}
          data-category-product-link
          aria-label={`${product.name} ürününü incele`}
          className="relative block min-h-48 bg-[#f5f2eb] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hub-gold lg:min-h-full"
        >
          <ProductImage
            src={product.image_cover}
            alt={product.name}
            className="h-48 w-full bg-[#f5f2eb] lg:h-full lg:min-h-[320px]"
            priority={imagePriority}
          />
          {densitySource && (
            <span className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-full border border-hub-rule bg-white/95 px-2.5 py-1 text-[10px] font-semibold leading-4 text-hub-muted shadow-sm backdrop-blur-sm">
              {densitySource}
            </span>
          )}
        </Link>

        <div className="flex min-w-0 flex-col p-4">
          <Link
            href={href}
            prefetch={false}
            data-category-product-link
            className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hub-gold focus-visible:ring-offset-2"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold text-hub-muted">{product.brand.name}</p>
                <h3 className="text-[15px] font-bold leading-5 tracking-[-0.015em] text-hub-ink transition-colors group-hover:text-hub-gold">
                  {product.name}
                </h3>
              </div>
              <span className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                {badge.label}
              </span>
            </div>

            {product.model && (
              <p className="mb-2 text-xs text-hub-muted">{product.model}</p>
            )}
            {(densityBadge || thicknessSummary) && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {densityBadge && (
                  <span className="rounded-md bg-[#eee6d7] px-2 py-1 text-[11px] font-semibold text-[#514737]">
                    {densityBadge}
                  </span>
                )}
                {thicknessSummary && (
                  <span className="rounded-md bg-[#f3efe7] px-2 py-1 text-[11px] text-[#514737]">
                    {thicknessSummary}
                  </span>
                )}
              </div>
            )}

            <div className="border-t border-hub-rule pt-3">
              <PriceDisplay
                rules={product.rules}
                basePrice={product.base_price}
                unitLabel={product.product_type === 'plate' ? 'm²' : 'paket'}
                emptyNoteOverride={emptyNote}
                tone="warm"
              />
            </div>

            {product.minimum_order.has_minimum && product.minimum_order.label && (
              <p className="mt-2 text-xs font-medium text-hub-gold">{product.minimum_order.label}</p>
            )}
          </Link>

          <div className={`mt-auto grid gap-2 border-t border-hub-rule pt-3 ${isComparisonEligible ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <Link
              href={href}
              prefetch={false}
              data-category-product-link
              className="inline-flex min-h-11 items-center justify-between gap-2 rounded-[9px] px-2 text-xs font-bold text-hub-gold hover:bg-[#f3efe7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hub-gold"
            >
              Ürünü incele
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            {isComparisonEligible && (
              <Link
                href={comparisonHref}
                prefetch={false}
                data-category-compare-link
                data-product-model={productModel}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[9px] border border-hub-rule px-2 text-xs font-bold text-hub-ink-2 hover:border-[#a98a53] hover:text-hub-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hub-gold"
              >
                <ArrowLeftRight size={15} aria-hidden="true" />
                Karşılaştır
              </Link>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className={cardClass}
    >
      {/* Görsel */}
      <ProductImage
        src={product.image_cover}
        alt={product.name}
        className={isWarm ? 'h-48 w-full bg-[#f5f2eb]' : 'h-36 w-full'}
        priority={imagePriority}
      />

      {/* İçerik */}
      <div className={isWarm ? 'flex flex-1 flex-col p-5' : 'flex flex-1 flex-col p-4'}>
      {densitySource && (
        <span className="mb-3 w-fit rounded-full border border-hub-rule bg-hub-card-2 px-2.5 py-1 text-[11px] font-semibold text-hub-muted">
          {densitySource}
        </span>
      )}
      {/* Üst: isim + badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className={isWarm ? 'mb-1 text-xs font-semibold text-hub-muted' : 'text-xs text-fe-muted-strong mb-0.5'}>{product.brand.name}</p>
          <h3 className={isWarm
            ? 'line-clamp-2 text-base font-bold leading-6 tracking-[-0.015em] text-hub-ink transition-colors group-hover:text-hub-gold'
            : 'text-sm font-semibold text-white group-hover:text-brand-400 transition-colors line-clamp-2'}>
            {product.name}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${badgeClass}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Model + ayırt edici özet: yoğunluk rozeti ve kalınlık aralığı */}
      {product.model && (
        <p className={isWarm ? 'mb-2 text-xs text-hub-muted' : 'text-xs text-fe-muted-strong mb-1.5'}>{product.model}</p>
      )}
      {(densityBadge || thicknessSummary) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {densityBadge && (
            <span className={isWarm
              ? 'rounded-md bg-[#eee6d7] px-2 py-1 text-xs font-semibold text-[#514737]'
              : 'text-xs px-2 py-0.5 rounded border border-brand-800/60 bg-brand-900/30 text-brand-300 font-medium'}>
              {densityBadge}
            </span>
          )}
          {thicknessSummary && (
            <span className={isWarm
              ? 'rounded-md bg-[#f3efe7] px-2 py-1 text-xs text-[#514737]'
              : 'text-xs px-2 py-0.5 rounded bg-fe-raised text-fe-text'}>
              {thicknessSummary}
            </span>
          )}
        </div>
      )}

      {/* Fiyat — decision.ts tek otorite, liste/detay tutarlı */}
      <div className={isWarm ? 'mt-auto border-t border-hub-rule pt-3' : 'mt-auto border-t border-fe-border pt-2'}>
        <PriceDisplay
          rules={product.rules}
          basePrice={product.base_price}
          unitLabel={product.product_type === 'plate' ? 'm²' : 'paket'}
          emptyNoteOverride={emptyNote}
          tone={tone}
        />
      </div>

      {/* Minimum sipariş notu */}
      {product.minimum_order.has_minimum && product.minimum_order.label && (
        <p className={isWarm ? 'mt-2 text-xs font-medium text-hub-gold' : 'text-xs text-brand-500/80 mt-1'}>{product.minimum_order.label}</p>
      )}
      {isWarm && (
        <span className="mt-3 inline-flex min-h-11 items-center justify-between gap-3 text-sm font-bold text-hub-gold">
          Ürünü ve fiyatı incele
          <ArrowRight size={17} aria-hidden="true" />
        </span>
      )}
      </div>
    </Link>
  );
}

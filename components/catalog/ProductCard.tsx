import Link from 'next/link';
import PriceDisplay from './PriceDisplay';
import ProductImage from './ProductImage';
import { formatThicknessSummary, getDensityBadge } from '@/lib/catalog/sections';
import type { CatalogProductView } from '@/lib/catalog/types';

interface ProductCardProps {
  product: CatalogProductView;
  kategori: string; // URL segmenti için
  /** Ekran üstü kartlarda LCP görseli lazy kalmasın (next/image priority) */
  imagePriority?: boolean;
}

const SALES_MODE_BADGE: Record<string, { label: string; color: string }> = {
  single_only:      { label: 'Direkt Alım',   color: 'bg-green-900/50 text-green-400 border-green-800'  },
  single_or_quote:  { label: 'Alım / Teklif', color: 'bg-fe-raised/50 text-fe-muted border-fe-border'   },
  quote_only:       { label: 'Teklif',         color: 'bg-brand-900/50 text-brand-400 border-brand-800' },
  system_only:      { label: 'Sistem Ürünü',   color: 'bg-fe-raised text-fe-muted border-fe-border'   },
};

export default function ProductCard({ product, kategori, imagePriority = false }: ProductCardProps) {
  const badge = SALES_MODE_BADGE[product.rules.sales_mode] ?? SALES_MODE_BADGE.quote_only;
  const href = `/urunler/${kategori}/${product.slug}`;

  // Kartın ayırt edici bilgileri: yoğunluk (föy beyanı; aile kartında
  // varyantlar birleşik) + tek satır kalınlık özeti. Kalınlık çip
  // listesi kart alanını yiyip bilgi taşımıyordu (21 Temmuz kararı).
  const densityBadge =
    product.product_type === 'plate' && product.material_type === 'tasyunu'
      ? getDensityBadge(product.model)
      : null;
  const thicknessSummary = formatThicknessSummary(product.thickness_options);

  // Fiyatsız durumda genel "şehir ve miktara göre değişir" yerine
  // yönlendiren mikro-metin (fiyat kararı decision.ts'te kalır).
  const emptyNote =
    product.rules.sales_mode === 'quote_only'
      ? 'Proje bazlı teklif — formu doldurun, aynı gün dönüş'
      : product.rules.requires_city_for_pricing
        ? 'Şehrini seç, m² fiyatını anında gör'
        : undefined;

  return (
    <Link
      href={href}
      prefetch={false}
      className="block rounded-xl border border-fe-border hover:border-brand-500/50 bg-fe-raised/40 hover:bg-fe-raised/70 overflow-hidden transition-all duration-150 group"
    >
      {/* Görsel */}
      <ProductImage
        src={product.image_cover}
        alt={product.name}
        className="h-36 w-full"
        priority={imagePriority}
      />

      {/* İçerik */}
      <div className="p-4">
      {/* Üst: isim + badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs text-fe-muted-strong mb-0.5">{product.brand.name}</p>
          <h3 className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors line-clamp-2">
            {product.name}
          </h3>
        </div>
        <span
          className={`shrink-0 text-xs px-2 py-0.5 rounded border font-medium ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Model + ayırt edici özet: yoğunluk rozeti ve kalınlık aralığı */}
      {product.model && (
        <p className="text-xs text-fe-muted-strong mb-1.5">{product.model}</p>
      )}
      {(densityBadge || thicknessSummary) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {densityBadge && (
            <span className="text-xs px-2 py-0.5 rounded border border-brand-800/60 bg-brand-900/30 text-brand-300 font-medium">
              {densityBadge}
            </span>
          )}
          {thicknessSummary && (
            <span className="text-xs px-2 py-0.5 rounded bg-fe-raised text-fe-text">
              {thicknessSummary}
            </span>
          )}
        </div>
      )}

      {/* Fiyat — decision.ts tek otorite, liste/detay tutarlı */}
      <div className="mt-auto pt-2 border-t border-fe-border">
        <PriceDisplay
          rules={product.rules}
          basePrice={product.base_price}
          unitLabel={product.product_type === 'plate' ? 'm²' : 'paket'}
          emptyNoteOverride={emptyNote}
        />
      </div>

      {/* Minimum sipariş notu */}
      {product.minimum_order.has_minimum && product.minimum_order.label && (
        <p className="text-xs text-brand-500/80 mt-1">{product.minimum_order.label}</p>
      )}
      </div>
    </Link>
  );
}


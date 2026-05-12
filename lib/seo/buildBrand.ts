// ============================================================
// Brand node üreticisi
//
// Sprint 1 / Madde 3 — marka sayfaları (/marka/[brand]) ve ürün
// detay sayfasındaki Product.brand pointer'ı buradan beslenir.
//
// BRAND_INFO sözlüğü lib/business/info.ts'te tanımlı. sameAs URL'leri
// Knowledge Graph entity füzyonu için kritik — Google "Dalmaçyalı"
// markasını dalmacyali.com.tr ile aynı entity sayar.
// ============================================================

import { BRAND_INFO, BUSINESS_INFO, type BrandSlug } from '@/lib/business/info';

/**
 * Marka slug'ından standalone Brand node üretir.
 * Bilinmeyen slug için null döner (Product schema fallback eden tarafa
 * inline `{ '@type': 'Brand', name }` koyabilir).
 */
export function buildBrandNode(slug: BrandSlug) {
  const meta = BRAND_INFO[slug];
  return {
    '@type': 'Brand' as const,
    '@id':   meta.id,
    name:    meta.name,
    url:     `${BUSINESS_INFO.url}/marka/${slug}`,
    sameAs:  [...meta.sameAs],
  };
}

/** UI'da gösterilen marka adından slug'a güvenli geriye-çözme. Bilinmeyen ise null. */
export function brandSlugByName(name: string): BrandSlug | null {
  const entries = Object.entries(BRAND_INFO) as [BrandSlug, typeof BRAND_INFO[BrandSlug]][];
  const match = entries.find(([, meta]) => meta.name === name);
  return match ? match[0] : null;
}

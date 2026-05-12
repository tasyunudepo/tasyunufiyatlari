// ============================================================
// Service node üreticisi
//
// Sprint 1 / Madde 3 — iki ana hizmet:
//   1) Mantolama Hesaplama (online araç — provider = Organization, ücretsiz)
//   2) Türkiye geneli sevkiyat (areaServed = Türkiye, provider = Organization)
//
// provider/seller alanları her zaman BUSINESS_REF pointer'ı kullanır
// (Knowledge Graph entity füzyonu için).
// ============================================================

import { BUSINESS_INFO, BUSINESS_REF } from '@/lib/business/info';

// ─── 1) Hesaplama Servisi ────────────────────────────────────

/**
 * Mantolama Hesaplama Servisi — online ücretsiz araç.
 * WebApplication ile yakın akrabadır; biri "uygulama" diğeri "hizmet"
 * tarafından modelleniyor. Schema.org Service'i Knowledge Graph'ta
 * "X şirketi hangi hizmetleri verir?" sorusuna karşılık geliyor.
 */
export function buildCalculationServiceNode() {
  return {
    '@type': 'Service' as const,
    '@id':   `${BUSINESS_INFO.url}/#service-hesaplama`,
    name: 'Mantolama Maliyeti Hesaplama',
    serviceType: 'Online Hesaplama Aracı',
    description:
      '8 kalemli mantolama setini metraj, kalınlık ve şehir bazında hesaplar; ' +
      'nakliye dahil 3 farklı paket alternatifini PDF teklif olarak sunar.',
    provider:   BUSINESS_REF,
    areaServed: { '@type': 'Country' as const, name: BUSINESS_INFO.areaServed.name },
    offers: {
      '@type':        'Offer' as const,
      price:          '0',
      priceCurrency:  'TRY',
      availability:   'https://schema.org/InStock',
      url:            BUSINESS_INFO.url,
    },
  };
}

// ─── 2) Sevkiyat Servisi ─────────────────────────────────────

/**
 * Türkiye Geneli Sevkiyat — fabrika çıkışlı, parsiyel/kamyon/TIR.
 * 81 il sevkiyat sinyali Knowledge Graph'a doğrudan iletilir.
 */
export function buildShippingServiceNode() {
  return {
    '@type': 'Service' as const,
    '@id':   `${BUSINESS_INFO.url}/#service-sevkiyat`,
    name: 'Türkiye Geneli Mantolama Malzemesi Sevkiyatı',
    serviceType: 'Yapı Malzemesi Sevkiyatı',
    description:
      'Tuzla Tepeören depodan Türkiye\'nin 81 iline taşyünü ve EPS levha ' +
      'sevkiyatı. Parsiyel yük, kamyon ve TIR seçenekleriyle bölgesel ' +
      'iskonto otomatik uygulanır.',
    provider:   BUSINESS_REF,
    areaServed: { '@type': 'Country' as const, name: BUSINESS_INFO.areaServed.name },
  };
}

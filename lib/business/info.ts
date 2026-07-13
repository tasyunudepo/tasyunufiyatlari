// ============================================================
// BUSINESS_INFO — Tek Doğruluk Kaynağı (NAP)
// ============================================================
//
// Şirket adı, adres, telefon gibi NAP (Name-Address-Phone) verilerinin
// TÜM site genelindeki tek kanonik kaynağı. Hardcoded string'ler yerine
// bu sözlükten çekilir; böylece Google Business Profile + Knowledge
// Graph + Schema.org @graph senkron kalır.
//
// Audit raporundaki "NAP tutarsızlığı" maddesi (acil §1) bu dosyayla
// çözüldü — 2026-05-11.
// ============================================================

export const BUSINESS_INFO = {
  // Şirket kimliği
  legalName: 'ÖzerGrup Yalıtım ve İzolasyon A.Ş.',
  brandName: 'Taşyünü Fiyatları',
  url: 'https://www.tasyunufiyatlari.com',

  // İletişim kanalları
  phone: {
    display:  '0 543 518 69 88',  // UI'da gösterilen format
    tel:      '+905435186988',    // tel: linkleri (E.164)
    whatsapp: '905435186988',     // wa.me URL'leri (ülke kodu + numara)
  },

  // Kanonik adres — kurumsal ofis (Tuzla / Mescit Mahallesi)
  // Knowledge Graph + Schema.org Organization/LocalBusiness için bu adres kullanılır.
  // Depo ayrı bir lokasyondur, aşağıdaki WAREHOUSE_INFO altında.
  address: {
    streetAddress:   'Mescit Mah. Ulugüney Sk. Harman Plaza A1 Blok K2 No:15',
    addressLocality: 'Tuzla',
    addressRegion:   'İstanbul',
    addressCountry:  'TR',
  },

  // Çalışma saatleri — schema.org OpeningHoursSpecification formatına uygun
  openingHours: {
    days:   ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const,
    opens:  '08:00',
    closes: '18:00',
  },

  // Hizmet bölgesi
  areaServed: { type: 'Country' as const, name: 'Türkiye' },

  // Fiyat aralığı (schema.org priceRange, sektör kullanımı)
  priceRange: '₺₺',

  // Kurucu adı kurumsal kayıtta kullanılır; faaliyet başlangıç yılı belge
  // teyidi tamamlanmadan müşteri metnine veya schema'ya eklenmez.
  founder:      'Muhammet Öztürk',
} as const;

// ============================================================
// WAREHOUSE_INFO — Depo Lokasyonu (Tuzla / Orhanlı)
// ============================================================
//
// Kurumsal ofisten farklı fiziksel bir lokasyon. /depomuz sayfası
// bu adresi gösterir. Schema.org açısından LocalBusiness.location
// veya ayrı bir Place node'u olarak bağlanabilir.
// ============================================================

export const WAREHOUSE_INFO = {
  name: 'Tuzla Tepeören Deposu',

  address: {
    streetAddress:   'Orhanlı Mescit Mh. Demokrasi Cd. No:5',
    addressLocality: 'Tuzla',
    addressRegion:   'İstanbul',
    addressCountry:  'TR',
  },
  addressLine:    'Orhanlı Mescit Mh. Demokrasi Cd. No:5',
  cityLine:       'Tuzla / İstanbul',
  proximityNote:  'Tuzla Orhanlı Nakliyeciler Sitesine 2 km · 4 dk. mesafede',

  // GPS — Google Maps embed/direction URL'lerinde de kullanılır.
  geo: {
    latitude:  40.8933583,
    longitude: 29.3547698,
  },

  // Yol tarifi URL (UI'da "Yol Tarifi Al" CTA için)
  mapsDirectionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=40.8933583,29.3547698',
} as const;

// ============================================================
// @id referansları — @graph entity zinciri için
// ============================================================
//
// Bir sayfada birden fazla schema (Product + Organization + Offer)
// olunca, Product.seller veya Offer.seller alanı tam Organization
// node'unu inline tekrarlamak yerine `{ '@id': BUSINESS_ID }` pointer
// kullanır. Knowledge Graph entity füzyonu bu sayede temiz olur.

export const BUSINESS_ID  = `${BUSINESS_INFO.url}/#organization` as const;
export const WAREHOUSE_ID = `${BUSINESS_INFO.url}/#warehouse`    as const;
export const WEBSITE_ID   = `${BUSINESS_INFO.url}/#website`      as const;
export const PERSON_ID    = `${BUSINESS_INFO.url}/#founder`      as const;

/** publisher / provider / seller alanları için pointer. */
export const BUSINESS_REF  = { '@id': BUSINESS_ID }  as const;
export const WAREHOUSE_REF = { '@id': WAREHOUSE_ID } as const;
export const WEBSITE_REF   = { '@id': WEBSITE_ID }   as const;
export const PERSON_REF    = { '@id': PERSON_ID }    as const;

// ============================================================
// BRAND_INFO — Marka metadata + sameAs URL'leri
// ============================================================
//
// Sprint 1 / Madde 3 — Brand standalone schema'sı için canonical
// kaynak. Marka sayfalarındaki Brand node ve ürün detay sayfalarındaki
// Product.brand pointer buradan beslenir.
//
// sameAs URL'leri Knowledge Graph entity füzyonu için kritik — Google
// "Dalmaçyalı" markasını dalmacyali.com.tr ile aynı entity sayar.
//
// Fawori (Optimix + Expert) Filli Boya'nın markaları olduğundan her
// ikisi de hem fawori.com hem filliboya.com URL'leriyle bağlanır.
// ============================================================

export type BrandSlug = 'dalmacyali' | 'filli-boya' | 'optimix' | 'tekno';

export interface BrandMeta {
  /** UI'da gösterilen marka adı */
  name: string;
  /** Schema @id — marka entity zinciri için */
  id: string;
  /** Resmi web siteleri (Knowledge Graph entity bağı) */
  sameAs: readonly string[];
  /** Opsiyonel: parent organization (ör. Fawori → Filli Boya) */
  parentName?: string;
}

export const BRAND_INFO: Record<BrandSlug, BrandMeta> = {
  'dalmacyali': {
    name:   'Dalmaçyalı',
    id:     `${BUSINESS_INFO.url}/#brand-dalmacyali`,
    sameAs: ['https://www.dalmacyali.com.tr/'],
  },
  'filli-boya': {
    // /marka/filli-boya rotası "Fawori Expert" (Filli Boya'nın taşyünü markası)
    name:   'Fawori Expert',
    id:     `${BUSINESS_INFO.url}/#brand-fawori-expert`,
    sameAs: ['https://www.fawori.com/', 'https://www.filliboya.com/'],
    parentName: 'Filli Boya',
  },
  'optimix': {
    name:   'Fawori Optimix',
    id:     `${BUSINESS_INFO.url}/#brand-fawori-optimix`,
    sameAs: ['https://www.fawori.com/', 'https://www.filliboya.com/'],
    parentName: 'Filli Boya',
  },
  'tekno': {
    name:   'TEKNO',
    id:     `${BUSINESS_INFO.url}/#brand-tekno`,
    sameAs: ['https://teknoyapikimyasallari.com/', 'https://teknoyapi.com.tr/'],
  },
};

/** Marka slug → @id pointer (Product.brand veya marka sayfası schema'sı için). */
export function brandRef(slug: BrandSlug) {
  return { '@id': BRAND_INFO[slug].id };
}

// ============================================================
// UI helper'ları — bileşenlerin pratik kullanımı için
// ============================================================

/** WhatsApp tıklamaları için tek doğruluk wa.me URL'i. */
export const WHATSAPP_URL = `https://wa.me/${BUSINESS_INFO.phone.whatsapp}` as const;

/** tel: protokolü için tek doğruluk URI. */
export const TEL_URL = `tel:${BUSINESS_INFO.phone.tel}` as const;

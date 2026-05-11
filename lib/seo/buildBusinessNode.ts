// ============================================================
// Schema.org @graph node üreticileri
//
// BUSINESS_INFO + WAREHOUSE_INFO sözlüğünden Schema.org Organization /
// LocalBusiness / Place node'ları üretir. Tüm sayfalardaki schema'lar
// bu üreticileri kullanır; inline duplicate tanımlama yapılmaz.
//
// Audit raporu §5 — @graph + BUSINESS_REF entity zinciri için altyapı.
// ============================================================

import {
  BUSINESS_INFO,
  BUSINESS_ID,
  WAREHOUSE_INFO,
  WAREHOUSE_ID,
} from '@/lib/business/info';

// ─── Kanonik Organization + LocalBusiness ────────────────────

export interface BuildBusinessNodeOptions {
  /** Founding/founder bilgisini override etmek için (default: BUSINESS_INFO'dan). */
  foundingDate?: string;
  founder?: string;
}

/**
 * Kanonik Organization + LocalBusiness node. Knowledge Graph + @graph
 * pattern için canonical entity. publisher/provider/seller alanları
 * burada inline değil, BUSINESS_REF ({ '@id': BUSINESS_ID }) pointer'ı
 * ile bu node'a bağlanır.
 */
export function buildBusinessNode(opts: BuildBusinessNodeOptions = {}) {
  const foundingDate = opts.foundingDate ?? BUSINESS_INFO.foundingDate;
  const founder      = opts.founder      ?? BUSINESS_INFO.founder;

  return {
    '@type': ['Organization', 'LocalBusiness'] as const,
    '@id':   BUSINESS_ID,
    name:        BUSINESS_INFO.brandName,
    legalName:   BUSINESS_INFO.legalName,
    url:         BUSINESS_INFO.url,
    telephone:   BUSINESS_INFO.phone.tel,
    email:       BUSINESS_INFO.email,
    address: {
      '@type': 'PostalAddress' as const,
      streetAddress:   BUSINESS_INFO.address.streetAddress,
      addressLocality: BUSINESS_INFO.address.addressLocality,
      addressRegion:   BUSINESS_INFO.address.addressRegion,
      addressCountry:  BUSINESS_INFO.address.addressCountry,
    },
    areaServed: {
      '@type': BUSINESS_INFO.areaServed.type,
      name:    BUSINESS_INFO.areaServed.name,
    },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification' as const,
      dayOfWeek: [...BUSINESS_INFO.openingHours.days],
      opens:     BUSINESS_INFO.openingHours.opens,
      closes:    BUSINESS_INFO.openingHours.closes,
    }],
    priceRange: BUSINESS_INFO.priceRange,
    foundingDate,
    founder: { '@type': 'Person' as const, name: founder },
  };
}

// ─── Depo (Place) node ───────────────────────────────────────

/**
 * Depo lokasyonu — kurumsal ofisten farklı fiziksel yer.
 * /depomuz sayfasında ana entity olarak kullanılır.
 */
export function buildWarehouseNode() {
  return {
    '@type': 'Place' as const,
    '@id':   WAREHOUSE_ID,
    name: WAREHOUSE_INFO.name,
    address: {
      '@type': 'PostalAddress' as const,
      streetAddress:   WAREHOUSE_INFO.address.streetAddress,
      addressLocality: WAREHOUSE_INFO.address.addressLocality,
      addressRegion:   WAREHOUSE_INFO.address.addressRegion,
      addressCountry:  WAREHOUSE_INFO.address.addressCountry,
    },
    geo: {
      '@type':   'GeoCoordinates' as const,
      latitude:  WAREHOUSE_INFO.geo.latitude,
      longitude: WAREHOUSE_INFO.geo.longitude,
    },
    // Place'i Organization'a bağlar — Knowledge Graph entity ilişkisi.
    containedInPlace: { '@id': BUSINESS_ID },
  };
}

// ─── @graph wrapper ──────────────────────────────────────────

/**
 * @graph wrapper — tek bir <script type="application/ld+json"> içinde
 * birden fazla schema entity'sini birleştirir. Çağıran sayfa kendi
 * ekstra node'larını (Product, FAQPage, BreadcrumbList, vs.) verir.
 *
 * Çağrı örneği:
 *   <script type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(
 *       buildBusinessGraph([productNode, breadcrumbNode], { includeWarehouse: true })
 *     )}}
 *   />
 */
export interface BuildBusinessGraphOptions extends BuildBusinessNodeOptions {
  /** Sayfada depo node'u da inline olsun mu? (/depomuz, /hakkimizda gibi sayfalar için) */
  includeWarehouse?: boolean;
}

export function buildBusinessGraph(
  extraNodes: object[] = [],
  opts: BuildBusinessGraphOptions = {},
) {
  const graph: object[] = [buildBusinessNode(opts)];

  if (opts.includeWarehouse) {
    graph.push(buildWarehouseNode());
  }

  for (const node of extraNodes) {
    graph.push(node);
  }

  return {
    '@context': 'https://schema.org' as const,
    '@graph':   graph,
  };
}

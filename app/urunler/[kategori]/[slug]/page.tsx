import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import ProductImage     from '@/components/catalog/ProductImage';
import ThicknessSelector from '@/components/catalog/ThicknessSelector';
import ProductPricePanel from '@/components/catalog/ProductPricePanel';
import MobileProductHero from '@/components/catalog/MobileProductHero';
import { ProductInteractiveProvider } from '@/components/catalog/ProductInteractiveContext';
import { getCatalogProduct } from '@/lib/catalog/server';
import { getCatalogProducts } from '@/lib/catalog/server';
import { KATEGORI_MAP } from '@/lib/catalog/categories';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { buildBreadcrumbList } from '@/lib/seo/buildBreadcrumbList';
import { SITE_ORIGIN } from '@/lib/seo/siteConfig';
import { BUSINESS_REF, BRAND_INFO, type BrandSlug } from '@/lib/business/info';
import { buildBrandNode, brandSlugByName } from '@/lib/seo/buildBrand';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { unstable_cache } from 'next/cache';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import { ErrorBoundaryWrapper } from '@/components/shared/ErrorBoundaryWrapper';
import BrandTrustLogos from '@/components/shared/BrandTrustLogos';
import { computeM2Price } from '@/lib/catalog/pricing';
import {
  resolveMarginPctStrict,
  type MarginRuleInput,
} from '@/lib/pricing/margin';
import { formatThicknessSegment } from '@/lib/catalog/thickness-url';
import type { CatalogProductView } from '@/lib/catalog/types';

// Tam statik (force-static): tüm ürün detayları build'de prerender → CDN'den servis → ISR Read Unit = 0.
// Fiyatlar aylık güncelleniyor; ay başı (otomatik) redeploy fiyat snapshot'ını ve metadata'yı yeniler.
// Fiyat hesabı tek kaynaktan: server'dan gelen `product` prop, client'ta canlı API yok →
// statikleştirme hesabı/tutarlılığı bozmaz, yalnızca veri anlık görüntüsünün alındığı zamanı build'e taşır.
export const dynamic = 'force-static';

// logistics_capacity nadiren değişir; ay başı deploy'u ile yenilenir.
const getLogisticsCapacity = unstable_cache(
  async () => {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from('logistics_capacity')
      .select('thickness, lorry_capacity_m2, truck_capacity_m2, package_size_m2, lorry_capacity_packages, truck_capacity_packages')
      .order('thickness');
    return (data ?? []) as {
      thickness: number;
      lorry_capacity_m2: string | number;
      truck_capacity_m2: string | number;
      package_size_m2: string | number;
      lorry_capacity_packages: number;
      truck_capacity_packages: number;
    }[];
  },
  ['logistics_capacity'],
  // Zaman bazlı revalidate yok → force-static ile sayfa tam statik (ISR Read Unit = 0).
  // logistics kapasite verisi build'de bakılır; aylık redeploy veya revalidateTag('logistics') ile tazelenir.
  { tags: ['logistics'] }
);

// ─── Şehir öncelik sırası ────────────────────────────────────

const PRIORITY_CITIES = [
  'İstanbul', 'Kocaeli', 'Bursa', 'Bolu', 'Sakarya',
  'Düzce', 'Tekirdağ', 'Yalova', 'Balıkesir',
];

function sortZones(zones: { city_code: number; city_name: string; base_shipping_cost: string | number; optimix_levha_discount: string | number; discount_kamyon: string | number; discount_tir: string | number }[]) {
  const prio = new Map(PRIORITY_CITIES.map((n, i) => [n.toLocaleLowerCase('tr-TR'), i]));
  return [...zones].sort((a, b) => {
    const ak = a.city_name.toLocaleLowerCase('tr-TR');
    const bk = b.city_name.toLocaleLowerCase('tr-TR');
    const ai = prio.get(ak);
    const bi = prio.get(bk);
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return a.city_name.localeCompare(b.city_name, 'tr-TR');
  });
}

// ─── Tip sabitleri ───────────────────────────────────────────

const KATEGORI_LABELS: Record<string, string> = {
  'tasyunu-levha': 'Taşyünü Levha',
  'eps-levha':     'EPS Levha',
  aksesuar:        'Aksesuar',
};

const SEARCH_LABELS: Record<string, string> = {
  'tasyunu-levha': 'Taş Yünü',
  'eps-levha': 'EPS Levha',
};

const BADGE_MAP: Record<string, { label: string; cls: string }> = {
  single_only:     { label: 'Direkt Alım',   cls: 'bg-green-900/50 text-green-400 border-green-800'  },
  single_or_quote: { label: 'Alım / Teklif', cls: 'bg-fe-raised/50 text-fe-muted border-fe-border'   },
  quote_only:      { label: 'Teklif',         cls: 'bg-brand-900/50 text-brand-400 border-brand-800' },
  system_only:     { label: 'Sistem Ürünü',   cls: 'bg-fe-raised text-fe-muted border-fe-border'    },
};

function buildProductOffers({
  product,
  productUrl,
  zone,
  logisticsCapacity,
  marginPct,
}: {
  product: CatalogProductView;
  productUrl: string;
  zone: { city_code: number; discount_tir: string | number } | null;
  logisticsCapacity: Array<{ thickness: number; package_size_m2: string | number }>;
  marginPct: number | null;
}) {
  const canExposePrice =
    product.rules.pricing_visibility_mode === 'from_price' ||
    product.rules.pricing_visibility_mode === 'exact_price';

  if (!canExposePrice) return undefined;

  if (product.thickness_prices && product.thickness_prices.length > 0) {
    const prices = product.thickness_prices
      .map((row) => computeM2Price({
        product,
        thickness: row.thickness,
        zone,
        logisticsCapacity,
        marginPct,
      }))
      .filter((price): price is number => price !== null && Number.isFinite(price) && price > 0);

    if (prices.length > 0) {
      return {
        '@type': 'AggregateOffer' as const,
        priceCurrency: 'TRY',
        lowPrice: Math.min(...prices).toFixed(2),
        highPrice: Math.max(...prices).toFixed(2),
        offerCount: prices.length,
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: productUrl,
        seller: BUSINESS_REF,
      };
    }
  }

  if (product.product_type === 'plate') return undefined;

  if (product.base_price !== null && product.base_price > 0) {
    return {
      '@type': 'Offer' as const,
      priceCurrency: 'TRY',
      price: product.base_price.toFixed(2),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: productUrl,
      seller: BUSINESS_REF,
    };
  }

  return undefined;
}

// ─── Props ───────────────────────────────────────────────────

interface Props {
  params:       Promise<{ kategori: string; slug: string }>;
}

export async function generateStaticParams() {
  const [tasyunu, eps, aksesuar] = await Promise.all([
    getCatalogProducts('tasyunu'),
    getCatalogProducts('eps'),
    getCatalogProducts('aksesuar'),
  ]);

  return [...tasyunu.products, ...eps.products, ...aksesuar.products].flatMap((product) => {
    if (product.material_type === 'tasyunu') {
      return [{ kategori: 'tasyunu-levha', slug: product.slug }];
    }

    if (product.material_type === 'eps') {
      return [{ kategori: 'eps-levha', slug: product.slug }];
    }

    const kategoriEntry = Object.entries(KATEGORI_MAP).find(
      ([, info]) => info.accessoryTypeSlug === product.category.slug
    );

    return kategoriEntry ? [{ kategori: kategoriEntry[0], slug: product.slug }] : [];
  });
}

function formatMonthYear(date = new Date()) {
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

function buildProductPath(kategori: string, slug: string, thickness?: number | null) {
  const base = `/urunler/${kategori}/${slug}`;
  return thickness != null ? `${base}/${formatThicknessSegment(thickness)}` : base;
}

function buildThicknessMeta({
  product,
  kategori,
  thickness,
}: {
  product: CatalogProductView;
  kategori: string;
  thickness: number;
}) {
  const monthYear = formatMonthYear();
  const searchLabel = SEARCH_LABELS[kategori] ?? product.category.name;
  const title = `${thickness} cm ${searchLabel} Fiyatları - ${monthYear} | ${product.name}`;
  const description =
    `${product.name} ${thickness} cm ${searchLabel.toLocaleLowerCase('tr-TR')} m2 fiyatı, paket metrajı ve teslimat seçenekleri. ${monthYear} güncel fiyatla şehir ve metraja göre PDF teklif alın.`;

  return { title, description };
}

export async function generateProductMetadata({
  kategori,
  slug,
  thickness,
}: {
  kategori: string;
  slug: string;
  thickness?: number | null;
}): Promise<Metadata> {
  const data = await getCatalogProduct(slug, kategori);
  if (!data) return { title: 'Ürün Bulunamadı' };

  const { product } = data;
  const supportsThickness =
    thickness != null &&
    Array.isArray(product.thickness_options) &&
    product.thickness_options.includes(thickness);

  const thicknessMeta =
    supportsThickness && thickness != null
      ? buildThicknessMeta({ product, kategori, thickness })
      : null;

  return buildMetadata({
    title: thicknessMeta?.title ?? product.meta_title ?? `${product.name} ${KATEGORI_LABELS[kategori] ?? product.category.name} Fiyatları`,
    description:
      thicknessMeta?.description ??
      product.meta_description ??
      product.catalog_description ??
      `${product.brand.name} ${product.name} ürün detayları, fiyat ve teklif.`,
    path: buildProductPath(kategori, slug, supportsThickness ? thickness : null),
    image: product.image_cover,
    type: 'product',
  });
}

// ─── Metadata ───────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, kategori } = await params;
  return generateProductMetadata({ kategori, slug });
}

// ─── Page ────────────────────────────────────────────────────

export async function ProductDetailPage({
  kategori,
  slug,
  selectedThickness,
}: {
  kategori: string;
  slug: string;
  selectedThickness?: number | null;
}) {
  // Paralel veri çekimi (logistics ayrı cache'ten)
  const supabase = createServerSupabaseClient();
  const [productData, zonesResult, logisticsCapacity, marginRulesResult] = await Promise.all([
    getCatalogProduct(slug, kategori),
    supabase
      .from('shipping_zones')
      .select('city_code, city_name, base_shipping_cost, optimix_levha_discount, discount_kamyon, discount_tir')
      .eq('is_active', true)
      .order('city_name'),
    getLogisticsCapacity(),
    supabase
      .from('material_types')
      .select('slug, tier1_max_m2, tier1_margin_pct, tier2_max_m2, tier2_margin_pct, tier3_margin_pct'),
  ]);

  if (!productData) notFound();

  const { product, decision } = productData;
  const shippingZones = sortZones((zonesResult.data ?? []) as {
    city_code: number; city_name: string; base_shipping_cost: string | number;
    optimix_levha_discount: string | number; discount_kamyon: string | number; discount_tir: string | number;
  }[]);

  const selectedThicknessValue =
    selectedThickness != null && Number.isFinite(selectedThickness)
      ? selectedThickness
      : null;
  const isValidThickness  =
    selectedThicknessValue !== null &&
    Array.isArray(product.thickness_options) &&
    product.thickness_options.includes(selectedThicknessValue);

  const activePrefill = product.wizard_prefill
    ? { ...product.wizard_prefill, kalinlik: isValidThickness ? selectedThicknessValue : product.wizard_prefill.kalinlik }
    : null;

  const badge = BADGE_MAP[product.rules.sales_mode] ?? BADGE_MAP.quote_only;
  const kategoriLabel = KATEGORI_LABELS[kategori] ?? kategori;
  const defaultZone = shippingZones.find((zone) => zone.city_code === 34) ?? shippingZones[0] ?? null;
  const pagePath = buildProductPath(kategori, slug, isValidThickness ? selectedThicknessValue : null);
  const materialMarginRule = (marginRulesResult.data ?? []).find(
    (rule) => rule.slug === product.material_type
  ) as MarginRuleInput | undefined;
  // Schema'daki başlangıç fiyatı yüksek hacim/TIR çıpasıdır; tier3 açıkça seçilir.
  const catalogMarginPct = product.product_type === 'plate'
    ? resolveMarginPctStrict(materialMarginRule, Number.MAX_SAFE_INTEGER)
    : null;

  // Provider initial values (mobil hero + panel + picker hepsi context'ten beslenir)
  const initialCityCode = defaultZone?.city_code ?? 34;
  const initialThickness = isValidThickness
    ? selectedThicknessValue
    : (activePrefill?.kalinlik ??
       (Array.isArray(product.thickness_options) && product.thickness_options.length > 0
         ? product.thickness_options[0]
         : null));

  // ─── Schema.org JSON-LD ──────────────────────────────────────
  const productUrl = `${SITE_ORIGIN}${pagePath}`;
  const productImage = product.image_cover
    ? (product.image_cover.startsWith('http') ? product.image_cover : `${SITE_ORIGIN}${product.image_cover}`)
    : `${SITE_ORIGIN}/og-image.png`;
  const productOffers = buildProductOffers({
    product,
    productUrl,
    zone: defaultZone,
    logisticsCapacity,
    marginPct: catalogMarginPct,
  });

  // ─── Schema.org @graph ──────────────────────────────────
  // Product + Brand + BreadcrumbList tek script tag içinde.
  // Brand BRAND_INFO'da varsa standalone Brand node + Product.brand
  // @id pointer; yoksa inline fallback (Product.brand içinde name).
  const brandSlug: BrandSlug | null = brandSlugByName(product.brand.name);
  const brandNode = brandSlug ? buildBrandNode(brandSlug) : null;

  const productNode = {
    '@type': 'Product' as const,
    '@id':   `${productUrl}#product`,
    name: isValidThickness ? `${product.name} ${selectedThicknessValue} cm` : product.name,
    sku: slug,
    image: [productImage],
    url: productUrl,
    description: product.catalog_description ?? undefined,
    // Brand: @id pointer (standalone Brand node varsa) veya inline.
    brand: brandSlug
      ? { '@id': BRAND_INFO[brandSlug].id }
      : { '@type': 'Brand' as const, name: product.brand.name },
    category: product.category.name,
    ...(productOffers ? { offers: productOffers } : {}),
  };

  const breadcrumbNode = buildBreadcrumbList(
    [
      { name: 'Anasayfa', path: '/' },
      { name: 'Ürünler', path: '/urunler' },
      { name: kategoriLabel, path: `/urunler/${kategori}` },
      { name: product.name, path: `/urunler/${kategori}/${slug}` },
      ...(isValidThickness ? [{ name: `${selectedThicknessValue} cm`, path: pagePath }] : []),
    ],
    SITE_ORIGIN,
  );

  const jsonLdGraph = {
    '@context': 'https://schema.org' as const,
    '@graph': brandNode
      ? [productNode, brandNode, breadcrumbNode]
      : [productNode, breadcrumbNode],
  };

  return (
    <div className="min-h-screen bg-fe-bg flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />
      <SiteHeader />

      {/* Breadcrumb */}
      <div className="bg-fe-surface/80 border-b border-fe-border/60">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-2.5 sm:py-3.5">
          <nav className="flex items-center gap-1 text-xs text-fe-muted flex-wrap">
            <Link href="/" prefetch={false} className="hover:text-brand-400 transition-colors">Ana Sayfa</Link>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <Link href="/urunler" prefetch={false} className="hover:text-brand-400 transition-colors">Ürünler</Link>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <Link href={`/urunler/${kategori}`} prefetch={false} className="hover:text-brand-400 transition-colors">
              {kategoriLabel}
            </Link>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <span className="text-fe-text truncate max-w-[200px]">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Ana İçerik */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 lg:py-12">
        <ErrorBoundaryWrapper>
        <ProductInteractiveProvider
          initialCityCode={initialCityCode}
          initialThickness={initialThickness}
        >

        {/* Mobile: thumbnail + kimlik + kalınlık — fiyat paneli öncesinde bağlam */}
        <div className="lg:hidden mb-3 space-y-3">

          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-start gap-2">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <ProductImage
                  src={product.image_cover}
                  alt={product.name}
                  className="w-[60px] h-[60px] shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-xs text-brand-500 font-semibold uppercase tracking-wider">
                      {product.brand.name}
                    </span>
                    <span className="text-fe-muted">·</span>
                    <span className="text-xs text-fe-muted">{product.category.name}</span>
                  </div>
                  <h1 className="text-xl font-bold text-white leading-tight">
                    {product.name}
                  </h1>
                </div>
              </div>
              <MobileProductHero
                product={product}
                shippingZones={shippingZones}
                logisticsCapacity={logisticsCapacity}
              />
            </div>

            {product.thickness_options && product.thickness_options.length > 0 && (
              <div className="min-w-0">
                <Suspense fallback={
                  <div className="w-full rounded-[24px] border border-fe-border bg-fe-raised/40 p-3 text-center text-sm text-fe-muted">
                    Kalınlık
                  </div>
                }>
                  <ThicknessSelector
                    thicknessOptions={product.thickness_options}
                    popularThickness={product.wizard_prefill?.kalinlik ?? null}
                    mobileMode="inline"
                  />
                </Suspense>
              </div>
            )}
          </div>

          <p className="hidden text-[10px] text-fe-muted">
            Seçtiğiniz kalınlığa göre fiyatlar aşağıda gösterilir
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr] lg:gap-12 items-start">

          {/* ── SOL: Ürün Bilgileri ─────────────────────────── */}
          <div className="space-y-6 order-2 lg:order-1">

            {/* Görsel */}
            <ProductImage
              src={product.image_cover}
              alt={product.name}
              priority
              className="w-full aspect-[4/3] rounded-2xl"
            />

            {/* Başlık Bloğu — sadece desktop (mobilde üstteki lg:hidden blokta gösterilir) */}
            <div className="hidden lg:block">
              {/* Marka · Kategori · Satış Modu */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs text-brand-500 font-semibold uppercase tracking-wider">
                  {product.brand.name}
                </span>
                <span className="text-fe-muted">·</span>
                <span className="text-xs text-fe-muted">{product.category.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>

              {/* Ürün Adı */}
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2">
                {product.name}
              </h1>

              {product.model && (
                <p className="text-fe-muted text-sm">{product.model}</p>
              )}
            </div>

            {/* Kalınlık Seçici — sadece desktop */}
            {product.thickness_options && product.thickness_options.length > 0 && (
              <div className="hidden lg:block">
                <p className="text-xs text-fe-muted uppercase tracking-wide font-medium mb-2.5">
                  Kalınlık
                </p>
                <Suspense fallback={
                  <div className="flex flex-wrap gap-2">
                    {product.thickness_options.map(t => (
                      <span key={t} className="px-3 py-1.5 bg-fe-raised/60 text-fe-text text-sm rounded-lg border border-fe-border">
                        {t} cm
                      </span>
                    ))}
                  </div>
                }>
                  <ThicknessSelector
                    thicknessOptions={product.thickness_options}
                    popularThickness={product.wizard_prefill?.kalinlik ?? null}
                  />
                </Suspense>
              </div>
            )}

            {/* Açıklama */}
            {product.catalog_description && (
              <div className="pt-2 border-t border-fe-border/60">
                <p className="text-xs text-fe-muted uppercase tracking-wide font-medium mb-3">
                  Ürün Hakkında
                </p>
                <div className="bg-fe-raised/20 border-l-2 border-brand-500/40 pl-4 py-3 rounded-r-lg">
                  <p className="text-fe-text text-sm leading-relaxed">{product.catalog_description}</p>
                </div>
                {product.rules.requires_system_context && (
                  <p className="text-xs text-fe-muted mt-3 italic">
                    Doğru ürün kombinasyonu için sistem hesaplama önerilir.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── SAĞ: Dönüşüm Paneli ─────────────────────────── */}
          <div className="lg:sticky lg:top-6 order-1 lg:order-2">
            <div className="hidden lg:block mb-4 rounded-2xl border border-fe-border/70 bg-fe-raised/20 px-4 py-4">
              <BrandTrustLogos
                compact
                title="Bayilikler"
              />
            </div>
            <Suspense fallback={<PricePanelSkeleton />}>
              <ProductPricePanel
                product={product}
                decision={decision}
                prefill={activePrefill}
                shippingZones={shippingZones}
                logisticsCapacity={logisticsCapacity}
                selectedThickness={isValidThickness ? selectedThicknessValue : null}
                hideHeroPriceOnMobile
              />
            </Suspense>
            <div className="mt-4 rounded-2xl border border-fe-border/70 bg-fe-raised/20 px-4 py-4 lg:hidden">
              <BrandTrustLogos
                compact
                title="Bayilikler"
              />
            </div>
          </div>

        </div>
        </ProductInteractiveProvider>
        </ErrorBoundaryWrapper>
      </div>

      <SiteFooter />
    </div>
  );
}

export default async function UrunDetayPage({ params }: Props) {
  const { slug, kategori } = await params;
  return <ProductDetailPage kategori={kategori} slug={slug} />;
}

// ─── Skeleton ────────────────────────────────────────────────

function PricePanelSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="rounded-xl border border-fe-border bg-fe-raised/40 h-44" />
      <div className="rounded-xl border border-fe-border bg-fe-raised/40 h-40" />
    </div>
  );
}

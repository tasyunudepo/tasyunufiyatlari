import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import ProductCard from '@/components/catalog/ProductCard';
import { getCatalogProductsByBrand } from '@/lib/catalog/server';
import { KATEGORI_LIST } from '@/lib/catalog/categories';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { buildBreadcrumbList } from '@/lib/seo/buildBreadcrumbList';
import { buildBrandNode } from '@/lib/seo/buildBrand';
import { SITE_ORIGIN } from '@/lib/seo/siteConfig';
import { BRAND_INFO, type BrandSlug } from '@/lib/business/info';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';

export const BRAND_MAP: Record<
  string,
  { id: number; displayName: string; description: string }
> = {
  'dalmacyali': {
    id: 1,
    displayName: 'Dalmaçyalı',
    description: 'Dalmaçyalı taşyünü ve EPS ısı yalıtım levhaları, sistem aksesuarları.',
  },
  'filli-boya': {
    id: 2, // DB'de "Expert" kaydı = Fawori Expert
    displayName: 'Fawori Expert',
    description:
      'Filli Boya Fawori Expert taşyünü ve EPS ısı yalıtım levhaları, sistem aksesuarları.',
  },
  'optimix': {
    id: 4,
    displayName: 'Fawori Optimix',
    description: 'Fawori Optimix ısı yalıtım levhaları ve sistem aksesuarları.',
  },
  'tekno': {
    id: 6,
    displayName: 'TEKNO',
    description: 'TEKNO mantolama sistem ürünleri — yapıştırıcı, sıva, dübel, file ve dekoratif kaplamalar.',
  },
  'oem': {
    id: 11,
    displayName: 'Ekonomik (2.Kalite)',
    description: '2. kalite mantolama sistem ürünleri — bütçe odaklı projeler için ekonomik aksesuar serisi.',
  },
};
// 'fawori' ve 'filli-boya/expert' alias URL'leri next.config.ts redirect'iyle yakalanır.

interface Props {
  params: Promise<{ brand: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand } = await params;
  const info = BRAND_MAP[brand];
  if (!info) return {};
  return buildMetadata({
    title: `${info.displayName} Ürünleri`,
    description: info.description,
    path: `/marka/${brand}`,
  });
}

export default async function MarkaPage({ params }: Props) {
  const { brand } = await params;
  const info = BRAND_MAP[brand];
  // Bilinmeyen marka → 404 yerine ana ürün hub'ına yönlendir (eski URL kayıpsız hedef).
  if (!info) redirect('/urunler');

  const { plates, accessories } = await getCatalogProductsByBrand(info.id);

  // ─── Schema.org @graph ───────────────────────────────────
  // BRAND_INFO'da kayıtlı markalar için Brand node + sameAs üretilir.
  // 'oem' (Ekonomik 2.Kalite) gibi BRAND_INFO'da olmayanlar inline fallback.
  const brandNode =
    brand in BRAND_INFO
      ? buildBrandNode(brand as BrandSlug)
      : { '@type': 'Brand' as const, name: info.displayName };

  const breadcrumbNode = buildBreadcrumbList(
    [
      { name: 'Anasayfa', path: '/' },
      { name: 'Ürünler',  path: '/urunler' },
      { name: info.displayName, path: `/marka/${brand}` },
    ],
    SITE_ORIGIN,
  );

  const jsonLdGraph = {
    '@context': 'https://schema.org' as const,
    '@graph': [brandNode, breadcrumbNode],
  };

  // Bu markada hangi kategorilerde ürün var? Chip nav için.
  const categoriesWithProducts = new Set<string>();
  plates.forEach((p) => {
    if (p.material_type === 'tasyunu') categoriesWithProducts.add('tasyunu-levha');
    if (p.material_type === 'eps')     categoriesWithProducts.add('eps-levha');
  });
  accessories.forEach((a) => {
    const slug = a.category.slug === 'fileli-kose' ? 'fileli-kose-profilleri' : a.category.slug;
    categoriesWithProducts.add(slug);
  });
  const availableChips = KATEGORI_LIST.filter(({ slug }) => categoriesWithProducts.has(slug));

  return (
    <div className="min-h-screen bg-fe-bg flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />
      <SiteHeader />

      <div className="bg-fe-surface border-b border-fe-border">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          <nav className="flex items-center gap-1 text-xs text-fe-muted mb-4">
            <Link href="/" className="hover:text-brand-400 transition-colors">Ana Sayfa</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/urunler" className="hover:text-brand-400 transition-colors">Ürünler</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-fe-text">{info.displayName}</span>
          </nav>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">{info.displayName}</h1>
          <p className="text-fe-muted text-sm">{info.description}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 w-full">
        {availableChips.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {availableChips.map(({ slug, info: catInfo }) => (
              <Link
                key={slug}
                href={`/marka/${brand}/${slug}`}
                className="px-3 py-1.5 rounded-full bg-fe-surface border border-fe-border text-fe-text text-sm hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-colors"
              >
                {catInfo.title}
              </Link>
            ))}
          </div>
        )}

        {plates.length === 0 && accessories.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-fe-muted mb-4">{info.displayName} ürünleri yakında eklenecek.</p>
            <Link href="/" className="text-brand-400 hover:text-brand-300 text-sm underline">
              Hesap Makinesine Git
            </Link>
          </div>
        ) : (
          <>
            {plates.length > 0 && (
              <section className="mb-10">
                <h2 className="text-lg font-semibold text-white mb-4">Levhalar</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plates.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      kategori={p.material_type === 'tasyunu' ? 'tasyunu-levha' : 'eps-levha'}
                    />
                  ))}
                </div>
              </section>
            )}
            {accessories.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">Aksesuarlar</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accessories.map((a) => (
                    <ProductCard
                      key={a.id}
                      product={a}
                      kategori={a.category.slug === 'fileli-kose' ? 'fileli-kose-profilleri' : a.category.slug}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="mt-10 pt-8 border-t border-fe-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-fe-muted text-sm">Hesap makinesiyle doğrudan paket fiyatı alın.</p>
          <Link
            href="/"
            className="shrink-0 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Hesap Makinesi
          </Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

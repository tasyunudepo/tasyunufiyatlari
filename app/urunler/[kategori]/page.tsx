import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import ProductCard from '@/components/catalog/ProductCard';
import { getCatalogProducts } from '@/lib/catalog/server';
import { KATEGORI_MAP } from '@/lib/catalog/categories';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { buildBreadcrumbList } from '@/lib/seo/buildBreadcrumbList';
import { SITE_ORIGIN } from '@/lib/seo/siteConfig';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';

interface Props {
  params: Promise<{ kategori: string }>;
}

// Tam statik: build'de bir kez prerender → CDN'den servis (ISR read unit = 0).
// İçerik tazeliği aylık cron redeploy ile sağlanır (.github/workflows/monthly-vercel-deploy.yml).
export const dynamic = 'force-static';

export function generateStaticParams() {
  return Object.keys(KATEGORI_MAP).map((kategori) => ({ kategori }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kategori } = await params;
  const info = KATEGORI_MAP[kategori];
  if (!info) return {};
  return buildMetadata({
    title: info.title,
    description: info.desc,
    path: `/urunler/${kategori}`,
  });
}

export default async function KategoriPage({ params }: Props) {
  const { kategori } = await params;
  const info = KATEGORI_MAP[kategori];
  if (!info) notFound();

  const { products } = await getCatalogProducts(
    info.material,
    info.accessoryTypeSlug ? { accessoryTypeSlug: info.accessoryTypeSlug } : undefined
  );

  const breadcrumbNode = buildBreadcrumbList(
    [
      { name: 'Anasayfa', path: '/' },
      { name: 'Ürünler', path: '/urunler' },
      { name: info.title, path: `/urunler/${kategori}` },
    ],
    SITE_ORIGIN,
  );

  const jsonLdGraph = {
    '@context': 'https://schema.org' as const,
    '@graph': [breadcrumbNode],
  };

  return (
    <div className="min-h-screen bg-fe-bg flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />
      <SiteHeader />

      {/* Breadcrumb + başlık */}
      <div className="bg-fe-surface border-b border-fe-border">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs text-fe-muted mb-4">
            <Link href="/" prefetch={false} className="hover:text-brand-400 transition-colors">Ana Sayfa</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/urunler" prefetch={false} className="hover:text-brand-400 transition-colors">Ürünler</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-fe-text">{info.title}</span>
          </nav>

          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">{info.title}</h1>
          <p className="text-fe-muted text-sm">{info.desc}</p>
        </div>
      </div>

      {/* Ürün grid */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-fe-muted mb-4">
              {info.emptyHint ?? 'Bu kategoride henüz ürün bulunmuyor.'}
            </p>
            <Link
              href={info.emptyHint ? '/' : '/urunler'}
              prefetch={false}
              className="text-brand-400 hover:text-brand-300 text-sm underline"
            >
              {info.emptyHint ? 'Hesap Makinesine Git' : 'Tüm kategorilere dön'}
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-fe-muted mb-5">{products.length} ürün</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  kategori={kategori}
                />
              ))}
            </div>
          </>
        )}

        {/* Alt CTA */}
        <div className="mt-10 pt-8 border-t border-fe-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-fe-muted text-sm">
            Ürün bulmakta zorlanıyor musunuz? Hesap makinesiyle doğrudan hesaplayın.
          </p>
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

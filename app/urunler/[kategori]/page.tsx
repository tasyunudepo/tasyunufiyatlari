import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import ProductCard from '@/components/catalog/ProductCard';
import TasyunuCategoryExperience from '@/components/catalog/TasyunuCategoryExperience';
import { getCatalogProducts } from '@/lib/catalog/server';
import { KATEGORI_MAP } from '@/lib/catalog/categories';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { buildBreadcrumbList } from '@/lib/seo/buildBreadcrumbList';
import { SITE_ORIGIN } from '@/lib/seo/siteConfig';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import { createServerSupabaseClient } from '@/lib/supabase-server';

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

  const catalogPromise = getCatalogProducts(
    info.material,
    info.accessoryTypeSlug ? { accessoryTypeSlug: info.accessoryTypeSlug } : undefined,
  );
  const zonesPromise = kategori === 'tasyunu-levha'
    ? createServerSupabaseClient()
        .from('shipping_zones')
        .select('city_code, city_name')
        .eq('is_active', true)
        .order('city_name')
    : Promise.resolve({ data: [] as Array<{ city_code: number; city_name: string }> });
  const [{ products }, zonesResult] = await Promise.all([catalogPromise, zonesPromise]);
  const shippingZones = [...(zonesResult.data ?? [])]
    .sort((a, b) => {
      if (a.city_code === 34) return -1;
      if (b.city_code === 34) return 1;
      return a.city_name.localeCompare(b.city_name, 'tr-TR');
    });

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

  if (kategori === 'tasyunu-levha' && products.length > 0) {
    return (
      <div className="flex min-h-screen min-w-0 flex-col bg-hub-warm text-hub-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
        />
        <SiteHeader tone="warm" />
        <TasyunuCategoryExperience products={products} shippingZones={shippingZones} />
        <SiteFooter tone="warm" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-fe-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />
      <SiteHeader />

      {/* Breadcrumb + başlık */}
      <div className="bg-fe-surface border-b border-fe-border">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          {/* Breadcrumb */}
          <nav aria-label="İçerik yolu" className="mb-4 flex items-center gap-1 text-xs text-fe-muted">
            <Link href="/" prefetch={false} className="hover:text-brand-400 transition-colors">Ana Sayfa</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/urunler" prefetch={false} className="hover:text-brand-400 transition-colors">Ürünler</Link>
            <ChevronRight className="w-3 h-3" />
            <span aria-current="page" className="text-fe-text">{info.title}</span>
          </nav>

          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <h1 className="mb-2 text-xl font-bold text-white sm:text-2xl">{info.title}</h1>
              <p className="text-sm text-fe-muted">{info.desc}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ürün grid */}
      <main className="mx-auto w-full max-w-5xl min-w-0 px-4 py-8">
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
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  kategori={kategori}
                  // İlk iki satır (3 sütun × 2) ekran üstündedir; LCP görseli
                  // lazy kalırsa Next uyarı verir ve LCP gecikir.
                  imagePriority={index < 6}
                />
              ))}
            </div>
          </>
        )}

        {/* Alt CTA */}
        <div className="mt-10 pt-8 border-t border-fe-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-fe-muted text-sm">
            {info.material === 'eps'
              ? 'EPS projeniz için ürün, şehir, kalınlık ve metrajla fiyat hesabına geçin.'
              : 'Aradığınız ürünü bulamadıysanız tüm ürün gruplarını inceleyin.'}
          </p>
          <Link
            href={info.material === 'eps' ? '/#mantolama-hesaplayici' : '/urunler'}
            className="shrink-0 bg-brand-600 hover:bg-brand-500 text-[#0b0b0c] px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            {info.material === 'eps' ? 'Fiyatımı Hesapla' : 'Tüm Ürünler'}
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

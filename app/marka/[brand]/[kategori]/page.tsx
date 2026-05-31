import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import ProductCard from '@/components/catalog/ProductCard';
import { getCatalogProducts } from '@/lib/catalog/server';
import { KATEGORI_MAP } from '@/lib/catalog/categories';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { BRAND_MAP } from '../page';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';

interface Props {
  params: Promise<{ brand: string; kategori: string }>;
}

// Tam statik: build'de bir kez prerender → CDN'den servis (ISR read unit = 0).
// İçerik tazeliği aylık cron redeploy ile sağlanır (.github/workflows/monthly-vercel-deploy.yml).
export const dynamic = 'force-static';

export function generateStaticParams() {
  return Object.keys(BRAND_MAP).flatMap((brand) =>
    Object.keys(KATEGORI_MAP).map((kategori) => ({ brand, kategori }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand, kategori } = await params;
  const brandInfo = BRAND_MAP[brand];
  const catInfo = KATEGORI_MAP[kategori];
  if (!brandInfo || !catInfo) return {};
  return buildMetadata({
    title: `${brandInfo.displayName} ${catInfo.title}`,
    description: `${brandInfo.displayName} ${catInfo.title.toLowerCase()} ürünleri. ${catInfo.desc}`,
    path: `/marka/${brand}/${kategori}`,
  });
}

export default async function MarkaKategoriPage({ params }: Props) {
  const { brand, kategori } = await params;
  const brandInfo = BRAND_MAP[brand];
  const catInfo = KATEGORI_MAP[kategori];
  // Bilinmeyen marka → ana hub; bilinmeyen kategori (marka geçerli) → marka ana sayfası.
  if (!brandInfo) redirect('/urunler');
  if (!catInfo)   redirect(`/marka/${brand}`);

  const { products } = await getCatalogProducts(catInfo.material, {
    brandId: brandInfo.id,
    ...(catInfo.accessoryTypeSlug ? { accessoryTypeSlug: catInfo.accessoryTypeSlug } : {}),
  });

  return (
    <div className="min-h-screen bg-fe-bg flex flex-col">
      <SiteHeader />

      <div className="bg-fe-surface border-b border-fe-border">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          <nav className="flex items-center gap-1 text-xs text-fe-muted mb-4">
            <Link href="/" prefetch={false} className="hover:text-brand-400 transition-colors">Ana Sayfa</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/urunler" prefetch={false} className="hover:text-brand-400 transition-colors">Ürünler</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href={`/marka/${brand}`} prefetch={false} className="hover:text-brand-400 transition-colors">
              {brandInfo.displayName}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-fe-text">{catInfo.title}</span>
          </nav>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {brandInfo.displayName} {catInfo.title}
          </h1>
          <p className="text-fe-muted text-sm">{catInfo.desc}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 w-full">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-fe-muted mb-4">
              {catInfo.emptyHint ??
                `${brandInfo.displayName} markasında bu kategoride ürün bulunmuyor.`}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href={`/marka/${brand}`}
                prefetch={false}
                className="text-brand-400 hover:text-brand-300 text-sm underline"
              >
                {brandInfo.displayName} ana sayfası
              </Link>
              <Link
                href={`/urunler/${kategori}`}
                prefetch={false}
                className="text-brand-400 hover:text-brand-300 text-sm underline"
              >
                Tüm {catInfo.title.toLowerCase()} markaları
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-fe-muted mb-5">{products.length} ürün</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} kategori={kategori} />
              ))}
            </div>
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

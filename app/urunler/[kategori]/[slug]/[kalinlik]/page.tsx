import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCatalogProducts } from '@/lib/catalog/server';
import { formatThicknessSegment, parseThicknessSegment } from '@/lib/catalog/thickness-url';
import {
  ProductDetailPage,
  generateProductMetadata,
} from '../page';

// Tam statik (force-static): tüm kalınlık varyantları build'de prerender → CDN → ISR Read Unit = 0.
// Fiyat tek kaynaktan (server product prop, client'ta canlı API yok); tazelik aylık redeploy ile.
export const dynamic = 'force-static';

interface Props {
  params: Promise<{ kategori: string; slug: string; kalinlik: string }>;
}

export async function generateStaticParams() {
  const [tasyunu, eps] = await Promise.all([
    getCatalogProducts('tasyunu'),
    getCatalogProducts('eps'),
  ]);

  return [...tasyunu.products, ...eps.products].flatMap((product) => {
    const kategori =
      product.material_type === 'tasyunu'
        ? 'tasyunu-levha'
        : product.material_type === 'eps'
          ? 'eps-levha'
          : null;

    if (!kategori || !Array.isArray(product.thickness_options)) return [];

    return product.thickness_options.map((thickness) => ({
      kategori,
      slug: product.slug,
      kalinlik: formatThicknessSegment(thickness),
    }));
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kategori, slug, kalinlik } = await params;
  const thickness = parseThicknessSegment(kalinlik);
  return generateProductMetadata({ kategori, slug, thickness });
}

export default async function ProductThicknessPage({ params }: Props) {
  const { kategori, slug, kalinlik } = await params;
  const thickness = parseThicknessSegment(kalinlik);

  if (thickness == null) notFound();

  const canonicalSegment = formatThicknessSegment(thickness);
  if (kalinlik !== canonicalSegment) {
    permanentRedirect(`/urunler/${kategori}/${slug}/${canonicalSegment}`);
  }

  return (
    <ProductDetailPage
      kategori={kategori}
      slug={slug}
      selectedThickness={thickness}
    />
  );
}

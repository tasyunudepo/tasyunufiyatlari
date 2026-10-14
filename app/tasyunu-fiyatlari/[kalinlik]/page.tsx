import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ComparisonHubPage from '@/components/compare/ComparisonHubPage';
import { HUB_THICKNESSES } from '@/lib/compare/hubs';
import { getThicknessHubData } from '@/lib/compare/hubPages.server';
import { formatThicknessSegment, parseThicknessSegment } from '@/lib/catalog/thickness-url';
import { buildMetadata } from '@/lib/seo/buildMetadata';

// Kalınlık hub'ı (Emrah onayı, 14 Ekim 2026): "10 cm taş yünü fiyatları" araması için o kalınlıktaki
// bütün mantolama levhaları yan yana. Tam statik; fiyatlar derleme anında sunucu HTML'ine yazılır,
// tablo açılınca canlı veriyle yeniden hesaplanır (ürün sayfalarıyla aynı tazelik: yayınla yenilenir).
export const dynamic = 'force-static';
export const dynamicParams = false;

interface Props {
  params: Promise<{ kalinlik: string }>;
}

export function generateStaticParams() {
  return HUB_THICKNESSES.map((t) => ({ kalinlik: formatThicknessSegment(t) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const thickness = parseThicknessSegment((await params).kalinlik);
  const data = thickness != null ? await getThicknessHubData(thickness) : null;
  if (!data) return { title: 'Sayfa bulunamadı' };
  return buildMetadata({ title: data.copy.title, description: data.copy.description, path: data.path, type: 'website' });
}

export default async function ThicknessHubPage({ params }: Props) {
  const thickness = parseThicknessSegment((await params).kalinlik);
  const data = thickness != null ? await getThicknessHubData(thickness) : null;
  if (!data) notFound();
  return <ComparisonHubPage {...data} />;
}

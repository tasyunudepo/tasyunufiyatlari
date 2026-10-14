import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ComparisonHubPage from '@/components/compare/ComparisonHubPage';
import { getDensity150HubData, getDensity150HubThicknesses } from '@/lib/compare/hubPages.server';
import { formatThicknessSegment, parseThicknessSegment } from '@/lib/catalog/thickness-url';
import { buildMetadata } from '@/lib/seo/buildMetadata';

// 150 yoğunluk + kalınlık hub'ı (Emrah onayı, 14 Ekim 2026): "taş yünü 10 cm 150 yoğunluk fiyatları"
// araması için yalnız föy beyanlı 150'likler. O kalınlıkta en az iki 150'liğin fiyatı varsa açılır.
export const dynamic = 'force-static';
export const dynamicParams = false;

interface Props {
  params: Promise<{ kalinlik: string }>;
}

export async function generateStaticParams() {
  return (await getDensity150HubThicknesses()).map((t) => ({ kalinlik: formatThicknessSegment(t) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const thickness = parseThicknessSegment((await params).kalinlik);
  const data = thickness != null ? await getDensity150HubData(thickness) : null;
  if (!data) return { title: 'Sayfa bulunamadı' };
  return buildMetadata({ title: data.copy.title, description: data.copy.description, path: data.path, type: 'website' });
}

export default async function Density150ThicknessHubPage({ params }: Props) {
  const thickness = parseThicknessSegment((await params).kalinlik);
  const data = thickness != null ? await getDensity150HubData(thickness) : null;
  if (!data) notFound();
  return <ComparisonHubPage {...data} />;
}

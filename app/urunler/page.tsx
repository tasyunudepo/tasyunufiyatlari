// /urunler hub sayfası — async Server Component.
// Tüm sayılar build/render time'da Supabase'den gelir (getUrunlerHubData).
// Sayfa dilini globals.css'teki --hub-* token grubu kuruyor.

import type { Metadata } from 'next';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import HubHero       from '@/components/urunler-hub/HubHero';
import FilterBar     from '@/components/urunler-hub/FilterBar';
import CategoryCards from '@/components/urunler-hub/CategoryCards';
import HubFooterCta  from '@/components/urunler-hub/HubFooterCta';
import { getUrunlerHubData } from '@/lib/catalog/hub';
import { buildMetadata } from '@/lib/seo/buildMetadata';

export const metadata: Metadata = buildMetadata({
  title: 'Ürün Kataloğu',
  description:
    'Taşyünü levha, EPS levha, dübel, yapıştırıcı, sıva, file, profil, astar, kaplama. Fabrika çıkışlı fiyat hesaplayıcı veya teklif al.',
  path: '/urunler',
});

export const revalidate = 2592000;

export default async function UrunlerPage() {
  const data = await getUrunlerHubData();

  return (
    <div className="min-h-screen bg-hub-warm flex flex-col">
      <SiteHeader tone="dark" />
      <HubHero totals={data.totals} />
      <FilterBar markalar={data.markalar} totalUrun={data.totals.urun} />
      <CategoryCards kategoriler={data.kategoriler} />
      <HubFooterCta />
      <SiteFooter tone="dark" />
    </div>
  );
}

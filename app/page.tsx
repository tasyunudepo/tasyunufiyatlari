import type { Metadata } from 'next';

import HomePageClient from '@/components/home/HomePageClient';
import HomePriceSummary from '@/components/home/HomePriceSummary';
import HomePriceTable, { type HomePriceRow } from '@/components/home/HomePriceTable';
import { HUB_THICKNESSES, density150HubPath, isDensity150, thicknessHubPath } from '@/lib/compare/hubs';
import { getDensity150HubThicknesses, getHubSnapshots } from '@/lib/compare/hubPages.server';
import { hubFacts } from '@/lib/compare/hubCopy';
import { homeDescription, homeTitle } from '@/lib/seo/homeMeta';
import { formatMonthYear } from '@/lib/seo/monthYear';
import { getComparisonProfiles } from '@/lib/technical-profiles';

const CITY_LABEL = 'İstanbul Avrupa Yakası';
const OG_IMAGE = '/og-image.png';

// Ana sayfa (14 Ekim 2026, hub planı Faz 4): gövde HomePageClient'ta durur; bu dosya "{ay yıl} taşyünü m² fiyatları"
// tablosunu derleme anı fiyat fotoğrafından hesaplar (sunucu HTML'inde).
// 17 Ekim 2026: ana sayfa "taş yünü fiyatları" hedefi — başlık, açıklama, ilk ekran özeti ve tablo AYNI satırlardan.
async function homePriceRows(): Promise<HomePriceRow[]> {
  const [snapshots, density150] = await Promise.all([getHubSnapshots(), getDensity150HubThicknesses()]);
  const profiles = getComparisonProfiles();
  const profiles150 = profiles.filter(isDensity150);
  return HUB_THICKNESSES.flatMap((t) => {
    const snapshot = snapshots.get(t);
    if (!snapshot) return [];
    const all = hubFacts(snapshot, profiles);
    const d150 = hubFacts(snapshot, profiles150);
    return [{
      thicknessCm: t,
      href: thicknessHubPath(t),
      count: all.priced.length,
      min: all.cheapest ? { unit: all.cheapest.kamyon.unit, name: all.cheapest.profile.displayName } : null,
      min150: d150.cheapest
        ? { unit: d150.cheapest.kamyon.unit, name: d150.cheapest.profile.displayName, href: density150.includes(t) ? density150HubPath(t) : null }
        : null,
    }];
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const monthYear = formatMonthYear();
  const title = homeTitle(monthYear);
  const description = homeDescription(await homePriceRows(), monthYear, CITY_LABEL);
  // Sayfa düzeyindeki openGraph/twitter, kök düzenindekinin yerine geçer (birleşmez) — alanların hepsi burada.
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: '/' },
    openGraph: {
      siteName: 'Taşyünü Fiyatları',
      type: 'website',
      locale: 'tr_TR',
      url: 'https://www.tasyunufiyatlari.com',
      title,
      description,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Taş yünü fiyatları ve mantolama teslim fiyatı hesabı' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE] },
  };
}

export default async function Home() {
  const rows = await homePriceRows();
  const monthYear = formatMonthYear();
  return (
    <HomePageClient
      priceSummary={<HomePriceSummary rows={rows} monthYear={monthYear} cityLabel={CITY_LABEL} />}
      priceTable={<HomePriceTable rows={rows} monthYear={monthYear} cityLabel={CITY_LABEL} />}
    />
  );
}

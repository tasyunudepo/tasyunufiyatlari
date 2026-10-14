import HomePageClient from '@/components/home/HomePageClient';
import HomePriceTable, { type HomePriceRow } from '@/components/home/HomePriceTable';
import { HUB_THICKNESSES, density150HubPath, isDensity150, thicknessHubPath } from '@/lib/compare/hubs';
import { getDensity150HubThicknesses, getHubSnapshots } from '@/lib/compare/hubPages.server';
import { hubFacts } from '@/lib/compare/hubCopy';
import { formatMonthYear } from '@/lib/seo/monthYear';
import { getComparisonProfiles } from '@/lib/technical-profiles';

// Ana sayfa (14 Ekim 2026, hub planı Faz 4): gövde HomePageClient'ta değişmeden durur; bu dosya yalnız
// "{ay yıl} taşyünü m² fiyatları" tablosunu derleme anı fiyat fotoğrafından hesaplar (sunucu HTML'inde).
export default async function Home() {
  const [snapshots, density150] = await Promise.all([getHubSnapshots(), getDensity150HubThicknesses()]);
  const profiles = getComparisonProfiles();
  const profiles150 = profiles.filter(isDensity150);
  const rows: HomePriceRow[] = HUB_THICKNESSES.flatMap((t) => {
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
  return (
    <HomePageClient
      priceTable={<HomePriceTable rows={rows} monthYear={formatMonthYear()} cityLabel="İstanbul Avrupa Yakası" />}
    />
  );
}

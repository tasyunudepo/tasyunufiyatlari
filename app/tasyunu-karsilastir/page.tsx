import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import ComparisonCenter from '@/components/compare/ComparisonCenter';
import MinimumOrderBanner from '@/components/sales/MinimumOrderBanner';
import HubLinkBand from '@/components/compare/HubLinkBand';
import { HUB_THICKNESSES, density150HubPath, thicknessHubPath } from '@/lib/compare/hubs';
import { getDensity150HubThicknesses, getHubSnapshots } from '@/lib/compare/hubPages.server';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { getComparisonProfiles } from '@/lib/technical-profiles';

// Karşılaştırma Merkezi (Sprint 2) — sayfa SSG'dir; teknik tablo statik
// HTML'e girer, ticari fiyatlar tarayıcıda gerçek hesapla dolar
// (revalidate bilinçli yok — katalog force-static kuralı).
// 14 Ekim 2026: açık zemine geçti (ürün sayfasıyla aynı kabuk), en az sipariş şeridi eklendi.

export const metadata: Metadata = buildMetadata({
  title: 'Taşyünü Levha Karşılaştırma — 8 Ürün, Aynı Koşulda',
  description:
    'Sıvalı dış cephe mantolamasına uygun 8 taşyünü levhayı karşılaştırın: föy beyanlı yoğunluk, ısı iletkenlik, mekanik dayanım ve aynı şehir/kalınlık koşulunda tam araç levha fiyatları.',
  path: '/tasyunu-karsilastir',
  type: 'website',
});

export default async function TasyunuKarsilastirPage() {
  const count = getComparisonProfiles().length;
  // Varsayılan koşulun (İstanbul, 5 cm) fiyatı sunucu HTML'ine yazılır; tablo açılınca canlı yenilenir.
  const [snapshots, density150] = await Promise.all([getHubSnapshots(), getDensity150HubThicknesses()]);
  return (
    <div className="flex min-h-screen flex-col bg-hub-warm">
      <SiteHeader />
      <MinimumOrderBanner
        remember={false}
        fallbackDetail="Her üründe 1 kamyonun m²’si ve tutarı yazar."
      />

      <main className="flex-1">
        <section className="border-b border-hub-rule">
          <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-8">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-hub-gold">
              Karşılaştırma Merkezi
            </p>
            <h1 className="font-heading text-2xl font-bold text-hub-ink sm:text-4xl">
              Taşyünü levhaları aynı koşulda karşılaştırın
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-hub-ink-2 sm:text-[15px] sm:leading-7">
              Sıvalı dış cephe mantolamasına uygun {count} levha tek tabloda: seçtiğiniz
              şehir ve kalınlıkta 1 kamyon siparişindeki m² fiyatı, en az sipariş tutarı ve föy değerleri.
              Yoğunluk odaklı görünüm:{' '}
              <Link href="/tasyunu-yogunluk/150-kg-m3" className="font-semibold text-hub-gold underline underline-offset-2 hover:no-underline">
                150 kg/m³ levhalar
              </Link>
              . Kalınlığa göre en düşük m² fiyatları:{' '}
              <Link href="/" className="font-semibold text-hub-gold underline underline-offset-2 hover:no-underline">
                güncel taş yünü fiyatları
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
          <ComparisonCenter variant="genel" snapshot={snapshots.get(5)} />
          <HubLinkBand
            className="mt-8"
            groups={[
              { title: 'Kalınlığa göre taş yünü fiyatları', links: HUB_THICKNESSES.map((t) => ({ label: `${t} cm`, href: thicknessHubPath(t) })) },
              { title: '150 yoğunluk, kalınlığa göre', links: density150.map((t) => ({ label: `${t} cm 150 yoğunluk`, href: density150HubPath(t) })) },
            ]}
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

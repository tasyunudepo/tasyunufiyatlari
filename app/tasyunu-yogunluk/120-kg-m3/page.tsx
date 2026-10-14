import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import ComparisonCenter from '@/components/compare/ComparisonCenter';
import MinimumOrderBanner from '@/components/sales/MinimumOrderBanner';
import HubLinkBand from '@/components/compare/HubLinkBand';
import { DENSITY_150_PATH, HUB_THICKNESSES, thicknessHubPath } from '@/lib/compare/hubs';
import { getHubSnapshots } from '@/lib/compare/hubPages.server';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { formatMonthYear } from '@/lib/seo/monthYear';

// 120 kg/m³ görünümü (Emrah, 14 Ekim 2026): "120 yoğunluk taşyünü fiyatları" araması için 120–125 sınıfı
// (Bonus F 120 föy 120 ±%10, Expert LD125 föy ≥125, Dalmaçyalı SW035 sözlü 110–120); 120'ye ulaşmayan
// 100–110 levhalar (Optimix, Expert Premium; sözlü) altta "alternatif" olarak.

export const metadata: Metadata = buildMetadata({
  title: `120 Yoğunluk Taş Yünü Fiyatları - ${formatMonthYear()} | 120'lik Mantolama Levhaları`,
  description:
    '120 yoğunluk taşyünü mantolama levhaları: Bonus Premium F 120 (föy 120 kg/m³ ±%10), Expert LD125 (föy ≥125 kg/m³) ve Dalmaçyalı SW035 (sözlü 110–120 kg/m³) yan yana; alternatif olarak 100–110 kg/m³ levhalar. Şehir ve kalınlığa göre 1 kamyon m² fiyatı, en az sipariş tutarı ve föy değerleri.',
  path: '/tasyunu-yogunluk/120-kg-m3',
  type: 'website',
});

export default async function Yogunluk120Page() {
  const snapshots = await getHubSnapshots();
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
              Yoğunluk Görünümü · 120 kg/m³
            </p>
            <h1 className="font-heading text-2xl font-bold text-hub-ink sm:text-4xl">
              120 yoğunluk taş yünü fiyatları
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-hub-ink-2 sm:text-[15px] sm:leading-7">
              120 yoğunluk sınıfındaki mantolama levhaları yan yana: föy beyanıyla Bonus Premium F 120
              (120 kg/m³ ±%10) ve Expert LD125 (≥125 kg/m³); Dalmaçyalı SW035 üretici sözlü beyanıyla
              110–120 kg/m³. 120&apos;ye ulaşmayan 100–110 kg/m³ levhalar tablonun altında alternatif
              olarak yer alır. Yoğunluk tek başına daha iyi ısı yalıtımı anlamına gelmez: aynı kalınlıkta
              ısı yalıtımını ısı iletkenliği gösterir (düşük olan iyi). 150 yoğunluk için{' '}
              <Link href={DENSITY_150_PATH} className="font-semibold text-hub-gold underline underline-offset-2 hover:no-underline">
                150 yoğunluk taş yünü fiyatları
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
          <ComparisonCenter variant="yogunluk_120" snapshot={snapshots.get(5)} />
          <HubLinkBand
            className="mt-8"
            groups={[
              { title: 'Kalınlığa göre taş yünü fiyatları', links: HUB_THICKNESSES.map((t) => ({ label: `${t} cm`, href: thicknessHubPath(t) })) },
            ]}
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

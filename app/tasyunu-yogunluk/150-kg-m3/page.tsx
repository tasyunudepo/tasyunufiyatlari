import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import ComparisonCenter from '@/components/compare/ComparisonCenter';
import MinimumOrderBanner from '@/components/sales/MinimumOrderBanner';
import HubLinkBand from '@/components/compare/HubLinkBand';
import { density150HubPath } from '@/lib/compare/hubs';
import { getDensity150HubThicknesses, getHubSnapshots } from '@/lib/compare/hubPages.server';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { formatMonthYear } from '@/lib/seo/monthYear';

// 150 kg/m³ görünümü: yalnız föy beyanlı üç 150'lik (Emrah, 14 Ekim 2026; önceki karar 3'te öteki
// beş ürün de bağlam olarak alttaydı).

export const metadata: Metadata = buildMetadata({
  // Başlık aramayla aynı başlar ("150 yoğunluk taşyünü fiyatları"; Emrah, 14 Ekim 2026).
  title: `150 Yoğunluk Taş Yünü Fiyatları - ${formatMonthYear()} | Föy Beyanlı 3 Levha`,
  description:
    '150 yoğunluk (150 kg/m³) taşyünü mantolama levhaları: Bonus Premium F 150, F 150 Pro ve Expert HD150 yan yana. Şehir ve kalınlığa göre 1 kamyon m² fiyatı, en az sipariş tutarı ve föy değerleri.',
  path: '/tasyunu-yogunluk/150-kg-m3',
  type: 'website',
});

export default async function Yogunluk150Page() {
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
              Yoğunluk Görünümü · 150 kg/m³
            </p>
            <h1 className="font-heading text-2xl font-bold text-hub-ink sm:text-4xl">
              150 yoğunluk taş yünü fiyatları
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-hub-ink-2 sm:text-[15px] sm:leading-7">
              Föy beyanıyla 150 kg/m³ sınıfındaki üç mantolama levhası yan yana: Bonus Premium
              F 150, F 150 Pro ve Expert HD150. 150 yoğunluk daha iyi ısı yalıtımı iddiası
              değildir: ısı yalıtımını ısı iletkenliği gösterir (düşük olan iyi); yoğunluk, dik
              çekme ve basma dayanımıyla birlikte okunur. &quot;Pro&quot; adı tek başına üstünlük
              anlamına gelmez. Öteki yoğunluklar için{' '}
              <Link href="/tasyunu-karsilastir" className="font-semibold text-hub-gold underline underline-offset-2 hover:no-underline">
                genel karşılaştırmaya
              </Link>{' '}
              bakabilirsiniz.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
          <ComparisonCenter variant="yogunluk_150" snapshot={snapshots.get(5)} />
          <HubLinkBand
            className="mt-8"
            groups={[
              { title: '150 yoğunluk, kalınlığa göre', links: density150.map((t) => ({ label: `${t} cm 150 yoğunluk taş yünü fiyatları`, href: density150HubPath(t) })) },
            ]}
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

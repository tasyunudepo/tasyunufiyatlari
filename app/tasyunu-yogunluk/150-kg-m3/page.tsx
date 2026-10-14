import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import ComparisonCenter from '@/components/compare/ComparisonCenter';
import MinimumOrderBanner from '@/components/sales/MinimumOrderBanner';
import { buildMetadata } from '@/lib/seo/buildMetadata';

// 150 kg/m³ görünümü (kilitli karar 3): ana karşılaştırma tablosunun
// 150 filtresi açık hâlidir — föy beyanlı üç 150 ürünü önce gelir,
// diğer beş ürün karşılaştırma bağlamında görünür kalır.

export const metadata: Metadata = buildMetadata({
  title: '150 kg/m³ Taşyünü Levhalar — Föy Beyanlı Karşılaştırma',
  description:
    '150 kg/m³ yoğunluk sınıfındaki taşyünü mantolama levhaları (Bonus F 150, F 150 Pro, Expert HD150) föy beyanlarıyla; aynı şehir ve kalınlıkta tam araç levha fiyat karşılaştırması.',
  path: '/tasyunu-yogunluk/150-kg-m3',
  type: 'website',
});

export default function Yogunluk150Page() {
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
              150 kg/m³ taşyünü levhalar
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-hub-ink-2 sm:text-[15px] sm:leading-7">
              Föy beyanıyla 150 kg/m³ sınıfında üç levha var: Bonus Premium F 150,
              F 150 Pro ve Expert HD150; tabloda önce gelirler. 150 yoğunluk daha iyi
              ısı yalıtımı iddiası değildir; dik çekme ve basma dayanımıyla birlikte
              okunur. &quot;Pro&quot; adı tek başına üstünlük anlamına gelmez. Tüm ürünler için{' '}
              <Link href="/tasyunu-karsilastir" className="font-semibold text-hub-gold underline underline-offset-2 hover:no-underline">
                genel karşılaştırmaya
              </Link>{' '}
              bakabilirsiniz.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
          <ComparisonCenter variant="yogunluk_150" />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

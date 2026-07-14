import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import ComparisonCenter from '@/components/compare/ComparisonCenter';
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
    <div className="flex min-h-screen flex-col bg-fe-bg">
      <SiteHeader tone="dark" />

      <main className="flex-1">
        <section className="border-b border-fe-border bg-fe-surface/40">
          <div className="mx-auto max-w-[1100px] px-4 py-10 sm:py-14">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-brand">
              Yoğunluk Görünümü · 150 kg/m³
            </p>
            <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl">
              150 kg/m³ taşyünü levhalar
            </h1>
            <p className="mt-3 max-w-2xl text-fe-muted">
              Föy beyanıyla 150 kg/m³ sınıfında üç ürün vardır: Bonus Premium
              F 150, Bonus Premium F 150 Pro ve Expert HD150 — tabloda önce
              gelirler. 150 yoğunluk daha iyi ısı yalıtımı iddiası değildir;
              föyde görülebilen mekanik değerlerin (dik çekme, basma dayanımı)
              bağlamıdır ve &quot;Pro&quot; adı otomatik üstünlük anlamına gelmez.
              Tüm ürünler için{' '}
              <Link href="/tasyunu-karsilastir" className="text-brand-300 underline-offset-2 hover:underline">
                genel karşılaştırmaya
              </Link>{' '}
              bakabilirsiniz.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-10">
          <ComparisonCenter variant="yogunluk_150" />
        </section>
      </main>

      <SiteFooter tone="dark" />
    </div>
  );
}

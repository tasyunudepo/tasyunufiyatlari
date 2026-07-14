import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import ComparisonCenter from '@/components/compare/ComparisonCenter';
import { buildMetadata } from '@/lib/seo/buildMetadata';

// Karşılaştırma Merkezi (Sprint 2) — sayfa SSG'dir; teknik tablo statik
// HTML'e girer, ticari fiyatlar tarayıcıda gerçek hesapla dolar
// (revalidate bilinçli yok — katalog force-static kuralı).

export const metadata: Metadata = buildMetadata({
  title: 'Taşyünü Levha Karşılaştırma — 8 Ürün, Aynı Koşulda',
  description:
    'Sıvalı dış cephe mantolamasına uygun 8 taşyünü levhayı karşılaştırın: föy beyanlı yoğunluk, ısı iletkenlik, mekanik dayanım ve aynı şehir/kalınlık koşulunda tam araç levha fiyatları.',
  path: '/tasyunu-karsilastir',
  type: 'website',
});

export default function TasyunuKarsilastirPage() {
  return (
    <div className="flex min-h-screen flex-col bg-fe-bg">
      <SiteHeader tone="dark" />

      <main className="flex-1">
        <section className="border-b border-fe-border bg-fe-surface/40">
          <div className="mx-auto max-w-[1100px] px-4 py-10 sm:py-14">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-brand">
              Karşılaştırma Merkezi
            </p>
            <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl">
              Taşyünü levhaları aynı koşulda karşılaştırın
            </h1>
            <p className="mt-3 max-w-2xl text-fe-muted">
              Yalnızca sıvalı dış cephe mantolamasına uygun levhalar listelenir.
              Teknik değerler üretici föy beyanlarıdır; fiyatlar seçtiğiniz şehir
              ve kalınlıkta, tam araç koşulunda gerçek hesapla üretilir — sabit
              iddia yoktur. Yoğunluk odaklı görünüm için{' '}
              <Link href="/tasyunu-yogunluk/150-kg-m3" className="text-brand-300 underline-offset-2 hover:underline">
                150 kg/m³ sayfasına
              </Link>{' '}
              bakabilirsiniz.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-10">
          <ComparisonCenter variant="genel" />
        </section>
      </main>

      <SiteFooter tone="dark" />
    </div>
  );
}

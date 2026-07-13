import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import Eyebrow from '@/components/shared/Eyebrow';
import RevealOnScroll from '@/components/shared/RevealOnScroll';
import { Handshake, Truck, Medal, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { buildBusinessGraph } from '@/lib/seo/buildBusinessNode';


export const metadata: Metadata = buildMetadata({
  title: 'Hakkımızda',
  description:
    'Taşyünü ve EPS siparişlerinde ürün, metraj, fiyat ve fabrika çıkışlı sevkiyat koşullarını birlikte değerlendiren ÖzerGrup Yalıtım ve İzolasyon A.Ş.',
  path: '/hakkimizda',
  type: 'website',
});


const REASONS = [
  {
    Icon: Handshake,
    eyebrow: 'Ürün Karşılaştırması',
    title: 'Marka, kalınlık ve metraj aynı hesapta',
    body: 'Taşyünü ve EPS ürünlerini şehir, kalınlık, paket ve sipariş metrajıyla birlikte değerlendiriyoruz.',
  },
  {
    Icon: Truck,
    eyebrow: 'Fabrika Çıkışlı Lojistik',
    title: 'Üretim ve tam araç koşuluna göre sevkiyat',
    body: 'Taşyününde tam kamyon veya tam TIR, EPS setinde ise levha ve toz grubu koşulu birlikte değerlendirilir. Sevkiyat tarihi sipariş görüşmesinde fabrika uygunluğuna göre netleşir.',
  },
  {
    Icon: Medal,
    eyebrow: 'Açık Ticari Koşullar',
    title: 'Fiyatın hangi sipariş koşulunda geçerli olduğunu gösteriyoruz',
    body: 'KDV, nakliye, minimum metraj ve tam araç koşullarını teklif ekranında ayrı ayrı belirtiyoruz.',
  },
];

export default function HakkimizdaPage() {
  return (
    <div className="min-h-screen bg-hub-cream flex flex-col">
      <SiteHeader tone="warm" />

      <main className="flex-1">
        {/* HERO — editorial split */}
        <section className="border-b border-hub-rule">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <RevealOnScroll className="grid md:grid-cols-12 gap-10 md:gap-14 items-center">
              <div className="md:col-span-6">
                <Eyebrow tone="warm" className="mb-5">Kurumsal</Eyebrow>
                <h1 className="font-heading font-extrabold text-hub-ink tracking-tight leading-[1.05] text-[clamp(2.25rem,4.6vw,4rem)] mb-6">
                  ÖzerGrup Yalıtım ve İzolasyon A.Ş.
                </h1>
                <p className="text-hub-ink-2 text-lg leading-relaxed max-w-xl">
                  Taşyünü ve EPS siparişlerinde ürün seçimi, metraj, fiyat ve fabrika çıkışlı sevkiyat koşullarını
                  <span className="text-hub-gold font-semibold"> tek teklif akışında</span> anlaşılır hâle getiriyoruz.
                </p>
              </div>

              <div className="md:col-span-6 relative aspect-[5/4] rounded-2xl overflow-hidden ring-1 ring-hub-rule">
                <Image
                  src="/hakkimizda/Ozeryapi-Hakkimizda-depo.webp"
                  alt="Özer Yapı çalışma ve görüşme noktası"
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                  priority
                />
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* OPERATION PROOF — bayilik / lojistik / tecrübe (3 madde, asimetrik kompozisyon) */}
        <section className="bg-hub-warm border-b border-hub-rule">
          <RevealOnScroll className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <div className="max-w-2xl mb-14">
              <Eyebrow tone="warm" className="mb-5">Neden Bizimle</Eyebrow>
              <h2 className="font-heading font-bold text-hub-ink tracking-tight leading-[1.1] text-3xl sm:text-4xl md:text-5xl">
                Üç sertleşmiş operasyon kası.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-10">
              {REASONS.map((r) => (
                <div key={r.eyebrow} className="relative">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-hub-cream ring-1 ring-hub-gold/30 text-hub-gold mb-5">
                    <r.Icon weight={ICON_WEIGHT} size={24} />
                  </div>
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-hub-gold mb-2">
                    {r.eyebrow}
                  </div>
                  <h3 className="font-heading font-bold text-hub-ink text-xl sm:text-2xl leading-snug mb-3 tracking-tight">
                    {r.title}
                  </h3>
                  <p className="text-hub-ink-2 text-base leading-relaxed">
                    {r.body}
                  </p>
                </div>
              ))}
            </div>
          </RevealOnScroll>
        </section>

        {/* CTA BAND */}
        <section className="bg-hub-cream">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <RevealOnScroll className="grid md:grid-cols-12 gap-8 md:gap-12 items-center">
              <div className="md:col-span-7">
                <Eyebrow tone="warm" className="mb-4">Projeniz İçin</Eyebrow>
                <h2 className="font-heading font-bold text-hub-ink tracking-tight leading-[1.1] text-3xl sm:text-4xl md:text-5xl mb-4">
                  Bayilik fiyatını ve nakliye koşulunu tek hesapta görün.
                </h2>
                <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed max-w-2xl">
                  Şehir, kalınlık ve metrajı girin; tam araç veya uygun EPS setinde nakliyenin fiyata dahil olup olmadığını görün.
                </p>
              </div>
              <div className="md:col-span-5 flex flex-wrap items-center gap-4 md:justify-end">
                <Link href="/" className="btn-primary">
                  Maliyet Hesapla
                  <ArrowRight weight={ICON_WEIGHT} size={18} className="btn-arrow" />
                </Link>
                <Link href="/iletisim" className="btn-secondary">
                  İletişim
                  <ArrowRight weight={ICON_WEIGHT} size={16} className="btn-arrow" />
                </Link>
              </div>
            </RevealOnScroll>
          </div>
        </section>
      </main>

      <SiteFooter tone="warm" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBusinessGraph([], { includeWarehouse: false })) }}
      />
    </div>
  );
}

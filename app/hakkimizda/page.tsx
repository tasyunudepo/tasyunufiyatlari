import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import Eyebrow from '@/components/shared/Eyebrow';
import RevealOnScroll from '@/components/shared/RevealOnScroll';
import Timeline, { type Milestone } from '@/components/about/Timeline';
import { Handshake, Truck, Medal, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { buildBusinessGraph } from '@/lib/seo/buildBusinessNode';


export const metadata: Metadata = buildMetadata({
  title: 'Hakkımızda',
  description:
    "2006'dan beri yalıtım sektöründe. 20 yıllık tecrübe, 81 il sevkiyat, Filli Boya / Fawori / Dalmaçyalı resmi bayilik. ÖzerGrup Yalıtım ve İzolasyon A.Ş.",
  path: '/hakkimizda',
  type: 'website',
});


const MILESTONES: Milestone[] = [
  {
    year: '2006',
    title: 'Sektöre giriş — yalıtım, boya, alçıpan, taahhüt.',
    body: 'Muhammet Öztürk tarafından temelleri atılan firmamız; yalıtım, boya, alçıpan ve taahhüt işleriyle inşaat sektörüne kaliteli, ilkeli ve uzman bir kadroyla giriş yaptı.',
  },
  {
    year: '2010',
    title: 'Özer Yapı İnşaat Taahhüt — ilk şube açıldı.',
    body: 'Uygulamanın yanına inşaat malzemeleri satışı eklendi. Güzelyalı Mahallesi İstiklal Cad. No:49/A adresindeki ilk şubemizle perakende operasyonu başladı.',
  },
  {
    year: '2015',
    title: 'Ltd. Şti. — 3 şube, 2 depo, sektörel güç.',
    body: 'Özer Yapı İnşaat San. ve Tic. Ltd. Şti. kuruldu. 3 şube ve 2 depoyla faaliyetler genişledi; bölgenin en güçlü yapı marketlerinden biri konumuna ulaşıldı.',
  },
  {
    year: 'Bugün',
    title: 'ÖzerGrup A.Ş. — 81 il sevkiyat, fabrika çıkışlı satış.',
    body: '20 yıllık tecrübeyle Türkiye genelinde fabrika çıkışlı taşyünü ve EPS satışı, 36+ marka resmi bayiliği ve dijital fiyat hesaplayıcı altyapısıyla yalıtım sektörünün dijital tarafını da yönetiyoruz.',
  },
];

const REASONS = [
  {
    Icon: Handshake,
    eyebrow: 'Resmi Bayilik',
    title: 'Filli Boya, Fawori, Dalmaçyalı bayilik avantajı',
    body: '36+ markanın resmi bayiliğiyle çalışıyoruz. Yüksek metrajlı projelerde bayilik fiyatı + projeye özel pazarlık yapma esnekliğimiz var.',
  },
  {
    Icon: Truck,
    eyebrow: '81 İl Lojistik',
    title: 'Fabrika çıkışlı sevkiyat, Türkiye geneli',
    body: 'Tuzla & Gebze depolarımızdan parsiyel veya tam araç (kamyon/TIR) sevkiyat. Bölgesel iskonto ve nakliye doluluk oranı tek hesapta otomatik birleşir.',
  },
  {
    Icon: Medal,
    eyebrow: '20 Yıl Tecrübe',
    title: '2006\'dan beri yalıtım sektöründe',
    body: 'Yalıtım, boya, alçıpan ve taahhüt — sahada 20 yıl. Yüksek metrajlı operasyonların inceliklerini biliyoruz; ürün+lojistik+uygulama bütünlüğünü tek elden çözüyoruz.',
  },
];

export default function HakkimizdaPage() {
  return (
    <div className="min-h-screen bg-hub-cream flex flex-col">
      <SiteHeader tone="warm" />

      <main className="flex-1">
        {/* HERO — editorial split: sol manifesto, sağ depo foto */}
        <section className="border-b border-hub-rule">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <RevealOnScroll className="grid md:grid-cols-12 gap-10 md:gap-14 items-center">
              <div className="md:col-span-6">
                <Eyebrow tone="warm" className="mb-5">Kurumsal · 2006'dan Beri</Eyebrow>
                <h1 className="font-heading font-extrabold text-hub-ink tracking-tight leading-[1.05] text-[clamp(2.25rem,4.6vw,4rem)] mb-6">
                  ÖzerGrup Yalıtım ve İzolasyon A.Ş.
                </h1>
                <p className="text-hub-ink-2 text-lg leading-relaxed max-w-xl">
                  20 yıldır yalıtım sektöründe. Bugün <span className="text-hub-gold font-semibold">36+ marka resmi bayiliği</span>,
                  Tuzla & Gebze depo ağı ve <span className="text-hub-gold font-semibold">81 il sevkiyat</span> kapasitesiyle
                  taşyünü ve EPS pazarının dijital tarafını yürütüyoruz.
                </p>
              </div>

              <div className="md:col-span-6 relative aspect-[5/4] rounded-2xl overflow-hidden ring-1 ring-hub-rule">
                <Image
                  src="/hakkimizda/Ozeryapi-Hakkimizda-depo.webp"
                  alt="Özer Yapı — Tuzla depo ve mağaza"
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                  priority
                />
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* TIMELINE — sticky stepper */}
        <section className="border-b border-hub-rule">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <div className="max-w-2xl mb-14">
              <Eyebrow tone="warm" className="mb-5">Kuruluştan Bugüne</Eyebrow>
              <h2 className="font-heading font-bold text-hub-ink tracking-tight leading-[1.1] text-3xl sm:text-4xl md:text-5xl mb-4">
                Sahada 20 yıl, dört önemli kavşak.
              </h2>
              <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed">
                Küçük bir uygulama ekibinden A.Ş. ölçeğine: her milestone, sahanın çıkardığı yeni bir ihtiyaca verdiğimiz yapısal cevap oldu.
              </p>
            </div>

            <Timeline milestones={MILESTONES} tone="warm" />
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
                  Bayilik fiyatını ve nakliyeyi tek hesapta görün.
                </h2>
                <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed max-w-2xl">
                  Şehir, kalınlık ve metraj girin — projenize özel paket ve nakliye dahil fiyat saniyeler içinde.
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBusinessGraph([], { includeWarehouse: true })) }}
      />
    </div>
  );
}

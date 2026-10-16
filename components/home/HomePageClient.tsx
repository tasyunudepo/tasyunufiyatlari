"use client";

import type { ReactNode } from "react";

import DealerBrandStrip from "@/components/home/DealerBrandStrip";
import OperationVideo from "@/components/home/OperationVideo";
import SalesChannels from "@/components/portfolio/SalesChannels";
import SiteFooter from "@/components/shared/SiteFooter";
import SiteHeader from "@/components/shared/SiteHeader";
import VideoGomme from "@/components/video/VideoGomme";
import WizardCalculator from "@/components/wizard/WizardCalculator";
import MinimumOrderBanner from "@/components/sales/MinimumOrderBanner";
import { BUSINESS_INFO } from "@/lib/business/info";
import { buildBusinessGraph } from "@/lib/seo/buildBusinessNode";
import { buildHowToNode } from "@/lib/seo/buildHowTo";
import { buildCalculationServiceNode, buildShippingServiceNode } from "@/lib/seo/buildService";
import { ORDER_PROCESS_VIDEO } from "@/lib/video/placements";

const faqItems = [
  {
    q: "Fiyatlara KDV dahil mi?",
    a: "Hesap sonucunda KDV hariç ara toplam, yüzde 20 KDV ve KDV dahil toplam ayrı ayrı gösterilir.",
  },
  {
    q: "Nakliye fiyata dahil mi?",
    a: "Taşyününde tam kamyon, tam TIR veya bunların tam araç kombinasyonlarında nakliye fiyata dahildir. Uygun EPS setinde levha ve toz grubu birlikte hesaplandığında nakliye fiyata dahil gösterilir.",
  },
  {
    q: "Hesaptan sonra sipariş nasıl ilerler?",
    a: "Hesaplanan ürün ve sevkiyat özetinden WhatsApp sipariş akışını başlatabilirsiniz. Satış ekibi üretim uygunluğunu ve sevkiyat planını görüşmede netleştirir; ödeme sipariş onayında tek seferde alınır.",
  },
];

const howSteps = [
  {
    name: "Teslim ili ve ürünü seçin",
    text: "Teslim ili ile Taşyünü veya EPS ürününü seçin.",
  },
  {
    name: "Kalınlık ve miktarı girin",
    text: "Projenizdeki kalınlık ve metraj bilgilerini girerek fiyatı hesaplayın.",
  },
  {
    name: "Sonucu inceleyip siparişi başlatın",
    text: "Ürün, sevkiyat, KDV ve toplamı inceleyip WhatsApp sipariş akışına geçin.",
  },
];

const jsonLdGraph = buildBusinessGraph([
  {
    "@type": "WebApplication",
    "@id": `${BUSINESS_INFO.url}/#webapp-hesaplayici`,
    name: "Taşyünü ve EPS Teslim Fiyatı Hesaplayıcı",
    url: BUSINESS_INFO.url,
    applicationCategory: "BusinessApplication",
    description: "Teslim ili, ürün, kalınlık ve miktara göre Taşyünü veya EPS teslim fiyatını hesaplayın.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "TRY",
    },
  },
  {
    "@type": "FAQPage",
    "@id": `${BUSINESS_INFO.url}/#faq`,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".faq-question", ".faq-answer"],
    },
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  },
  buildHowToNode({
    name: "Taşyünü ve EPS Teslim Fiyatı Nasıl Hesaplanır?",
    description: "Teslim ili, ürün, kalınlık ve miktarı seçerek fiyatı görün; sonucu inceleyip WhatsApp sipariş akışını başlatın.",
    totalTime: "PT2M",
    estimatedCost: { currency: "TRY", value: "0" },
    steps: howSteps,
  }),
  buildCalculationServiceNode(),
  buildShippingServiceNode(),
]);

// 14 Ekim 2026: ana sayfanın gövdesi (önceki app/page.tsx, değişmeden). Sunucudaki app/page.tsx fiyat tablosunu
// derleme anında hesaplayıp `priceTable` olarak verir; sayfanın geri kalanı eskisi gibi istemcide çalışır.
export default function HomePageClient({ priceTable }: { priceTable?: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3f0e8] text-[#171711]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />

      <SiteHeader tone="dark" minimal />
      {/* En az sipariş şeridi: sayfa kaydıkça başlığın altında kalır (Emrah kararı, 14 Ekim 2026). */}
      <MinimumOrderBanner />

      <main>
        <section className="overflow-hidden border-b border-[#d6d0c2]">
          <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-7 sm:px-6 sm:pb-12 sm:pt-10 lg:pb-14 lg:pt-11">
            <div className="grid items-center gap-7 lg:grid-cols-[0.84fr_1.16fr] lg:gap-12">
              <div className="max-w-[580px]">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#70591f] sm:mb-5">
                  Proje ölçeğinde teslim fiyatı
                </p>
                <h1 className="font-heading text-[42px] font-extrabold leading-[0.98] tracking-[-0.035em] text-[#151510] sm:text-[54px] lg:text-[62px]">
                  Taşyünü ve EPS teslim fiyatını hesaplayın.
                </h1>
                <p className="mt-5 max-w-[540px] text-base leading-7 text-[#59564d] sm:text-lg sm:leading-8">
                  Teslim ili, ürün, kalınlık ve miktarı seçin; fiyatınızı anında görün.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-[#d2ccbe] pt-4 text-sm text-[#514d43]">
                  <span className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-[#9a7528]" aria-hidden />
                    <span><strong className="font-semibold text-[#25241f]">Satış ve sevkiyat:</strong> ÖzerGrup</span>
                  </span>
                  <DealerBrandStrip />
                </div>
              </div>

              <OperationVideo />
            </div>

            <div className="mt-7 lg:mt-8">
              <WizardCalculator variant="homepage" />
            </div>
          </div>
        </section>

        {priceTable}

        {/* S2 güven filmi, kapanış A (16 Ekim 2026): tıkla-oynat; SSS'deki sipariş sorusunun görüntülü karşılığı. */}
        <section className="border-t border-[#d6d0c2]" aria-labelledby="siparis-sureci-title">
          <div className="mx-auto grid max-w-[1240px] items-center gap-7 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[0.84fr_1.16fr] lg:gap-12">
            <div className="max-w-[520px]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#70591f]">Sipariş süreci</p>
              <h2 id="siparis-sureci-title" className="mt-3 font-heading text-3xl font-bold tracking-tight text-[#171711] sm:text-4xl">
                Sipariş nasıl ilerler?
              </h2>
              <p className="mt-4 text-base leading-7 text-[#59564d]">
                Satış ekibi üretim uygunluğunu ve sevkiyat planını görüşmede netleştirir; ödeme sipariş onayında tek seferde alınır.
              </p>
              <a
                href="#mantolama-hesaplayici"
                data-vg-cta={ORDER_PROCESS_VIDEO.id}
                data-vg-cta-id="hesaplayici"
                className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-[#70591f] underline decoration-[#c9a663] underline-offset-4 transition-colors hover:text-[#171711]"
              >
                Teslim fiyatını hesaplayın
              </a>
            </div>
            <div className="mx-auto w-full max-w-[360px] min-[769px]:max-w-none">
              <VideoGomme
                id={ORDER_PROCESS_VIDEO.id}
                mod="click"
                sayfa="anasayfa"
                etiket={ORDER_PROCESS_VIDEO.etiket}
                masaustu={ORDER_PROCESS_VIDEO.masaustu}
                mobil={ORDER_PROCESS_VIDEO.mobil}
                className="rounded-[1.35rem] border border-black/10 bg-[#0f1b33] shadow-[0_24px_70px_rgba(24,22,17,0.14)]"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[900px] px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="faq-title">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#70591f]">Kısa yanıtlar</p>
          <h2 id="faq-title" className="mt-3 font-heading text-3xl font-bold tracking-tight text-[#171711] sm:text-4xl">
            Siparişten önce bilmeniz gerekenler
          </h2>
          <div className="mt-8 divide-y divide-[#d6d0c2] border-y border-[#d6d0c2]">
            {faqItems.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="faq-question flex cursor-pointer list-none items-center justify-between gap-6 text-base font-semibold text-[#24231e] sm:text-lg">
                  {item.q}
                  <span className="text-2xl font-light text-[#70591f] transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="faq-answer max-w-[760px] pt-3 text-sm leading-7 text-[#625e54] sm:text-base">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-[#d6d0c2]" aria-label="ÖzerGrup satış kanalları">
          <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
            <SalesChannels placement="anasayfa" variant="line" />
          </div>
        </section>
      </main>

      <SiteFooter tone="dark" />
    </div>
  );
}

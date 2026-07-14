"use client";

import Link from "next/link";
import SiteHeader from "@/components/shared/SiteHeader";
import SiteFooter from "@/components/shared/SiteFooter";
import Eyebrow from "@/components/shared/Eyebrow";
import SectionHeader from "@/components/shared/SectionHeader";
import NumberMarker from "@/components/shared/NumberMarker";
import RevealOnScroll from "@/components/shared/RevealOnScroll";
import WhatsappLink from "@/components/shared/WhatsappLink";
import BrandTrustLogos from "@/components/shared/BrandTrustLogos";
import HeroSystemVisual from "@/components/cro/HeroSystemVisual";
import WizardCalculator from "@/components/wizard/WizardCalculator";
import { TrustStrip } from '@/components/cro/TrustStrip';
import { SituationSelector } from '@/components/cro/SituationSelector';
import { RiskMistakesBlock } from '@/components/cro/RiskMistakesBlock';
import { ProofBlock } from '@/components/cro/ProofBlock';
import { BrandStrip } from '@/components/cro/BrandStrip';
import BonusChallengeBanner from '@/components/cro/BonusChallengeBanner';
import { Truck, Package, Check, ArrowRight, Star } from "@phosphor-icons/react";
import { ICON_WEIGHT } from "@/lib/design/tokens";
import { BUSINESS_INFO, WHATSAPP_URL } from "@/lib/business/info";
import { buildBusinessGraph } from "@/lib/seo/buildBusinessNode";
import { buildHowToNode } from "@/lib/seo/buildHowTo";
import { buildCalculationServiceNode, buildShippingServiceNode } from "@/lib/seo/buildService";

const faqItems = [
    {
        q: "Hangi kalınlığı ve hangi malzemeyi seçmeliyim?",
        a: "Bina tipi (apartman/villa/iş yeri), iklim bölgesi ve enerji kimlik belgesi hedefine göre değişir. Soğuk illerde (Erzurum, Kars, Sivas) 8–10 cm taşyünü; ılıman bölgelerde 5–6 cm EPS yeterli olabilir. Hesaplayıcı, seçimlerinize göre hangi sistemi önerdiğini her adımda gösterir.",
    },
    {
        q: "Hesabı yanlış yaparsam ne kaybederim?",
        a: "Eksik kalınlık ısı performansını, eksik metraj ise malzeme planını etkiler. Hesaplayıcı standart sarfiyatı ve paket yuvarlamasını birlikte gösterir; son uygulama miktarı saha ölçüsüyle teyit edilmelidir.",
    },
    {
        q: "Nakliye ücreti hesaba dahil mi, bölgeye göre değişir mi?",
        a: "Taşyününde tam kamyon, tam TIR veya bunların tam araç kombinasyonlarında nakliye fiyata dahildir. Uygun EPS setinde levha ve toz grubu birlikte hesaplandığında nakliye fiyata dahil gösterilir. Bu koşullara ulaşmayan sipariş için sistem teklif oluşturmaz.",
    },
    {
        q: "PDF teklif ne zaman ve nasıl elime ulaşır?",
        a: "Hesabı tamamlayıp iletişim bilgilerinizi onayladığınızda PDF ekranda oluşur. Buradan indirebilir; WhatsApp veya e-posta seçeneğiyle kendiniz paylaşabilirsiniz. Teklifte kalem listesi ve referans kodu yer alır.",
    },
    {
        q: "Sipariş nasıl ilerler, ödeme koşulları nasıl netleşir?",
        a: "PDF teklifteki referans numarasını WhatsApp üzerinden bize iletin. Satış ekibi fabrika üretim uygunluğunu, sevkiyat tarihini ve araç planını görüşmede netleştirir. Ödeme sipariş onayında tek seferde alınır.",
    },
    {
        q: "Kararsızım, hangi paketi seçeceğimi bilmiyorum.",
        a: "Hesaplayıcı 3 paket seçeneği (Ekonomik, Dengeli, Orijinal) sunar; aralarındaki fark malzeme markası ve yardımcı kalemlerin sınıfıdır. Emin değilseniz \"Bize ulaşın\" üzerinden sahanızı paylaşın, doğru paket için teknik öneri yapalım.",
    },
];

const HOW_STEPS = [
    {
        n: 1,
        title: "Metraj, kalınlık ve şehir girin",
        desc: "Şehir, metraj, kalınlık — 4 adımda formu tamamlayın.",
    },
    {
        n: 2,
        title: "8 kalem ve nakliye koşulu hesaplansın",
        desc: "Ürün kalemleri, tam araç eşiği ve uygun EPS seti birlikte değerlendirilir.",
    },
    {
        n: 3,
        title: "PDF teklifinizi indirin, paylaşın",
        desc: "PDF ekranda oluşur; indirme, WhatsApp veya e-posta paylaşımını siz seçersiniz.",
    },
];

// Home page schema — tek @graph altında 7 entity:
//   Organization+LocalBusiness, Person (founder), WebApplication,
//   FAQPage (speakable), HowTo, Service (Hesaplama), Service (Sevkiyat).
// Tüm pointer'lar @id zinciri ile bağlı — Knowledge Graph entity füzyonu.
const jsonLdGraph = buildBusinessGraph([
    {
        "@type": "WebApplication",
        "@id": `${BUSINESS_INFO.url}/#webapp-hesaplayici`,
        name: "Mantolama Maliyet Hesaplayıcı",
        url: BUSINESS_INFO.url,
        applicationCategory: "BusinessApplication",
        description: "8 kalem mantolama setini metraj, kalınlık ve bölgeye göre hesaplayın. Tam araç ve uygun EPS seti nakliye koşullarını görerek 3 paket seçeneğini karşılaştırın.",
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "TRY",
        },
    },
    {
        "@type": "FAQPage",
        "@id": `${BUSINESS_INFO.url}/#faq`,
        // Voice search / Google Assistant için Speakable işaretleme.
        // cssSelector hedefleri HTML'deki <details>/.faq-question/.faq-answer class'ları.
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
        name: "Mantolama Hesaplaması ve PDF Teklif Nasıl Alınır?",
        description:
            "3 adımda paket, fiyat ve nakliye koşulunu gösteren PDF teklif. " +
            "Şehir, metraj ve kalınlık girin; 8 kalem set otomatik hesaplansın; " +
            "PDF teklifinizi ekranda oluşturup indirin.",
        totalTime: "PT2M",
        estimatedCost: { currency: "TRY", value: "0" },
        steps: HOW_STEPS.map((s) => ({ name: s.title, text: s.desc })),
    }),
    buildCalculationServiceNode(),
    buildShippingServiceNode(),
]);

const HIGHLIGHTS = [
    {
        eyebrow: "8 Kalem · Tek Hesap",
        title: "Tek levha değil, komple mantolama sistemi.",
        desc: "Levha, yapıştırıcı, sıva, donatı filesi, dübel, astar, kaplama ve köşe profili — sekizinin de doğru sarfiyatla, tek tabloda toplam maliyetini görürsünüz.",
    },
    {
        eyebrow: "Şehir · Doluluk · İskonto",
        title: "Nakliye koşulu baştan görünür.",
        desc: "Taşyününde tam araç eşiği, EPS setinde levha ve toz grubu koşulu aynı hesapta değerlendirilir. Nakliyenin fiyata dahil olduğu durum sonuçta açıkça gösterilir.",
    },
    {
        eyebrow: "Referanslı PDF Teklif",
        title: "Teklifinizi indirin, kaydedin, paylaşın.",
        desc: "Hesabı bitirdiğinizde referanslı fiyat teklifi PDF olarak oluşur. Belgeyi indirir; WhatsApp veya e-posta uygulamanızı hazır metinle açarsınız.",
    },
];

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col bg-fe-bg">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
            />

            <SiteHeader tone="dark" />

            {/* HERO — full-bleed editorial */}
            <section className="relative overflow-hidden bg-fe-bg">
                {/* Subtle altın glow accent */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{
                        background:
                            'radial-gradient(900px 400px at 70% -10%, rgba(198,158,84,0.10), transparent 60%), radial-gradient(700px 300px at 10% 110%, rgba(212,132,90,0.06), transparent 60%)',
                    }}
                />
                <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 pt-2.5 sm:pt-10 pb-6 sm:pb-8">
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] xl:grid-cols-[minmax(0,1.16fr)_minmax(420px,0.84fr)] lg:items-end">
                        <div>
                            <Eyebrow className="mb-2.5 sm:mb-4">Fabrika Çıkışlı Mantolama</Eyebrow>
                            <h1 className="max-w-[980px] font-heading font-extrabold text-[40px] sm:text-[52px] lg:text-[64px] leading-[1.05] tracking-tight text-fe-text">
                                Taşyününde <span className="text-brand">tam araç</span>, uygun EPS setinde nakliye fiyata dahil.
                            </h1>
                            <p className="mt-3 sm:mt-5 max-w-[650px] text-base sm:text-lg text-fe-text/85 leading-relaxed">
                                Şehir, metraj ve kalınlığı seçin; üç paket seçeneğini karşılaştırıp PDF teklifinizi ekranda oluşturun.
                            </p>
                            <div className="mt-5 sm:mt-7 lg:hidden">
                                <HeroSystemVisual />
                            </div>
                            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                                <Link
                                    href="#mantolama-hesaplayici"
                                    className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-fe-bg shadow-lg shadow-brand/20 transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-fe-bg"
                                >
                                    PDF Teklif Oluştur
                                    <ArrowRight size={18} weight={ICON_WEIGHT} />
                                </Link>
                                <Link
                                    href="/urunler"
                                    className="inline-flex items-center gap-2 text-base font-medium text-fe-muted transition hover:text-fe-text"
                                >
                                    Önce ürünleri inceleyeyim
                                    <ArrowRight size={16} weight={ICON_WEIGHT} />
                                </Link>
                            </div>
                        </div>

                        <div className="space-y-5 lg:pb-4">
                            <div className="hidden lg:block">
                                <HeroSystemVisual />
                            </div>
                            <BrandTrustLogos
                                title="Çalıştığımız Markalar"
                                variant="heroRail"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <TrustStrip />
            <BonusChallengeBanner />
            <SituationSelector />

            {/* WIZARD CALCULATOR — id form kartına atandı (WizardCalculator içinde) */}
            <section className="bg-fe-surface border-t border-fe-border">
                <WizardCalculator />
            </section>

            {/* HIGHLIGHTS — paralel mesajlar, alternating editorial split, NUMARASIZ */}
            <section className="bg-fe-bg section-pad-md border-t border-fe-border">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-24 sm:space-y-32">
                    {HIGHLIGHTS.map((h, idx) => {
                        const isReverse = idx % 2 === 1;
                        return (
                            <RevealOnScroll
                                key={h.title}
                                className="grid md:grid-cols-12 gap-8 md:gap-14 items-start"
                            >
                                {/* Eyebrow kolonu */}
                                <div className={`md:col-span-4 ${isReverse ? 'md:order-2 md:text-right' : ''}`}>
                                    <Eyebrow className={isReverse ? 'md:flex-row-reverse' : ''}>
                                        {h.eyebrow}
                                    </Eyebrow>
                                </div>
                                {/* İçerik kolonu */}
                                <div className={`md:col-span-8 ${isReverse ? 'md:order-1' : ''}`}>
                                    <h2 className="font-heading font-bold text-white text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[1.05] mb-6">
                                        {h.title}
                                    </h2>
                                    <p className="text-fe-text/85 text-lg leading-relaxed max-w-xl">
                                        {h.desc}
                                    </p>
                                </div>
                            </RevealOnScroll>
                        );
                    })}
                </div>
            </section>

            <RiskMistakesBlock />

            {/* Süreç akışı */}
            <section className="bg-fe-surface section-pad-md border-t border-fe-border">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
                    <SectionHeader
                        eyebrow="Karar → Sevkiyat"
                        title="3 adımda doğru karar, doğru sevkiyat"
                        lead="Hesaplayıcı sadece fiyatı değil, hangi sistemin sizin için doğru olduğunu da gösterir; sevkiyatı tarih ve araç tipiyle planlarız."
                        tone="dark"
                        className="mb-16"
                    />
                    <div className="grid md:grid-cols-3 gap-8 md:gap-10 relative">
                        {/* Yatay bağlantı çizgisi (desktop only) */}
                        <div
                            aria-hidden
                            className="hidden md:block absolute top-[2.4rem] left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-hub-gold-soft/40 to-transparent"
                        />
                        {HOW_STEPS.map((step) => (
                            <div key={step.n} className="relative">
                                <NumberMarker n={step.n} variant="display" className="mb-5" />
                                <h3 className="font-heading font-bold text-white text-xl sm:text-2xl mb-3 leading-snug">
                                    {step.title}
                                </h3>
                                <p className="text-fe-text/80 text-base leading-relaxed">
                                    {step.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* PACKAGE TIERS — orta kart "popüler" hiyerarşi (boy/scale farkı) */}
            <section className="bg-fe-bg section-pad-md border-t border-fe-border">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
                    <SectionHeader
                        eyebrow="3 Paket"
                        title="Aynı metraj için üç farklı sistem"
                        lead="Her projenin bütçesi ve marka tercihi farklıdır. Hesaplayıcı aynı anda üç seçeneği karşılaştırır."
                        tone="dark"
                        className="mb-14"
                    />
                    <div className="grid sm:grid-cols-3 gap-6 items-stretch">
                        {[
                            {
                                name: "Ekonomik",
                                tagline: "En düşük maliyet",
                                desc: "Toplam maliyeti minimize etmek isteyen projeler için bütçe dostu kombinasyon.",
                                points: ["Bütçe dostu kombinasyon", "Ürün teknik dokümanları", "En düşük toplam maliyet"],
                                featured: false,
                                forWho: "Toplam maliyeti aşağı çekmek isteyenler için.",
                                notForWho: "Tek marka sistem bütünlüğü arıyorsanız size göre değil.",
                            },
                            {
                                name: "Dengeli",
                                tagline: "Popüler tercih",
                                desc: "Fiyat / performans dengesini gözeten projeler için optimize edilmiş paket.",
                                points: ["Levha + aksesuar dengesi", "Ürün teknik dokümanları", "Fiyat/performans dengesi"],
                                featured: true,
                                forWho: "Fiyat ve güven dengesi arayanlar için.",
                                notForWho: "Ultra premium beklenti varsa Orijinal'i tercih edin.",
                            },
                            {
                                name: "Orijinal",
                                tagline: "Tek marka bütünlüğü",
                                desc: "Dalmaçyalı levha ve aksesuarları aynı marka sistemi içinde birleştiren paket.",
                                points: ["Aynı marka levha + aksesuar", "Marka teknik dokümanları", "Sistem bütünlüğü"],
                                featured: false,
                                forWho: "Tek marka sistem bütünlüğü arayanlar için.",
                                notForWho: "Maliyeti minimum tutmak istiyorsanız Ekonomik'e bakın.",
                            },
                        ].map((tier) => (
                            <div
                                key={tier.name}
                                className={`relative rounded-2xl p-7 transition-all duration-200 ${
                                    tier.featured
                                        ? 'bg-fe-surface border-2 border-hub-gold-soft/60 sm:-translate-y-3 sm:scale-[1.02] shadow-[0_20px_50px_-20px_rgba(198,158,84,0.35)]'
                                        : 'bg-fe-surface/60 border border-fe-border hover:border-hub-gold-soft/30 hover:-translate-y-0.5'
                                }`}
                            >
                                {tier.featured && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="inline-flex items-center gap-1.5 bg-hub-gold-soft text-fe-bg text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full">
                                            <Star weight="fill" size={12} /> Popüler
                                        </span>
                                    </div>
                                )}
                                <div className="mb-2 t-meta uppercase tracking-[0.16em] text-hub-gold-soft">
                                    {tier.tagline}
                                </div>
                                <h3 className={`font-heading font-bold tracking-tight ${tier.featured ? 'text-white text-3xl' : 'text-white text-2xl'}`}>
                                    {tier.name}
                                </h3>
                                <p className="text-fe-text/85 text-base mt-4 mb-6 leading-relaxed">{tier.desc}</p>
                                <ul className="space-y-2.5">
                                    {tier.points.map((pt) => (
                                        <li key={pt} className="flex items-start gap-2.5 text-sm text-fe-text/85">
                                            <Check weight={ICON_WEIGHT} size={16} className="text-hub-gold-soft mt-0.5 flex-shrink-0" />
                                            {pt}
                                        </li>
                                    ))}
                                </ul>
                                {tier.forWho && (
                                    <p className="mt-3 text-xs text-fe-muted leading-relaxed">
                                        <span className="font-semibold text-fe-text">Kimin için: </span>{tier.forWho}
                                    </p>
                                )}
                                {tier.notForWho && (
                                    <p className="mt-1 text-xs text-fe-muted/70 leading-relaxed">
                                        <span className="font-semibold">Kimin için değil: </span>{tier.notForWho}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Tek ortak CTA — paket seçimi hesapta yapılır */}
                    <div className="mt-12 sm:mt-16 flex flex-col items-center gap-3">
                        <p className="text-fe-text/70 text-sm sm:text-base text-center max-w-md">
                            Üç paket de aynı hesapta birlikte gelir. Şehir + kalınlık + m² yeterli.
                        </p>
                        <a href="#mantolama-hesaplayici" className="btn-primary">
                            Üç paketi karşılaştır
                            <ArrowRight weight={ICON_WEIGHT} size={18} className="btn-arrow" />
                        </a>
                    </div>
                </div>
            </section>

            {/* Marka şeridi */}
            <BrandStrip />

            {/* Güven kanıtları */}
            <ProofBlock />

            {/* Nakliye akışı */}
            <section className="bg-fe-surface section-pad-md border-t border-fe-border">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
                    <RevealOnScroll className="grid md:grid-cols-12 gap-10 md:gap-16 items-center">
                        {/* Sol: editorial copy */}
                        <div className="md:col-span-5">
                            <Eyebrow className="mb-5">Lojistik · Otomatik</Eyebrow>
                            <h2 className="font-heading font-bold text-white text-4xl sm:text-5xl tracking-tight leading-[1.05] mb-6">
                                Nakliye koşulu teklifin içinde açıkça görünür.
                            </h2>
                            <p className="text-fe-text/85 text-lg leading-relaxed mb-2">
                                Taşyününde yalnız tam araç miktarları tekliflenir. <span className="text-hub-gold-soft font-semibold">Tam kamyon ve tam TIR siparişinde nakliye fiyata dahildir.</span>
                            </p>
                        </div>

                        {/* Sağ: yatay step indicator */}
                        <div className="md:col-span-7">
                            <div className="bg-fe-bg border border-fe-border rounded-2xl p-6 sm:p-8">
                                <div className="t-meta text-hub-gold-soft uppercase tracking-[0.18em] mb-5">
                                    Doluluk Eşikleri
                                </div>
                                <div className="flex flex-col gap-3">
                                    {[
                                        {
                                            label: 'Tam Kamyon',
                                            badge: undefined,
                                            Icon: Truck,
                                            iskonto: 'Ürün kuralına göre iskonto',
                                            nakliye: 'Nakliye fiyata dahil',
                                            scope: 'Tam kamyon dolumu',
                                            color: 'text-fe-text border-fe-border bg-fe-surface',
                                        },
                                        {
                                            label: 'Tam TIR',
                                            badge: 'En avantajlı',
                                            Icon: Truck,
                                            iskonto: 'Ürün kuralına göre iskonto',
                                            nakliye: 'Nakliye fiyata dahil',
                                            scope: 'Tam TIR dolumu',
                                            color: 'text-green-300 border-green-800/40 bg-green-950/25',
                                        },
                                        {
                                            label: 'Uygun EPS Seti',
                                            badge: '400 m² taban',
                                            Icon: Package,
                                            iskonto: 'Levha + toz grubu birlikte',
                                            nakliye: 'Nakliye fiyata dahil',
                                            scope: 'EPS marj ve set kuralı sağlandığında',
                                            color: 'text-fe-text border-fe-border bg-fe-surface',
                                        },
                                    ].map((item) => (
                                        <div key={item.label} className={`rounded-xl border p-4 ${item.color}`}>
                                            <div className="flex items-start gap-3">
                                                <item.Icon weight={ICON_WEIGHT} size={26} className="shrink-0 mt-0.5" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-heading font-bold text-base sm:text-lg leading-tight flex items-center gap-2 flex-wrap">
                                                        {item.label}
                                                        {item.badge && (
                                                            <span className="inline-flex items-center rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">{item.badge}</span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                                                        <span className="font-semibold">{item.iskonto}</span>
                                                        <span className="opacity-70">·</span>
                                                        <span>{item.nakliye}</span>
                                                    </div>
                                                    <div className="mt-1 text-[11px] uppercase tracking-wider opacity-60">
                                                        {item.scope}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-fe-text/60 text-xs mt-5 leading-relaxed">
                                    İskonto oranı marka ve modele göre değişir; sonuç ekranında seçtiğiniz ürünün güncel kuralı gösterilir.
                                </p>
                            </div>
                        </div>
                    </RevealOnScroll>
                </div>
            </section>

            {/* CTA BAND */}
            <section className="bg-fe-surface section-pad-md border-t border-fe-border">
                <RevealOnScroll className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
                    <Eyebrow className="mb-5 justify-center">Karar Verin</Eyebrow>
                    <h2 className="mt-3 font-heading font-extrabold text-[32px] sm:text-[40px] leading-[1.1] tracking-tight text-fe-text">
                        Tam araç veya uygun EPS seti teklifinizi <span className="text-brand">şimdi oluşturun</span>.
                    </h2>
                    <p className="mt-4 max-w-[560px] text-base text-fe-muted leading-relaxed">
                        Paketi seçip iletişim bilgilerinizi onaylayın; PDF ekranda oluşsun. İndirme veya paylaşma kanalını siz seçin.
                    </p>
                    <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                        <Link
                            href="#mantolama-hesaplayici"
                            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-fe-bg shadow-lg shadow-brand/20 transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-fe-bg"
                        >
                            Teklifi şimdi oluştur
                            <ArrowRight size={18} weight={ICON_WEIGHT} />
                        </Link>
                        <WhatsappLink
                            href={WHATSAPP_URL}
                            source="site_general"
                            className="inline-flex items-center gap-2 text-base font-medium text-fe-muted transition hover:text-fe-text"
                        >
                            WhatsApp&#39;tan danış
                            <ArrowRight size={16} weight={ICON_WEIGHT} />
                        </WhatsappLink>
                    </div>
                </RevealOnScroll>
            </section>

            {/* FAQ */}
            <section className="bg-fe-bg section-pad-md border-t border-fe-border">
                <div className="max-w-3xl mx-auto px-4 sm:px-6">
                    <SectionHeader
                        eyebrow="Karar Öncesi"
                        title="Son netleştirmeler"
                        lead="Sipariş öncesi en sık aldığımız 6 soru ve net cevapları."
                        tone="dark"
                        className="mb-12"
                    />
                    <div className="space-y-3">
                        {faqItems.map((item) => (
                            <details
                                key={item.q}
                                className="group bg-fe-surface border border-fe-border rounded-xl overflow-hidden hover:border-hub-gold-soft/30 transition-colors"
                            >
                                <summary className="faq-question flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none font-semibold text-white text-base sm:text-lg select-none">
                                    {item.q}
                                    <span className="text-fe-text/70 text-xl flex-shrink-0 transition-transform group-open:rotate-45">
                                        +
                                    </span>
                                </summary>
                                <div className="faq-answer px-6 pb-5 text-fe-text/85 text-base leading-relaxed border-t border-fe-border pt-4">
                                    {item.a}
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            <SiteFooter tone="dark" />
        </div>
    );
}

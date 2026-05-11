import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import Eyebrow from '@/components/shared/Eyebrow';
import RevealOnScroll from '@/components/shared/RevealOnScroll';
import WhatsappLink from '@/components/shared/WhatsappLink';
import PhoneCallLink from '@/components/shared/PhoneCallLink';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { buildBusinessGraph } from '@/lib/seo/buildBusinessNode';
import { BUSINESS_INFO, BUSINESS_REF, WAREHOUSE_INFO, WHATSAPP_URL } from '@/lib/business/info';
import {
  Phone,
  WhatsappLogo,
  EnvelopeSimple,
  Clock,
  Timer,
  Truck,
  MapPin,
  ArrowRight,
  ArrowUpRight,
  ChatCircleDots,
} from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';

const PHONE             = BUSINESS_INFO.phone.display;
const PHONE_TEL         = BUSINESS_INFO.phone.tel;
const EMAIL             = BUSINESS_INFO.email;
// İletişim sayfasında konum kartı DEPO adresini gösterir (ofis adresinden
// daha çok ziyaret edilen lokasyon — Tuzla Tepeören Orhanlı).
const ADDRESS_LINE      = WAREHOUSE_INFO.addressLine;
const ADDRESS_CITY      = WAREHOUSE_INFO.cityLine;
const MAPS_DIRECTIONS_URL = WAREHOUSE_INFO.mapsDirectionsUrl;

export const metadata: Metadata = buildMetadata({
  title: 'İletişim',
  description:
    'Soru, teklif ve bayilik için bize ulaşın. Telefon, WhatsApp, e-posta. Mesai içinde 30 dk dönüş garantisi.',
  path: '/iletisim',
  type: 'website',
});

// ContactPage — mainEntity Organization node'una @id pointer ile bağlı,
// inline tekrarlanmaz. @graph içinde Organization buildBusinessNode'dan gelir.
const contactPageNode = {
  '@type': 'ContactPage',
  name: `İletişim — ${BUSINESS_INFO.brandName}`,
  url: `${BUSINESS_INFO.url}/iletisim`,
  mainEntity: BUSINESS_REF,
};

const OPS_METRICS = [
  { Icon: Clock,  label: 'Mesai',         value: 'Pzt–Cmt  08:00–18:00' },
  { Icon: Timer,  label: 'Ortalama Yanıt', value: '30 dk içinde' },
  { Icon: Truck,  label: 'Sevkiyat',      value: 'Türkiye geneli 81 il' },
  { Icon: MapPin, label: 'Depo',          value: 'Tuzla & Gebze' },
];

export default function IletisimPage() {
  return (
    <div className="min-h-screen bg-hub-cream flex flex-col">
      <SiteHeader tone="warm" />

      <main className="flex-1">
        {/* HERO — sade editorial */}
        <section className="border-b border-hub-rule">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <Eyebrow tone="warm" className="mb-5">Bize Ulaşın</Eyebrow>
            <h1 className="font-heading font-extrabold text-hub-ink tracking-tight leading-[1.05] text-[clamp(2.25rem,4.6vw,4rem)] mb-5 max-w-3xl">
              En kısa yoldan{' '}
              <span className="text-hub-gold">bayilik fiyatına</span>.
            </h1>
            <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed max-w-2xl">
              Soru, teklif veya bayilik için bize ulaşın. Mesai içinde ortalama 30 dakikada dönüş yapıyoruz.
              Tercih ettiğiniz kanaldan başlamanız yeterli.
            </p>
          </div>
        </section>

        {/* 3 KANAL — asimetrik 12-col grid */}
        <section className="border-b border-hub-rule">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div className="grid md:grid-cols-12 gap-6">
              {/* Telefon — büyük editorial (md:col-span-6) */}
              <div className="md:col-span-6 bg-hub-warm rounded-2xl p-7 sm:p-9 ring-1 ring-hub-rule flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-hub-cream ring-1 ring-hub-gold/30 text-hub-gold">
                    <Phone weight={ICON_WEIGHT} size={22} />
                  </span>
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-hub-gold">
                    Telefon
                  </div>
                </div>
                <PhoneCallLink
                  href={`tel:${PHONE_TEL}`}
                  source="iletisim_phone"
                  className="font-heading font-bold text-hub-ink tracking-tight leading-none hover:text-hub-gold transition-colors text-[clamp(2rem,3.6vw,3.25rem)] mb-3"
                >
                  {PHONE}
                </PhoneCallLink>
                <p className="text-hub-ink-2 text-base leading-relaxed mb-6 max-w-md">
                  Ortalama yanıt süresi 30 dakika. Hızlı fiyat sorularında en doğrudan kanal.
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-3">
                  <PhoneCallLink
                    href={`tel:${PHONE_TEL}`}
                    source="iletisim_phone"
                    className="btn-primary"
                  >
                    Hemen Ara
                    <ArrowRight weight={ICON_WEIGHT} size={18} className="btn-arrow" />
                  </PhoneCallLink>
                  <span className="text-hub-ink-2/70 text-sm">Pzt–Cmt 08:00–18:00</span>
                </div>
              </div>

              {/* WhatsApp — yeşil accent + chat-bubble preview (md:col-span-6 desktop'ta yan yana ama farklı karakterli) */}
              <div className="md:col-span-6 relative rounded-2xl p-7 sm:p-9 overflow-hidden bg-[#0a3d2c] text-white flex flex-col">
                <div
                  aria-hidden
                  className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-25"
                  style={{ background: 'radial-gradient(circle, #25D366, transparent 70%)' }}
                />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#25D366]/20 ring-1 ring-[#25D366]/40 text-[#25D366]">
                      <WhatsappLogo weight="fill" size={22} />
                    </span>
                    <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#25D366]">
                      WhatsApp · Hızlı kanal
                    </div>
                  </div>

                  {/* Chat bubble preview */}
                  <div className="space-y-2.5 mb-6 max-w-sm">
                    <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-snug">
                      Merhaba, 320 m² için Dalmaçyalı Premium fiyatı alabilir miyim?
                    </div>
                    <div className="bg-[#25D366]/95 text-[#0a3d2c] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-snug ml-auto w-fit max-w-full">
                      Tabii. Hangi şehir için, kalınlık tercihiniz?
                    </div>
                  </div>

                  <p className="text-white/70 text-sm mb-6 max-w-md leading-relaxed">
                    Anlık fiyat, stok ve teklif sorularınız için en hızlı kanal. Ortalama 5–10 dk dönüş.
                  </p>

                  <WhatsappLink
                    href={WHATSAPP_URL}
                    source="iletisim_card"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#25D366] hover:bg-[#1faa54] text-[#0a3d2c] font-bold text-sm transition-colors"
                  >
                    <ChatCircleDots weight={ICON_WEIGHT} size={18} />
                    Yazışmayı Başlat
                  </WhatsappLink>
                </div>
              </div>

              {/* E-posta — geniş, form-vari (full row) */}
              <div className="md:col-span-12 rounded-2xl bg-hub-warm ring-1 ring-hub-rule p-7 sm:p-9">
                <div className="grid md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-7">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-hub-cream ring-1 ring-hub-gold/30 text-hub-gold">
                        <EnvelopeSimple weight={ICON_WEIGHT} size={20} />
                      </span>
                      <div className="font-mono text-xs uppercase tracking-[0.18em] text-hub-gold">
                        E-posta · Detaylı projeler için
                      </div>
                    </div>
                    <h3 className="font-heading font-bold text-hub-ink text-2xl sm:text-3xl tracking-tight leading-snug mb-2">
                      Şartname / proje dökümanı varsa,
                      <br className="hidden sm:inline" /> e-posta en uygun yol.
                    </h3>
                    <p className="text-hub-ink-2 text-base leading-relaxed max-w-xl">
                      İhale tablosu, ürün listesi, teknik şartname gibi dosyaları ek olarak iletebilirsiniz. 1 iş günü içinde teklif döner.
                    </p>
                  </div>
                  <div className="md:col-span-5 md:border-l md:border-hub-rule md:pl-6">
                    <div className="text-xs uppercase tracking-[0.14em] text-hub-ink-2/70 mb-2">Adres</div>
                    <a
                      href={`mailto:${EMAIL}`}
                      className="font-mono font-semibold text-hub-ink hover:text-hub-gold transition-colors text-base sm:text-lg break-all block mb-5"
                    >
                      {EMAIL}
                    </a>
                    <a href={`mailto:${EMAIL}`} className="btn-secondary !w-full !justify-center">
                      E-posta Gönder
                      <ArrowRight weight={ICON_WEIGHT} size={16} className="btn-arrow" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* OPS PANEL — 4 metric strip */}
        <section className="bg-hub-warm border-b border-hub-rule">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {OPS_METRICS.map((m) => (
                <div key={m.label} className="flex items-start gap-3">
                  <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-hub-cream ring-1 ring-hub-gold/30 text-hub-gold">
                    <m.Icon weight={ICON_WEIGHT} size={18} />
                  </span>
                  <div>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-hub-ink-2/65 mb-1">
                      {m.label}
                    </div>
                    <div className="font-heading font-bold text-hub-ink text-base sm:text-lg leading-snug">
                      {m.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DEPOMUZ — bağımsız modül: foto + adres + maps + CTA */}
        <section className="border-b border-hub-rule">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <RevealOnScroll className="grid md:grid-cols-12 gap-8 md:gap-14 items-center">
              <div className="md:col-span-6 relative aspect-[5/4] rounded-2xl overflow-hidden ring-1 ring-hub-rule order-2 md:order-1">
                <Image
                  src="/hakkimizda/Ozeryapi-Hakkimizda-depo.webp"
                  alt="ÖzerGrup Tuzla Tepeören depo"
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                />
              </div>
              <div className="md:col-span-6 order-1 md:order-2">
                <Eyebrow tone="warm" className="mb-5">Tuzla Tepeören · Depo</Eyebrow>
                <h2 className="font-heading font-bold text-hub-ink tracking-tight leading-[1.1] text-3xl sm:text-4xl mb-5">
                  Numune ve teknik incelemeye depomuza bekleriz.
                </h2>
                <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed mb-6">
                  Ürün numunelerini fiziken inceleyebilir, teknik ekibimizle yüz yüze görüşebilirsiniz.
                  Orhanlı Nakliyeciler Sitesi&apos;ne 2 km mesafede.
                </p>
                <address className="not-italic text-hub-ink leading-relaxed text-base mb-8">
                  <span className="block font-semibold">{ADDRESS_LINE}</span>
                  <span className="block text-hub-ink-2">{ADDRESS_CITY}</span>
                </address>
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href={MAPS_DIRECTIONS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                  >
                    Yol Tarifi Al
                    <ArrowUpRight weight={ICON_WEIGHT} size={18} className="btn-arrow" />
                  </a>
                  <Link href="/depomuz" className="btn-ghost">
                    Depo Sayfası
                    <ArrowRight weight={ICON_WEIGHT} size={16} className="btn-arrow" />
                  </Link>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* YASAL — sakin, utility hissinde */}
        <section>
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
            <div className="border-t border-hub-rule pt-8">
              <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4 text-sm">
                <CorpRow label="Firma">ÖzerGrup Yalıtım ve İzolasyon A.Ş.</CorpRow>
                <CorpRow label="Adres">
                  {ADDRESS_LINE}
                  <br />
                  {ADDRESS_CITY}
                </CorpRow>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tone="warm" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBusinessGraph([contactPageNode])) }}
      />
    </div>
  );
}

function CorpRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-hub-ink-2/65 mb-1">{label}</dt>
      <dd className="text-hub-ink">{children}</dd>
    </div>
  );
}

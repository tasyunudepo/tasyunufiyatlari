import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ChatCircle } from '@phosphor-icons/react/dist/ssr';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import WhatsappLink from '@/components/shared/WhatsappLink';
import PhoneCallLink from '@/components/shared/PhoneCallLink';
import { ICON_WEIGHT } from '@/lib/design/tokens';
import { BUSINESS_INFO, WAREHOUSE_INFO, WHATSAPP_URL } from '@/lib/business/info';
import { buildBusinessGraph } from '@/lib/seo/buildBusinessNode';

const PHONE     = BUSINESS_INFO.phone.display;
const PHONE_TEL = BUSINESS_INFO.phone.tel;
const MAPS_EMBED_SRC =
  'https://www.google.com/maps/embed?pb=!4v1777522409877!6m8!1m7!1sdJGTz08OAxTO63W6MPsmXQ!2m2!1d40.89335830980431!2d29.35476984828961!3f281.97!4f2.6700000000000017!5f0.4125900490817119';
const MAPS_DIRECTIONS_URL = WAREHOUSE_INFO.mapsDirectionsUrl;
const ADDRESS_LINE        = WAREHOUSE_INFO.addressLine;
const ADDRESS_CITY        = WAREHOUSE_INFO.cityLine;

export const metadata: Metadata = {
  title: 'Depomuz Tuzla Tepeören',
  description:
    "İstanbul Tuzla Tepeören depomuzdan Türkiye'nin 81 iline yalıtım malzemesi sevkiyatı. Orhanlı Nakliyeciler Sitesine 2 km. Adres, harita, iletişim.",
  alternates: { canonical: '/depomuz' },
};

// /depomuz @graph — kanonik Organization + Warehouse Place node'u.
// Hardcoded LocalBusiness şeması yerine buildBusinessGraph kullanılır;
// Place'in containedInPlace alanı Organization @id'sine pointer'lar.
const depomuzGraph = buildBusinessGraph([], { includeWarehouse: true });

export default function DepomuzPage() {
  return (
    <div className="min-h-screen bg-fe-bg flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero — split: metin + görsel */}
        <section className="border-b border-fe-border">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-500 font-semibold mb-3">
                  Depo & Lojistik
                </p>
                <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                  İstanbul Tuzla Tepeören&apos;deki lokasyonumuz Türkiye&apos;nin her iline
                  nakliye gönderimi sağlar.
                </h1>
              </div>
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-fe-border">
                <Image
                  src="/depo/tasyunu-depo.webp"
                  alt="Tuzla Tepeören taşyünü ve EPS levha deposu"
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3 İstatistik kartı */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <StatCard
              num="2 KM"
              title="Nakliyeciler Sitesine Mesafe"
              sub="Tuzla Orhanlı Nakliyeciler Sitesine 2 km · 4 dk. mesafede"
            />
            <StatCard
              num="81 İL"
              title="Türkiye Geneli Gönderim"
              sub="Türkiye'nin 81 iline parsiyel gönderi imkanı"
            />
            <StatCard
              num="1001"
              title="Ürün Çeşitliliği"
              sub="Yapı sektöründe Su, Isı, Yangın İzolasyonu malzemelerine ek olarak boardex, gazbeton, karopan asma tavan malzemeleri bayiliklerimiz ile sürekli stok tuttuğumuz ürünler arasındadır."
            />
          </div>
        </section>

        {/* İki kolon — Ulaşın + Konum */}
        <section className="bg-fe-surface border-y border-fe-border">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Bize Ulaşın */}
              <div className="rounded-2xl bg-fe-bg border border-fe-border p-6 sm:p-8">
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-white mb-5 tracking-tight">
                  Bize Ulaşın
                </h2>
                <dl className="space-y-4 text-sm">
                  <Row label="Telefon">
                    <PhoneCallLink
                      href={`tel:${PHONE_TEL}`}
                      source="depomuz_phone"
                      className="font-mono text-brand-400 hover:text-brand-300 transition-colors text-base"
                    >
                      {PHONE}
                    </PhoneCallLink>
                  </Row>
                  <Row label="Çalışma Saatleri">
                    <span className="text-fe-text">Pzt–Cts 08:00–18:00 · Pazar Kapalı</span>
                  </Row>
                  <Row label="E-posta">
                    <a
                      href="mailto:bilgi@tasyunufiyatlari.com"
                      className="text-fe-text hover:text-brand-400 transition-colors"
                    >
                      bilgi@tasyunufiyatlari.com
                    </a>
                  </Row>
                </dl>

                <WhatsappLink
                  href={WHATSAPP_URL}
                  source="depomuz_cta"
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors"
                >
                  <ChatCircle weight={ICON_WEIGHT} size={18} /> WhatsApp ile Yazışın
                </WhatsappLink>
              </div>

              {/* Konum */}
              <div className="rounded-2xl bg-fe-bg border border-fe-border p-6 sm:p-8">
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-white mb-5 tracking-tight">
                  Konum
                </h2>
                <address className="not-italic text-fe-text space-y-1 text-sm">
                  <div>{ADDRESS_LINE}</div>
                  <div>{ADDRESS_CITY}</div>
                </address>

                <a
                  href={MAPS_DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 w-full inline-flex items-center justify-center px-5 py-3 rounded-xl border border-brand-500 text-brand-400 hover:bg-brand-500/10 font-bold text-sm transition-colors"
                >
                  Yol Tarifi Al
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Google Maps embed */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="rounded-2xl overflow-hidden border border-hub-rule h-[400px]">
            <iframe
              src={MAPS_EMBED_SRC}
              className="w-full h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Tuzla Tepeören Depo Konumu"
            />
          </div>
        </section>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(depomuzGraph) }}
      />
    </div>
  );
}

function StatCard({ num, title, sub }: { num: string; title: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-fe-surface border border-fe-border p-6">
      <div className="font-heading text-3xl sm:text-4xl font-bold text-brand-400 tracking-tight mb-2">
        {num}
      </div>
      <div className="text-white font-semibold text-base mb-2">{title}</div>
      <div className="text-fe-muted text-sm leading-relaxed">{sub}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-fe-muted mb-1">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ChatCircleDots, FileText, MapPin, Phone, Truck, WhatsappLogo } from '@phosphor-icons/react/dist/ssr'

import Eyebrow from '@/components/shared/Eyebrow'
import PhoneCallLink from '@/components/shared/PhoneCallLink'
import RevealOnScroll from '@/components/shared/RevealOnScroll'
import SiteFooter from '@/components/shared/SiteFooter'
import SiteHeader from '@/components/shared/SiteHeader'
import WhatsappLink from '@/components/shared/WhatsappLink'
import { BUSINESS_INFO, BUSINESS_REF, TEL_URL, WAREHOUSE_INFO, WHATSAPP_URL } from '@/lib/business/info'
import { ICON_WEIGHT } from '@/lib/design/tokens'
import { buildBusinessGraph } from '@/lib/seo/buildBusinessNode'
import { buildMetadata } from '@/lib/seo/buildMetadata'

const ADDRESS_LINE = WAREHOUSE_INFO.addressLine
const ADDRESS_CITY = WAREHOUSE_INFO.cityLine
const MAPS_DIRECTIONS_URL = WAREHOUSE_INFO.mapsDirectionsUrl
const PHONE = BUSINESS_INFO.phone.display
const HOURS = `Pzt–Cmt ${BUSINESS_INFO.openingHours.opens}–${BUSINESS_INFO.openingHours.closes}`

export const metadata: Metadata = buildMetadata({
  title: 'Teklif ve İletişim',
  description:
    'Proje ölçeğinde tam kamyon veya TIR teklifi oluşturun. Telefon veya WhatsApp üzerinden projenizin ürün, metraj ve sevkiyat ayrıntılarını paylaşın.',
  path: '/iletisim',
  type: 'website',
})

const contactPageNode = {
  '@type': 'ContactPage',
  name: `Teklif ve İletişim — ${BUSINESS_INFO.brandName}`,
  url: `${BUSINESS_INFO.url}/iletisim`,
  mainEntity: BUSINESS_REF,
}

export default function IletisimPage() {
  return (
    <div className="flex min-h-screen flex-col bg-hub-cream">
      <SiteHeader tone="warm" />
      <main className="flex-1">
        <section className="border-b border-hub-rule">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
            <Eyebrow tone="warm" className="mb-5">Teklif ve İletişim</Eyebrow>
            <h1 className="mb-5 max-w-3xl font-heading text-[clamp(2.25rem,4.6vw,4rem)] font-extrabold leading-[1.05] tracking-tight text-hub-ink">
              Teklifinizi oluşturun, <span className="text-hub-gold">referansınızla ilerleyin.</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-hub-ink-2 sm:text-lg">
              Satışlarımız proje ölçeğinde, tam kamyon veya TIR bazında yapılır.
              Paket, adet ve düşük metrajlı taleplere destek veremiyoruz.
            </p>
          </div>
        </section>

        {/* Telefon ve WhatsApp (Emrah kararı, 13 Ekim 2026): 19 Ağustos'tan önceki iki kart, sohbet önizlemesi olmadan. */}
        <section className="border-b border-hub-rule" aria-label="Telefon ve WhatsApp">
          <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-2">
            <div className="flex flex-col rounded-2xl bg-hub-warm p-7 ring-1 ring-hub-rule sm:p-9">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-hub-cream text-hub-gold ring-1 ring-hub-gold/30">
                  <Phone size={22} weight={ICON_WEIGHT} />
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-hub-gold">Telefon</span>
              </div>
              <PhoneCallLink
                href={TEL_URL}
                source="iletisim_phone"
                className="mb-3 font-heading text-[clamp(2rem,3.6vw,3.25rem)] font-bold leading-none tracking-tight text-hub-ink transition-colors hover:text-hub-gold"
              >
                {PHONE}
              </PhoneCallLink>
              <p className="mb-6 max-w-md text-base leading-relaxed text-hub-ink-2">
                Projenizin ürün, metraj ve şehir bilgisini satış ekibimizle doğrudan paylaşın.
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-3">
                <PhoneCallLink href={TEL_URL} source="iletisim_phone" className="btn-primary">
                  Hemen Ara
                  <ArrowRight size={18} weight={ICON_WEIGHT} className="btn-arrow" />
                </PhoneCallLink>
                <span className="text-sm text-hub-ink-2">{HOURS}</span>
              </div>
            </div>

            <div className="relative flex flex-col overflow-hidden rounded-2xl bg-[#0a3d2c] p-7 text-white sm:p-9">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/20 text-[#25D366] ring-1 ring-[#25D366]/40">
                  <WhatsappLogo size={22} weight="fill" />
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#25D366]">WhatsApp</span>
              </div>
              <p className="mb-6 max-w-md text-base leading-relaxed text-white/80">
                Ürün seçimi, teklif koşulu ve sevkiyat planı için proje ayrıntılarınızı yazabilirsiniz.
              </p>
              <div className="mt-auto">
                <WhatsappLink
                  href={WHATSAPP_URL}
                  source="iletisim_card"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 text-sm font-bold text-[#0a3d2c] transition-colors hover:bg-[#1faa54]"
                >
                  <ChatCircleDots size={18} weight={ICON_WEIGHT} />
                  Yazışmayı Başlat
                </WhatsappLink>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-hub-rule bg-hub-warm">
          <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-2">
            <div className="rounded-2xl bg-hub-cream p-7 ring-1 ring-hub-rule sm:p-9">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-hub-warm text-hub-gold ring-1 ring-hub-gold/30">
                <Truck size={22} weight={ICON_WEIGHT} />
              </span>
              <h2 className="mt-5 font-heading text-3xl font-bold text-hub-ink">Teklifiniz yoksa</h2>
              <p className="mt-3 leading-relaxed text-hub-ink-2">
                Ürün, kalınlık, şehir ve tam araç metrajınızı seçin. Sistem referanslı PDF teklifinizi oluştursun.
              </p>
              <Link href="/#mantolama-hesaplayici" className="btn-primary mt-7">
                Proje fiyatımı hesapla
                <ArrowRight size={18} weight={ICON_WEIGHT} className="btn-arrow" />
              </Link>
            </div>

            <div className="rounded-2xl bg-hub-dark p-7 text-white sm:p-9">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-hub-gold-soft ring-1 ring-white/15">
                <FileText size={22} weight={ICON_WEIGHT} />
              </span>
              <h2 className="mt-5 font-heading text-3xl font-bold">Teklif referansınız varsa</h2>
              <p className="mt-3 leading-relaxed text-hub-warm/80">
                PDF teklif ekranındaki hazır WhatsApp bağlantısı teklif referansınızı otomatik ekler. Referans numaranız ürün, metraj ve sevkiyat planınızı satış ekibine taşır.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-hub-rule">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
            <RevealOnScroll className="grid items-center gap-8 md:grid-cols-12 md:gap-14">
              <div className="relative order-2 aspect-[5/4] overflow-hidden rounded-2xl ring-1 ring-hub-rule md:order-1 md:col-span-6">
                <Image src="/hakkimizda/Ozeryapi-Hakkimizda-depo.webp" alt="ÖzerGrup Tuzla Tepeören depo" fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
              </div>
              <div className="order-1 md:order-2 md:col-span-6">
                <Eyebrow tone="warm" className="mb-5">Tuzla Tepeören</Eyebrow>
                <h2 className="mb-5 font-heading text-3xl font-bold leading-[1.1] tracking-tight text-hub-ink sm:text-4xl">Depo ve görüşme noktası</h2>
                <p className="mb-6 text-base leading-relaxed text-hub-ink-2 sm:text-lg">Ziyaret planlaması teklif referansı oluştuktan sonra yapılır.</p>
                <address className="mb-8 not-italic leading-relaxed text-hub-ink">
                  <span className="block font-semibold">{ADDRESS_LINE}</span>
                  <span className="block text-hub-ink-2">{ADDRESS_CITY}</span>
                </address>
                <a href={MAPS_DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  <MapPin size={18} weight={ICON_WEIGHT} /> Yol tarifi al
                  <ArrowUpRight size={18} weight={ICON_WEIGHT} className="btn-arrow" />
                </a>
              </div>
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <SiteFooter tone="warm" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBusinessGraph([contactPageNode])) }} />
    </div>
  )
}

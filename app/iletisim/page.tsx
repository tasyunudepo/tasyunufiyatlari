import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, FileText, MapPin, Truck } from '@phosphor-icons/react/dist/ssr'

import Eyebrow from '@/components/shared/Eyebrow'
import RevealOnScroll from '@/components/shared/RevealOnScroll'
import SiteFooter from '@/components/shared/SiteFooter'
import SiteHeader from '@/components/shared/SiteHeader'
import { BUSINESS_INFO, BUSINESS_REF, WAREHOUSE_INFO } from '@/lib/business/info'
import { ICON_WEIGHT } from '@/lib/design/tokens'
import { buildBusinessGraph } from '@/lib/seo/buildBusinessNode'
import { buildMetadata } from '@/lib/seo/buildMetadata'

const ADDRESS_LINE = WAREHOUSE_INFO.addressLine
const ADDRESS_CITY = WAREHOUSE_INFO.cityLine
const MAPS_DIRECTIONS_URL = WAREHOUSE_INFO.mapsDirectionsUrl

export const metadata: Metadata = buildMetadata({
  title: 'Teklif ve İletişim',
  description:
    'Proje ölçeğinde tam kamyon veya TIR teklifi oluşturun. Satış iletişimi, referanslı teklif oluştuktan sonra açılır.',
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
              <p className="mt-7 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-hub-warm/75">
                İletişim kanalı, teklif kaydı tamamlandığında otomatik olarak açılır.
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

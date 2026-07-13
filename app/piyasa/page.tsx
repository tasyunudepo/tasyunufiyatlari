import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  PackageSearch,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Piyasa Verileri | Taşyünü Fiyatları',
  description:
    'Kaynağı ve güncellenme tarihi doğrulanan yalıtım piyasası verileri için yayın durumu.',
  robots: {
    index: false,
    follow: true,
  },
}

const publicationRules = [
  'Verinin kaynağı açıkça belirtilmeli.',
  'Hangi dönemi kapsadığı anlaşılmalı.',
  'Güncellenme tarihi ziyaretçiye gösterilmeli.',
]

export default function PiyasaPage() {
  return (
    <main className="min-h-screen bg-slate-950 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3 text-sm text-slate-400">
          <BarChart3 aria-hidden="true" className="h-5 w-5 text-orange-500" />
          <span>Piyasa verileri</span>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 sm:p-10 lg:p-12">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Veri yayını beklemede
              </div>

              <h1 className="max-w-3xl font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Doğrulanmış piyasa verisi şu anda yayınlanmıyor.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Kaynağı, dönemi ve güncellenme tarihi doğrulanmayan rakamları göstermiyoruz.
                İşlem hacmi, bölgesel talep ve son proje bilgileri güvenilir bir veri kaynağına
                bağlandığında bu sayfada açık kaynağıyla birlikte yayınlanacak.
              </p>

              <div className="mt-8 rounded-2xl border border-slate-700/80 bg-slate-950/60 p-5 sm:p-6">
                <h2 className="font-heading text-lg font-semibold text-white">
                  Bir veriyi yayınlamadan önce
                </h2>
                <ul className="mt-4 space-y-3">
                  {publicationRules.map((rule) => (
                    <li key={rule} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
                      />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <aside className="border-t border-slate-800 bg-gradient-to-br from-orange-600 to-orange-700 p-6 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Calculator aria-hidden="true" className="h-6 w-6" />
              </div>
              <h2 className="mt-6 font-heading text-2xl font-bold text-white">
                Projenize özel fiyatı hesaplayın
              </h2>
              <p className="mt-3 leading-7 text-orange-50">
                Metrajı, kalınlığı, ürünü ve şehri seçin. Hesaplayıcı fiyat listesi ve sevkiyat
                kurallarına göre projenizin sonucunu göstersin.
              </p>

              <div className="mt-8 space-y-3">
                <Link
                  href="/#mantolama-hesaplayici"
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-orange-700 shadow-lg transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-700"
                >
                  Projem için fiyat hesapla
                  <ArrowRight aria-hidden="true" className="h-5 w-5" />
                </Link>
                <Link
                  href="/urunler"
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/35 px-5 py-3 font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <PackageSearch aria-hidden="true" className="h-5 w-5" />
                  Ürünleri incele
                </Link>
              </div>

              <p className="mt-6 text-sm leading-6 text-orange-100">
                Bu sayfada doğrulanmamış işlem hacmi, bölgesel yüzde veya müşteri projesi
                yayınlanmaz.
              </p>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}

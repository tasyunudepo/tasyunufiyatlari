// Ana sayfa ilk ekran fiyat özeti (Emrah onayı, 17 Ekim 2026 — "taş yünü fiyatları" yuvarlak masası, Astra ile uzlaşı).
// "Taş yünü fiyatları" arayan ilk ekranda rakamı görsün; tam tablo ve hesaplayıcı yerinde kalır. Rakamlar tabloyla aynı
// derleme anı fiyat fotoğrafından gelir (app/page.tsx) ve aynı koşulu taşır: 1 kamyon, İstanbul Avrupa Yakası, KDV hariç.
// Kalınlıklar: "taş yünü" kalınlık aramalarında en çok görünme alan dördü (Search Console, 16 Eylül–13 Ekim 2026).

import Link from 'next/link'

import type { HomePriceRow } from './HomePriceTable'

export const SUMMARY_THICKNESSES = [3, 5, 8, 10] as const

const tl = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function HomePriceSummary({ rows, monthYear, cityLabel }: { rows: HomePriceRow[]; monthYear: string; cityLabel: string }) {
  const items = SUMMARY_THICKNESSES.map((t) => rows.find((r) => r.thicknessCm === t)).filter(
    (r): r is HomePriceRow & { min: NonNullable<HomePriceRow['min']> } => !!r?.min,
  )
  if (items.length === 0) return null
  return (
    <div className="mt-6 rounded-2xl border border-[#d2ccbe] bg-white/75 p-4 sm:p-5" data-testid="home-price-summary">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#70591f]">{monthYear} · kalınlığa göre en düşük m² fiyatı</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {items.map((r) => (
          <li key={r.thicknessCm}>
            <Link href={r.href} prefetch={false} className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7528]">
              <span className="block whitespace-nowrap text-[13px] font-semibold text-[#3a372f] group-hover:text-[#70591f]">{r.thicknessCm} cm taş yünü</span>
              <span className="block whitespace-nowrap font-heading text-[17px] font-extrabold tabular-nums text-[#151510]">{tl(r.min.unit)} ₺/m²</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5 text-[#59564d]">
        Yalnız mantolama levhası · en az 1 tam kamyon · {cityLabel} teslim · KDV hariç · tam araçta nakliye fiyata dahildir
      </p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
        <a href="#fiyat-tablosu" className="text-[#70591f] underline decoration-[#c9a663] underline-offset-4 hover:text-[#171711]">
          Bütün kalınlıkların fiyatları
        </a>
        <a href="#mantolama-hesaplayici" className="text-[#70591f] underline decoration-[#c9a663] underline-offset-4 hover:text-[#171711]">
          Teslim fiyatını hesaplayın
        </a>
      </div>
    </div>
  )
}

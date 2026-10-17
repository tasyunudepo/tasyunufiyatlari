// Ana sayfa fiyat tablosu (Emrah onayı, 14 Ekim 2026 — hub planı Faz 4).
// "taş yünü fiyatları" araması (3 ayda 13.592 gösterim) ana sayfaya ve SW035 sayfasına bölünüyordu; ana sayfada
// kalınlık başına en düşük 1 kamyon m² fiyatı ve 150 yoğunluk karşılığı, her satır o kalınlığın hub'ına gider.
// Rakamlar derleme anı fiyat fotoğrafından (sayfa dosyasında hesaplanır); bu bileşen yalnız gösterir.

import Link from 'next/link'

export interface HomePriceRow {
  thicknessCm: number
  href: string
  count: number
  min: { unit: number; name: string } | null
  min150: { unit: number; name: string; href: string | null } | null
}

const tl = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function HomePriceTable({ rows, monthYear, cityLabel }: { rows: HomePriceRow[]; monthYear: string; cityLabel: string }) {
  if (rows.length === 0) return null
  return (
    <section id="fiyat-tablosu" className="scroll-mt-24 border-b border-[#d6d0c2]" aria-labelledby="fiyat-tablosu-baslik" data-testid="home-price-table">
      <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#70591f]">Taşyünü fiyatları · {monthYear}</p>
        <h2 id="fiyat-tablosu-baslik" className="mt-3 font-heading text-3xl font-bold tracking-tight text-[#171711] sm:text-4xl">
          {monthYear} taşyünü m² fiyatları
        </h2>
        <p className="mt-3 max-w-[760px] text-sm leading-6 text-[#59564d] sm:text-base sm:leading-7">
          Sitede karşılaştırılan sıvalı dış cephe mantolama levhaları arasında kalınlığa göre en düşük m² fiyatı: {cityLabel} teslim, 1 kamyon
          siparişinde, KDV hariç; tam araçta nakliye fiyata dahildir. Satıra dokunun, o kalınlıktaki bütün levhaları yan yana
          görün.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#d6d0c2] bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Kalınlığa göre en düşük taşyünü m² fiyatları, {monthYear}</caption>
            <thead>
              <tr className="border-b border-[#d6d0c2] bg-[#faf6ed] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6b6557]">
                <th scope="col" className="px-3 py-3 sm:px-4">Kalınlık</th>
                <th scope="col" className="px-3 py-3 sm:px-4">En düşük m² fiyatı</th>
                <th scope="col" className="px-3 py-3 sm:px-4">150 yoğunlukta en düşük</th>
                <th scope="col" className="hidden px-4 py-3 sm:table-cell"><span className="sr-only">Bütün levhalar</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.thicknessCm} className="border-b border-[#ebe5d8] align-top last:border-0">
                  <th scope="row" className="px-3 py-3 font-normal sm:px-4">
                    <Link href={row.href} className="font-heading text-base font-bold text-[#151510] underline-offset-2 hover:text-[#70591f] hover:underline">
                      {row.thicknessCm} cm taş yünü
                    </Link>
                  </th>
                  <td className="px-3 py-3 sm:px-4">
                    {row.min ? (
                      <>
                        <span className="block whitespace-nowrap font-heading text-base font-extrabold tabular-nums text-[#151510]">{tl(row.min.unit)} ₺/m²</span>
                        <span className="block text-xs text-[#6b6557]">{row.min.name}</span>
                      </>
                    ) : (
                      <span className="text-[#6b6557]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {row.min150 ? (
                      <>
                        <span className="block whitespace-nowrap font-semibold tabular-nums text-[#25241f]">{tl(row.min150.unit)} ₺/m²</span>
                        {row.min150.href ? (
                          <Link href={row.min150.href} className="block text-xs text-[#70591f] underline-offset-2 hover:underline">
                            {row.min150.name}
                          </Link>
                        ) : (
                          <span className="block text-xs text-[#6b6557]">{row.min150.name}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-[#6b6557]">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-right sm:table-cell">
                    <Link href={row.href} className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-[#70591f] underline-offset-2 hover:underline">
                      {row.count} levha yan yana →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

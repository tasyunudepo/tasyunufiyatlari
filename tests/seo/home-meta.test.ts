import { describe, expect, it } from 'vitest'

import type { HomePriceRow } from '@/components/home/HomePriceTable'
import { homeDescription, homeTitle } from '@/lib/seo/homeMeta'

// 17 Ekim 2026 — ana sayfa "taş yünü fiyatları" hedefi: açıklamadaki rakamlar görünen tablo satırlarından.
const row = (t: number, unit: number | null): HomePriceRow => ({
  thicknessCm: t,
  href: `/tasyunu-fiyatlari/${t}-cm`,
  count: 8,
  min: unit === null ? null : { unit, name: 'Ürün' },
  min150: null,
})

describe('ana sayfa başlığı ve açıklaması', () => {
  it('başlık aramayla başlar, rakamın levha fiyatı olduğunu söyler', () => {
    expect(homeTitle('Ekim 2026')).toBe('Taş Yünü Fiyatları Ekim 2026 — Mantolama Levhası m² Fiyatı')
    expect(homeTitle('Ekim 2026').length).toBeLessThanOrEqual(60)
  })

  it('açıklama koşulla başlar, en ince ve en kalın fiyatlı kalınlığın tablodaki rakamını taşır', () => {
    const d = homeDescription([row(3, 241.5), row(5, 330), row(10, 534.46), row(15, 780.2)], 'Ekim 2026', 'İstanbul Avrupa Yakası')
    expect(d).toBe(
      'Ekim 2026 taş yünü fiyatları (KDV hariç, 1 kamyon, İstanbul Avrupa Yakası): mantolama levhası m² fiyatı 3 cm’de 241,50 ₺, 15 cm’de 780,20 ₺’den başlar. Kalınlığa göre liste ve teslim fiyatı hesabı.',
    )
    // Kısaltılırsa da koşul ve iki fiyat ilk ~155 karakterde kalır.
    expect(d.indexOf('KDV hariç')).toBeLessThan(d.indexOf('₺'))
    expect(d.indexOf('’den başlar')).toBeLessThan(155)
  })

  it('fiyatsız satır atlanır; tek fiyat ya da hiç fiyat yoksa rakam uydurulmaz', () => {
    expect(homeDescription([row(3, null), row(5, 330), row(15, null)], 'Ekim 2026', 'X')).toContain('5 cm mantolama levhası m² fiyatı 330,00 ₺’den başlar')
    const none = homeDescription([row(3, null)], 'Ekim 2026', 'X')
    expect(none).toContain('kalınlığa göre mantolama levhası m² fiyatları')
    expect(none).not.toMatch(/₺/)
  })
})

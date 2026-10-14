import { describe, expect, it } from 'vitest'

import { buildMinimumOrderRows, formatMinimumM2 } from '@/lib/sales/minimumOrder'

// En az sipariş = 1 tam kamyon (Emrah kararı, 14 Ekim 2026). İletişim sayfasındaki tablo
// logistics_capacity'den gelir; kalınlık orada MİLİMETRE tutulur (5 cm → 50).
describe('en az sipariş tablosu', () => {
  const capacities = [
    { thickness: 40, lorry_capacity_m2: 1008 },
    { thickness: 50, lorry_capacity_m2: 806.4 },
    { thickness: 80, lorry_capacity_m2: 504 },
    { thickness: 100, lorry_capacity_m2: 403.2 },
    { thickness: 120, lorry_capacity_m2: 336 },
    { thickness: 150, lorry_capacity_m2: 268.8 },
  ]

  it('yaygın kalınlıkları milimetre kaydından cm satırına çevirir', () => {
    expect(buildMinimumOrderRows(capacities)).toEqual([
      { thicknessCm: 5, minimumM2: 806.4 },
      { thicknessCm: 8, minimumM2: 504 },
      { thicknessCm: 10, minimumM2: 403.2 },
      { thicknessCm: 12, minimumM2: 336 },
      { thicknessCm: 15, minimumM2: 268.8 },
    ])
  })

  it('kapasitesi olmayan ya da sıfır olan kalınlığı atlar', () => {
    expect(buildMinimumOrderRows([{ thickness: 50, lorry_capacity_m2: 0 }, { thickness: 100, lorry_capacity_m2: null }])).toEqual([])
    expect(buildMinimumOrderRows([])).toEqual([])
  })

  it('metrajı tam sayı ve Türkçe binlik ayırıcıyla yazar', () => {
    expect(formatMinimumM2(806.4)).toBe('806')
    expect(formatMinimumM2(1497.6)).toBe('1.498')
  })
})

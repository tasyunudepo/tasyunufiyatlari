import { describe, expect, it } from 'vitest'

import { computeFullTruckPlateUnitPrice } from '@/lib/pricing/plateUnitPrice'

describe('Tam araç levha m² fiyat formülü', () => {
  it('KDV dahil paket fiyatını m² satışa çevirir', () => {
    // 1.800 TL/paket KDV dahil, 3,6 m²/paket → 416,67 liste
    // %10 TIR isk × %8 İSK2 × %5 marj → 416,67×0,9×0,92×1,05 = 362,25
    expect(
      computeFullTruckPlateUnitPrice({
        basePrice: 1800,
        isKdvIncluded: true,
        packageM2: 3.6,
        discount1Pct: 10,
        discount2Pct: 8,
        marginPct: 5,
      }),
    ).toBeCloseTo(362.25, 2)
  })

  it('KDV hariç girdide /1,20 uygulamaz', () => {
    expect(
      computeFullTruckPlateUnitPrice({
        basePrice: 500,
        isKdvIncluded: false,
        packageM2: 1,
        discount1Pct: 0,
        discount2Pct: 0,
        marginPct: 0,
      }),
    ).toBe(500)
  })

  it('eksik/geçersiz girdide fiyat uydurmaz (fail-closed)', () => {
    const base = {
      basePrice: 1800, isKdvIncluded: true, packageM2: 3.6,
      discount1Pct: 10, discount2Pct: 8, marginPct: 5 as number | null,
    }
    expect(computeFullTruckPlateUnitPrice({ ...base, basePrice: 0 })).toBeNull()
    expect(computeFullTruckPlateUnitPrice({ ...base, packageM2: 0 })).toBeNull()
    expect(computeFullTruckPlateUnitPrice({ ...base, marginPct: null })).toBeNull()
    expect(computeFullTruckPlateUnitPrice({ ...base, discount1Pct: 100 })).toBeNull()
    expect(computeFullTruckPlateUnitPrice({ ...base, discount2Pct: NaN })).toBeNull()
  })
})

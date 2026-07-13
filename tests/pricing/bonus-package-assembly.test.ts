import { describe, expect, it } from 'vitest'

import { buildBonusPlateOrder } from '@/lib/pricing/bonus/packageAssembly'

// Çifte marj kilidi: sunucunun marjlı satış fiyatı istemcide DEĞİŞMEDEN
// kaleme döner. Emrah kuralı (13 Temmuz 2026): toz grubu marjı zaten
// %5'e indirildi; Bonus akışı üzerine ikinci bir marj bindiremez.

describe('Bonus levha kalemi montajı', () => {
  it('sunucu fiyatı birim fiyata AYNEN geçer (marj/iskonto uygulanmaz)', () => {
    const order = buildBonusPlateOrder(
      { salePricePerM2: 370.03, packageM2: 2.88 },
      1774.1,
    )
    expect(order).not.toBeNull()
    expect(order!.unitPricePerM2).toBe(370.03)
  })

  it('F 150 tam TIR: 1.774,1 m² pakete oturur → 616 paket, 1.774,08 m²', () => {
    // Üretici TIR değeri 616 × 2,88 = 1.774,08'in yuvarlanmışıdır;
    // 617. paket (araca sığmayan taşma) üretilmemelidir.
    const order = buildBonusPlateOrder(
      { salePricePerM2: 370.03, packageM2: 2.88 },
      1774.1,
    )
    expect(order).toEqual({
      packageCount: 616,
      orderM2: 1774.08,
      unitPricePerM2: 370.03,
      totalExVat: 656462.82,
    })
  })

  it('metraj paket katına yukarı yuvarlanır', () => {
    const order = buildBonusPlateOrder(
      { salePricePerM2: 100, packageM2: 2.88 },
      10,
    )
    expect(order).toEqual({
      packageCount: 4,
      orderM2: 11.52,
      unitPricePerM2: 100,
      totalExVat: 1152,
    })
  })

  it('geçersiz girdide fiyat uydurmaz (fail-closed)', () => {
    expect(buildBonusPlateOrder({ salePricePerM2: 0, packageM2: 2.88 }, 100)).toBeNull()
    expect(buildBonusPlateOrder({ salePricePerM2: 370.03, packageM2: 0 }, 100)).toBeNull()
    expect(buildBonusPlateOrder({ salePricePerM2: 370.03, packageM2: 2.88 }, 0)).toBeNull()
    expect(buildBonusPlateOrder({ salePricePerM2: NaN, packageM2: 2.88 }, 100)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import {
  buildBonusPlateOrder,
  buildBonusVehiclePlans,
  findNearestLowerBonusVehiclePlan,
} from '@/lib/pricing/bonus/packageAssembly'

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

// ─── Tam araç planı (karar: Emrah, 20 Temmuz 2026) ───────────────
// Formül: metraj kamyona sığıyorsa 1 Kamyon; değilse tam TIR'lara böl,
// kalan kamyona sığıyorsa "N TIR + 1 Kamyon", sığmıyorsa +1 TIR.
// Varsayılan (ilk plan) her zaman yukarı tam-TIR yuvarlamasıdır.

describe('Bonus tam araç planı', () => {
  // Gold Plus 50 · 6 cm gerçek kapasiteleri: kamyon 725,8 / TIR 1.330,6
  const KAMYON = 725.8
  const TIR = 1330.6

  it('14.500 m²: kalan 1.194 kamyona sığmaz → tek plan 11 TIR', () => {
    const plans = buildBonusVehiclePlans(14500, KAMYON, TIR)
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({ tir: 11, kamyon: 0, label: '11 TIR', vehicleType: 'truck' })
    expect(plans[0].planM2).toBeCloseTo(14636.6, 1)
  })

  it('14.000 m²: kalan 694 kamyona sığar → varsayılan 11 TIR, alternatif 10 TIR + 1 Kamyon', () => {
    const plans = buildBonusVehiclePlans(14000, KAMYON, TIR)
    expect(plans.map((p) => p.label)).toEqual(['11 TIR', '10 TIR + 1 Kamyon'])
    expect(plans[1]).toMatchObject({ tir: 10, kamyon: 1, vehicleType: null })
    expect(plans[1].planM2).toBeCloseTo(14031.8, 1)
  })

  it('kamyon-altı metraj: 1 Kamyon varsayılan, 1 TIR alternatif', () => {
    const plans = buildBonusVehiclePlans(500, KAMYON, TIR)
    expect(plans.map((p) => p.label)).toEqual(['1 Kamyon', '1 TIR'])
    expect(plans[0].vehicleType).toBe('lorry')
  })

  it('tam TIR katı metraj tek plana düşer', () => {
    const plans = buildBonusVehiclePlans(2661.2, KAMYON, TIR)
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({ tir: 2, kamyon: 0, label: '2 TIR' })
  })

  it('geçersiz girişte boş liste (fail-closed)', () => {
    expect(buildBonusVehiclePlans(0, KAMYON, TIR)).toEqual([])
    expect(buildBonusVehiclePlans(100, 0, TIR)).toEqual([])
  })

  it('kamyonu az aşan ihtiyaçta kamyonu geçerli plan yapmadan yakın alt seçenek olarak verir', () => {
    const lowerPlan = findNearestLowerBonusVehiclePlan(1050, 950.4, 1742.4)

    expect(lowerPlan).toEqual({
      plan: {
        tir: 0,
        kamyon: 1,
        planM2: 950.4,
        label: '1 Kamyon',
        vehicleType: 'lorry',
      },
      shortfallM2: 99.6,
    })
    expect(buildBonusVehiclePlans(1050, 950.4, 1742.4).map((plan) => plan.label)).toEqual([
      '1 TIR',
    ])
  })

  it('ihtiyacı tam karşılayan araç varken gereksiz alt seçenek üretmez', () => {
    expect(findNearestLowerBonusVehiclePlan(950.4, 950.4, 1742.4)).toBeNull()
    expect(findNearestLowerBonusVehiclePlan(1742.4, 950.4, 1742.4)).toBeNull()
  })

  it('yüksek metrajda kurala uygun en yakın alt TIR + Kamyon birleşimini bulur', () => {
    const lowerPlan = findNearestLowerBonusVehiclePlan(2800, 950.4, 1742.4)

    expect(lowerPlan).toEqual({
      plan: {
        tir: 1,
        kamyon: 1,
        planM2: 2692.8,
        label: '1 TIR + 1 Kamyon',
        vehicleType: null,
      },
      shortfallM2: 107.2,
    })
  })
})

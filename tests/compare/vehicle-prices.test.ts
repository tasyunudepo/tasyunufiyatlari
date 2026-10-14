import { describe, expect, it } from 'vitest'

import { applyMargin, resolveMarginPctStrict, type MarginRuleInput } from '@/lib/pricing/margin'
import { bonusVehiclePrices, plateVehiclePrices } from '@/lib/compare/vehiclePrices'

// Karşılaştırmadaki 1 kamyon / 1 TIR fiyatı ürün sayfasının (ProductPricePanel calcPrice) formülüyle aynı
// olmalı: liste / paket m² → araç iskontosu → ikinci iskonto → o aracın metrajındaki kâr kademesi.
// Oranlar örnektir (gerçek kâr oranları testlere yazılmaz).
const rule: MarginRuleInput = { slug: 'tasyunu', tier1_max_m2: 500, tier1_margin_pct: 12, tier2_max_m2: 900, tier2_margin_pct: 9, tier3_margin_pct: 7 }
const input = {
  basePrice: 1800,
  isKdvIncluded: false,
  packageM2: 1.8,
  discount2Pct: 8,
  discountKamyonPct: 14,
  discountTirPct: 18,
  lorryPackages: 224,
  truckPackages: 416,
  marginRule: rule,
}
/** ProductPricePanel.calcPrice'ın aynısı. */
const pdpCalc = (isk1: number, area: number) =>
  applyMargin((1800 / 1.8) * (1 - isk1 / 100) * (1 - 8 / 100), resolveMarginPctStrict(rule, area)!)

describe('1 kamyon ve 1 TIR fiyatı', () => {
  it('ürün sayfasının hesabıyla birebir aynı; her araç kendi metrajının kâr kademesini kullanır', () => {
    const p = plateVehiclePrices(input)
    expect(p.kamyon).toEqual({ m2: 403.2, unit: pdpCalc(14, 403.2), total: Math.round(pdpCalc(14, 403.2) * 403.2) })
    expect(p.tir).toEqual({ m2: 748.8, unit: pdpCalc(18, 748.8), total: Math.round(pdpCalc(18, 748.8) * 748.8) })
    expect(p.kamyon!.unit).toBeGreaterThan(p.tir!.unit)
  })

  it('kapasite ya da kâr kuralı yoksa o araç için fiyat üretilmez', () => {
    expect(plateVehiclePrices({ ...input, lorryPackages: null }).kamyon).toBeNull()
    expect(plateVehiclePrices({ ...input, marginRule: null })).toEqual({ kamyon: null, tir: null })
  })

  it('Bonus: tek bölge fiyatı, kendi kamyon ve TIR metrajı; metraj ve tutar ürün sayfasıyla aynı (paket katı, kuruşa)', () => {
    // 14 Ekim 2026: önce kayıttaki 967,7 m² 0,1'e yuvarlanıp çarpılıyordu (F 150 5 cm: tablo 358.078 ₺,
    // ürün sayfası 336 paket × 2,88 m² = 967,68 m² → 358.070,63 ₺).
    expect(bonusVehiclePrices(370.03, 2.88, 967.7, null).kamyon).toEqual({ m2: 967.68, unit: 370.03, total: 358070.63 })
    expect(bonusVehiclePrices(603.98, 1.44, 483.84, 887.04)).toEqual({
      kamyon: { m2: 483.84, unit: 603.98, total: 292229.68 },
      tir: { m2: 887.04, unit: 603.98, total: 535754.42 },
    })
    expect(bonusVehiclePrices(603.98, 1.44, null, 887).kamyon).toBeNull()
  })
})

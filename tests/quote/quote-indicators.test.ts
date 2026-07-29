import { describe, it, expect } from 'vitest'

import {
  computeQuoteIndicators,
  impliedMarginPct,
  packageSurplusValue,
  unitPriceAtMargin,
  type IndicatorLine,
} from '@/lib/quote/quoteIndicators'

// Göstergeler, 27 Temmuz 2026'da elle hesaplamak zorunda kaldığımız
// sayıları üretmek zorunda. Referans: TE-2026-000140 (Mahmut Balcı),
// Bonus F 150 Pro 4 cm + TEKNO toz grubu, 6.652,8 m², %3 marj.

const ALAN = 6652.8

/** Net alış = liste × 0,60 × 0,95 (İSK1 %40, İSK2 %5), KDV hariç. */
const net = (liste: number) => liste * 0.6 * 0.95

const TOZ_SETI: IndicatorLine[] = [
  { quantity: 1597, unitPrice: 145.11, netCost: net(247.17), listUnitPrice: 145.11, consumptionRate: 6, unitContent: 25 },
  { quantity: 1597, unitPrice: 159.96, netCost: net(272.45), listUnitPrice: 159.96, consumptionRate: 6, unitContent: 25 },
  { quantity: 80, unitPrice: 1466.28, netCost: net(2497.5), listUnitPrice: 1466.28, consumptionRate: 6, unitContent: 500 },
  { quantity: 147, unitPrice: 986.33, netCost: net(1680), listUnitPrice: 986.33, consumptionRate: 1.1, unitContent: 50 },
  { quantity: 27, unitPrice: 1265.93, netCost: net(2156.25), listUnitPrice: 1265.93, consumptionRate: 0.5, unitContent: 125 },
  { quantity: 54, unitPrice: 935.03, netCost: net(1592.63), listUnitPrice: 935.03, consumptionRate: 0.2, unitContent: 25 },
  { quantity: 666, unitPrice: 201.18, netCost: net(342.67), listUnitPrice: 201.18, consumptionRate: 2.5, unitContent: 25 },
]

describe('marj kadranı', () => {
  it('maliyetten hedef marja göre birim fiyat üretir', () => {
    const satir: IndicatorLine = { quantity: 1, unitPrice: 0, netCost: net(247.17) }
    // 247,17 × 0,57 = 140,8869 → %3 marj → 145,11 (TY7002193 ile aynı)
    expect(unitPriceAtMargin(satir, 3)).toBe(145.11)
    // %5 marj — sistemin bugünkü değeri
    expect(unitPriceAtMargin(satir, 5)).toBe(147.93)
  })

  it('maliyeti bilinmeyen satırı DEĞİŞTİRMEZ — uydurma maliyetten fiyat türetmez', () => {
    expect(unitPriceAtMargin({ quantity: 1, unitPrice: 500 }, 10)).toBeNull()
    expect(unitPriceAtMargin({ quantity: 1, unitPrice: 500, netCost: 0 }, 10)).toBeNull()
  })

  it('birim fiyatın ima ettiği marjı geri okur', () => {
    const satir: IndicatorLine = { quantity: 1, unitPrice: 145.11, netCost: net(247.17) }
    expect(impliedMarginPct(satir)).toBeCloseTo(3, 2)
  })
})

describe('paket artığı', () => {
  it('6.652,8 m² TEKNO setinde 2.337,85 ₺ artık üretir', () => {
    // 27 Tem 2026'da elle hesaplanan sayı. Görünseydi metraj optimize
    // edilebilirdi — göstergenin var olma sebebi bu.
    // Kalem kalem: 47,60 + 52,47 + 244,00 + 629,67 + 492,19 + 727,08 + 144,85
    expect(packageSurplusValue(TOZ_SETI, ALAN, 0)).toBeCloseTo(2337.85, 1)
  })

  it('metraj büyüdükçe artık da büyür — 7.002 m² daha çok fire verir', () => {
    // Aynı set 7.002 m² için: yuvarlama payı iki katına yakın çıkar.
    const buyuk: IndicatorLine[] = [
      { quantity: 1681, unitPrice: 145.11, consumptionRate: 6, unitContent: 25 },
      { quantity: 1681, unitPrice: 159.96, consumptionRate: 6, unitContent: 25 },
      { quantity: 85, unitPrice: 1466.28, consumptionRate: 6, unitContent: 500 },
      { quantity: 155, unitPrice: 986.33, consumptionRate: 1.1, unitContent: 50 },
      { quantity: 29, unitPrice: 1265.93, consumptionRate: 0.5, unitContent: 125 },
      { quantity: 57, unitPrice: 935.03, consumptionRate: 0.2, unitContent: 25 },
      { quantity: 701, unitPrice: 201.18, consumptionRate: 2.5, unitContent: 25 },
    ]
    expect(packageSurplusValue(buyuk, 7002, 0)).toBeGreaterThan(
      packageSurplusValue(TOZ_SETI, ALAN, 0),
    )
  })

  it('sarfiyatı veya paket içeriği bilinmeyen satırı saymaz', () => {
    const serbest: IndicatorLine[] = [{ quantity: 10, unitPrice: 100 }]
    expect(packageSurplusValue(serbest, ALAN, 0)).toBe(0)
  })

  it('metraj tam bölünüyorsa artık sıfırdır', () => {
    const tam: IndicatorLine[] = [
      { quantity: 4, unitPrice: 100, consumptionRate: 1, unitContent: 25 },
    ]
    expect(packageSurplusValue(tam, 100, 0)).toBe(0)
  })
})

describe('canlı göstergeler', () => {
  const sonuc = computeQuoteIndicators({
    lines: TOZ_SETI,
    discountPct: 0,
    shippingCharge: 0,
    areaM2: ALAN,
  })

  it('gerçekleşen marjı %3 olarak ölçer', () => {
    expect(sonuc.effectiveMarginPct).toBeCloseTo(3, 1)
  })

  it('brüt kâr = net satış − bilinen maliyet', () => {
    expect(sonuc.grossProfit).toBeCloseTo(sonuc.netSales - sonuc.knownCost, 1)
    expect(sonuc.grossProfit).toBeGreaterThan(0)
  })

  it('maliyet kapsamını bildirir — gösterge ne kadar güvenilir', () => {
    expect(sonuc.costCoveragePct).toBeCloseTo(100, 3)
    expect(sonuc.unknownCostLines).toBe(0)
  })

  it('maliyeti bilinmeyen satır varsa kapsamı düşürür ve sayar', () => {
    const karisik = computeQuoteIndicators({
      lines: [...TOZ_SETI, { quantity: 1, unitPrice: 100000 }],
      discountPct: 0,
      shippingCharge: 0,
      areaM2: ALAN,
    })
    expect(karisik.unknownCostLines).toBe(1)
    expect(karisik.costCoveragePct).toBeLessThan(100)
  })

  it('toplu iskonto site fiyatına göre farkı üretir', () => {
    const iskontolu = computeQuoteIndicators({
      lines: TOZ_SETI,
      discountPct: 2,
      shippingCharge: 0,
      areaM2: ALAN,
    })
    // %2 iskonto → net satış düşer, fark pozitif (müşteri lehine)
    expect(iskontolu.siteDiff).toBeGreaterThan(0)
    expect(iskontolu.siteDiffPct).toBeCloseTo(2, 1)
    expect(iskontolu.netSales).toBeLessThan(sonuc.netSales)
  })

  it('iskonto yokken site farkı sıfırdır — uydurma indirim göstermez', () => {
    expect(sonuc.siteDiff).toBe(0)
    expect(sonuc.siteDiffPct).toBe(0)
  })

  it('m² fiyatını KDV hariç ve dahil verir; dahil = hariç × 1,20', () => {
    expect(sonuc.pricePerM2ExVat).toBeGreaterThan(0)
    expect(sonuc.pricePerM2IncVat / sonuc.pricePerM2ExVat).toBeCloseTo(1.2, 3)
  })

  it('nakliye ayrı kalemse m² fiyatına dahil edilir', () => {
    const nakliyeli = computeQuoteIndicators({
      lines: TOZ_SETI,
      discountPct: 0,
      shippingCharge: 50000,
      areaM2: ALAN,
    })
    expect(nakliyeli.pricePerM2ExVat).toBeGreaterThan(sonuc.pricePerM2ExVat)
    // Nakliye kâra girmez — maliyeti bilinmeyen bir kalem değil, ayrı hizmet.
    expect(nakliyeli.grossProfit).toBeCloseTo(sonuc.grossProfit, 1)
  })

  it('boş teklifte sıfır döner, bölme hatası vermez', () => {
    const bos = computeQuoteIndicators({
      lines: [],
      discountPct: 0,
      shippingCharge: 0,
      areaM2: 0,
    })
    expect(bos.netSales).toBe(0)
    expect(bos.pricePerM2ExVat).toBe(0)
    expect(bos.effectiveMarginPct).toBeNull()
  })
})

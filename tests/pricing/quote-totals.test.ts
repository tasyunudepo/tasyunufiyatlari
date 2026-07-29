import { describe, expect, it } from 'vitest'

import { buildQuoteTotals, roundToKurus } from '@/lib/pricing/quoteTotals'
import { lineTotal } from '@/lib/schemas/manualQuote.schema'

// Elle teklif toplam hesabı.
//
// KDV tek kaynaktan gelir (buildQuoteTotals, %20). useQuoteEditor.totalsFor()
// ile birebir aynı hesap burada kurulup kilitleniyor — ekran ve sunucu aynı
// sonucu üretmek zorunda; sunucu 2 kuruştan fazla sapmada kaydı reddediyor.

function totalsFor(linesNet: number, pct: number, shipping: number) {
  const afterDiscount = roundToKurus(linesNet * (1 - pct / 100))
  const discountAmount = roundToKurus(linesNet - afterDiscount)
  const { priceWithoutVat, vatAmount, totalPrice } = buildQuoteTotals(afterDiscount, shipping)
  return { linesNet, discountAmount, priceWithoutVat, vatAmount, totalPrice }
}

describe('teklif satırı tutarı', () => {
  it('satır iskontosu miktar × birim fiyat üzerinden uygulanır', () => {
    expect(lineTotal({ quantity: 150, unitPrice: 300, lineDiscountPct: 5 })).toBe(42750)
  })

  it('satır iskontosu yoksa ham çarpım döner', () => {
    expect(lineTotal({ quantity: 1000, unitPrice: 401.97 })).toBe(401970)
  })

  it('kuruş yuvarlaması yapılır', () => {
    // 3 × 33,333 = 99,999 → 100,00 değil 99,999 → 100 (kuruşa yuvarlama)
    expect(lineTotal({ quantity: 3, unitPrice: 33.333 })).toBe(100)
  })
})

describe('iskonto ve toplam hesabı', () => {
  // Gerçek denemeden alınan sayılar (27 Tem 2026):
  // Bonus F 150 Pro 5cm 1000 m² × 338,11 + Dübel 40 × 1142,78
  const LINES_NET = roundToKurus(1000 * 338.11 + 40 * 1142.78) // 383.821,20

  it('iskonto oranı satır toplamını etkilemez', () => {
    for (const pct of [0, 3, 4, 5]) {
      expect(totalsFor(LINES_NET, pct, 0).linesNet).toBe(LINES_NET)
    }
  })

  it('iskonto arttıkça genel toplam düşer', () => {
    const t0 = totalsFor(LINES_NET, 0, 0).totalPrice
    const t3 = totalsFor(LINES_NET, 3, 0).totalPrice
    const t4 = totalsFor(LINES_NET, 4, 0).totalPrice
    const t5 = totalsFor(LINES_NET, 5, 0).totalPrice

    expect(t3).toBeLessThan(t0)
    expect(t4).toBeLessThan(t3)
    expect(t5).toBeLessThan(t4)
  })

  it('%3 iskonto canlı denemedeki tutarı üretir', () => {
    const t = totalsFor(LINES_NET, 3, 0)
    expect(t.discountAmount).toBe(11514.64)
    expect(t.priceWithoutVat).toBe(372306.56)
    expect(t.vatAmount).toBe(74461.31)
    expect(t.totalPrice).toBe(446767.87)
  })

  it('%0 iskontoda indirim satırı oluşmaz', () => {
    expect(totalsFor(LINES_NET, 0, 0).discountAmount).toBe(0)
  })

  it('KDV her oranda %20 kalır', () => {
    for (const pct of [0, 3, 4, 5, 10]) {
      const t = totalsFor(LINES_NET, pct, 0)
      expect(t.vatAmount).toBeCloseTo(t.priceWithoutVat * 0.2, 2)
      expect(t.totalPrice).toBeCloseTo(t.priceWithoutVat + t.vatAmount, 2)
    }
  })

  it('nakliye iskontodan SONRA eklenir — iskonto nakliyeye uygulanmaz', () => {
    const nakliyesiz = totalsFor(LINES_NET, 10, 0)
    const nakliyeli = totalsFor(LINES_NET, 10, 15000)

    // Nakliye ham olarak matraha girer; %10 iskonto onu azaltmaz.
    expect(nakliyeli.priceWithoutVat - nakliyesiz.priceWithoutVat).toBe(15000)
  })

  it('%100 iskonto toplamı sıfırlar (sınır durumu)', () => {
    const t = totalsFor(LINES_NET, 100, 0)
    expect(t.priceWithoutVat).toBe(0)
    expect(t.totalPrice).toBe(0)
  })

  it('bir puanlık iskonto farkı tutarı beklendiği kadar değiştirir', () => {
    const t3 = totalsFor(LINES_NET, 3, 0)
    const t4 = totalsFor(LINES_NET, 4, 0)
    // %1 fark = satır toplamının %1'i + KDV
    const beklenenFark = roundToKurus(LINES_NET * 0.01 * 1.2)
    expect(Math.abs(t3.totalPrice - t4.totalPrice)).toBeCloseTo(beklenenFark, 1)
  })
})

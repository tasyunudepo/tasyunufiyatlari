import { describe, expect, it } from 'vitest'

import { parseQuotePdfOcr } from '@/lib/recovery/quotePdfOcr'

describe('kayıp teklif PDF OCR ayrıştırıcısı', () => {
  it('müşteri, telefon, sistem ve fiyat özetini çıkarır', () => {
    const parsed = parseQuotePdfOcr(`
      Sayin / Firma Lokasyon / Bolge
      Test Musteri Istanbul / -
      Telefon Segilen Sistem
      05551234567 Dalmacyali SW035 Tasyiinii
      5cm + Toz Grubu Toplam Metraj 806,4 m2
      Ara Toplam 517.282,25
      KDV (%20) 103.456,45
    `)

    expect(parsed).toMatchObject({
      customerName: 'Test Musteri',
      location: 'Istanbul',
      phone: '05551234567',
      totalAreaM2: 806.4,
      subtotal: 517282.25,
      vat: 103456.45,
      grandTotal: 620738.7,
      confidence: 'yüksek',
    })
    expect(parsed.selectedSystem).toContain('Dalmacyali SW035')
  })

  it('eksik alanları kesin veri gibi işaretlemez', () => {
    const parsed = parseQuotePdfOcr('Teklif No: TY1234567')

    expect(parsed.confidence).toBe('düşük')
    expect(parsed.grandTotal).toBeNull()
    expect(parsed.reviewNote).toContain('eksik alanlar')
  })
})

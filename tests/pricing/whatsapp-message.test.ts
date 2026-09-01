import { describe, expect, it } from 'vitest'

import { generateQuoteWhatsAppMessage } from '@/lib/utils/whatsapp'

const baseContext = {
  productName: 'Dalmaçyalı SW035',
  thicknessCm: 5,
  metrajM2: 806.4,
  vehicleLabel: '1 Kamyon dolusu',
  cityName: 'İstanbul',
  pricePerM2: 326.78,
  totalKdvHaric: 263_515,
}

describe('WhatsApp teklif nakliye metni', () => {
  it('tam araçta nakliyeyi fiyata dahil gösterir', () => {
    const message = generateQuoteWhatsAppMessage({
      ...baseContext,
      shippingMessage: 'fiyata dahil',
    })

    expect(message).toContain('Nakliye: fiyata dahil')
    expect(message).toContain('(KDV hariç)')
  })

  it('TEKNO gibi netleşmeyen sevkiyatı dahilmiş gibi göstermez', () => {
    const message = generateQuoteWhatsAppMessage({
      ...baseContext,
      shippingMessage: 'satış görüşmesinde netleşir',
    })

    expect(message).toContain('Nakliye: satış görüşmesinde netleşir')
    expect(message).not.toContain('KDV hariç, nakliye dahil')
  })

  it('komple set siparişinde levha, tier ve alt bölge bağlamını taşır', () => {
    const message = generateQuoteWhatsAppMessage({
      ...baseContext,
      shippingMessage: 'fiyata dahil',
      subRegionName: 'Avrupa Yakası',
      setContext: {
        itemCount: 8,
        plateName: 'Bonus F 150 8 cm Taşyünü',
        tierName: 'Dengeli Sistem',
      },
    })

    expect(message).toContain('8 kalem komple mantolama seti')
    expect(message).toContain('Levha: Bonus F 150 8 cm Taşyünü')
    expect(message).toContain('Sistem: Dengeli Sistem')
    expect(message).toContain('İstanbul / Avrupa Yakası')
  })

  it('Bonus Sipariş Masası bağlamını araç, fiyat, koşul ve referansla taşır', () => {
    const message = generateQuoteWhatsAppMessage({
      productName: 'Bonus Premium F 150 Pro',
      thicknessCm: 5,
      metrajM2: 967.68,
      vehicleLabel: '1 Kamyon',
      cityName: 'İstanbul',
      subRegionName: 'Avrupa Yakası',
      pricePerM2: 348.77,
      totalKdvHaric: 337_497.75,
      shippingMessage: 'tam araç planında fiyata dahil',
      refCode: 'TYWABC12345',
    })

    expect(message).toContain('Bonus Premium F 150 Pro (5 cm)')
    expect(message).toContain('967,7 m² · 1 Kamyon')
    expect(message).toContain('İstanbul / Avrupa Yakası')
    expect(message).toContain('348,77 ₺/m² (KDV hariç)')
    expect(message).toContain('Nakliye: tam araç planında fiyata dahil')
    expect(message).toContain('Ref: TYWABC12345')
  })
})

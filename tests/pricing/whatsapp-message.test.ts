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
})

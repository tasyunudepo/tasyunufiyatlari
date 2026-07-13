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
})

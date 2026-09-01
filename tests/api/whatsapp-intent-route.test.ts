import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regresyon (Sprint 0.1): wizard sonuç ekranı CTA kaynakları
// (wizard_result_summary / wizard_result_card) izin listesinde yoktu;
// en yüksek niyetli sinyal sessizce 400'e düşüyordu.

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  sendNotification: mocks.sendNotification,
}))

import { POST } from '@/app/api/whatsapp-intent/route'

let ipCounter = 0

function request(payload: Record<string, unknown>) {
  // Her istek farklı IP: route'un IP+source rate limit'ine takılmadan
  // senaryolar bağımsız koşar.
  ipCounter += 1
  return new NextRequest('https://www.tasyunufiyatlari.com/api/whatsapp-intent', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `203.0.113.${ipCounter}`,
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/138.0',
    },
    body: JSON.stringify(payload),
  })
}

describe('/api/whatsapp-intent kaynak izin listesi', () => {
  beforeEach(() => {
    mocks.sendNotification.mockReset().mockResolvedValue(undefined)
  })

  it('wizard sonuç paket kartı kaynağını kabul eder ve bildirir', async () => {
    const response = await POST(request({
      source: 'wizard_result_card',
      productName: 'Dengeli Sistem',
      page: '/',
      resultSessionId: 'rs-test-1',
      ctaLocation: 'result_card',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.skipped).toBeUndefined()
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1)
    expect(mocks.sendNotification.mock.calls[0][1].source).toBe('Wizard sonuç paket kartı')
  })

  it('wizard sonuç karar paneli kaynağını kabul eder', async () => {
    const response = await POST(request({ source: 'wizard_result_summary' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1)
  })

  it('fiyat çözülmüş PDP bağlamını kişisel veri olmadan bildirime taşır', async () => {
    const response = await POST(request({
      source: 'product_detail_summary',
      productName: 'Bonus Premium F 150 Pro',
      page: '/urunler/tasyunu-levha/bonus-f-150-pro-tasyunu',
      resultSessionId: 'pdp-test-session',
      ctaLocation: 'product_detail_summary',
      experienceVariant: 'a_whatsapp_first',
      pricedContext: {
        refCode: 'TYWABC12345',
        modelName: 'F 150 Pro',
        thicknessCm: 5,
        cityCode: 34,
        cityName: 'İstanbul',
        subRegionName: 'Avrupa Yakası',
        areaM2: 967.68,
        packageCount: 336,
        vehicleType: 'lorry',
        vehicleLabel: '1 Kamyon',
        pricePerM2: 348.77,
        totalExVat: 337_497.75,
        shippingMode: 'included_in_sale_price',
      },
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      'whatsapp_intent',
      expect.objectContaining({
        source: 'Ürün detay karar özeti',
        refCode: 'TYWABC12345',
        thicknessCm: 5,
        areaM2: 967.68,
        cityName: 'İstanbul',
        totalPrice: 337_497.75,
        vehicleLabel: '1 Kamyon',
        pricePerM2: 348.77,
        shippingMode: 'included_in_sale_price',
      }),
    )
  })

  it('geçersiz fiyat bağlamını bildirime dönüştürmeden reddeder', async () => {
    const response = await POST(request({
      source: 'product_detail_summary',
      experienceVariant: 'a_whatsapp_first',
      pricedContext: {
        refCode: 'gecersiz',
        modelName: 'F 150 Pro',
        thicknessCm: 5,
        cityCode: 99,
        cityName: 'İstanbul',
        areaM2: -10,
        packageCount: 0,
        vehicleType: 'lorry',
        vehicleLabel: '1 Kamyon',
        pricePerM2: 348.77,
        totalExVat: 337_497.75,
        shippingMode: 'included_in_sale_price',
      },
    }))

    expect(response.status).toBe(400)
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('tanımsız kaynağı 400 ile reddeder', async () => {
    const response = await POST(request({ source: 'olmayan_kaynak' }))

    expect(response.status).toBe(400)
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })
})

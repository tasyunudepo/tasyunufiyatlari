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

  it('tanımsız kaynağı 400 ile reddeder', async () => {
    const response = await POST(request({ source: 'olmayan_kaynak' }))

    expect(response.status).toBe(400)
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })
})

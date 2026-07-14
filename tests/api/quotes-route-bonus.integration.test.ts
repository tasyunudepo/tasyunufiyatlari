import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Bonus tam araç doğrulaması: /api/quotes, Bonus tekliflerini genel
// logistics_capacity kaydıyla DEĞİL, üreticinin kendi kapasite verisiyle
// (computeBonusCapacity) doğrular. Regresyon: F 150 / 5 cm / 967,7 m²
// (tam kamyon) teklifi genel kayda göre reddedilip PDF indikten sonra
// "yalnız tam Kamyon..." uyarısı gösteriyordu.

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  sendNotification: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ single: mocks.single }),
      }),
    }),
  }),
}))
vi.mock('@/lib/notifications', () => ({
  sendNotification: mocks.sendNotification,
}))

import { POST } from '@/app/api/quotes/route'

const originalEnv = { ...process.env }

const bonusPayload = {
  customerName: 'Emrah Test',
  customerEmail: '',
  customerPhone: '0532 123 45 67',
  customerCompany: '',
  customerAddress: '',
  submissionType: 'whatsapp_order' as const,
  sourceChannel: 'wizard',
  materialType: 'tasyunu' as const,
  brandId: 99,
  brandName: 'Bonus',
  modelId: null,
  modelName: 'F 150',
  thicknessCm: 5,
  areaM2: 967.7,
  cityCode: '34',
  cityName: 'İstanbul',
  districtCode: null,
  districtName: null,
  packageName: 'Dengeli Sistem',
  packageDescription: 'Bonus levha + Optimix toz grubu',
  plateBrandName: 'Bonus F 150',
  accessoryBrandName: 'Optimix',
  totalPrice: 654_525,
  pricePerM2: 563.65,
  shippingCost: 0,
  discountPercentage: 0,
  priceWithoutVat: 545_438,
  vatAmount: 109_087,
  packageCount: 336,
  packageSizeM2: 2.88,
  itemsPerPackage: 4,
  vehicleType: 'lorry' as const,
  lorryCapacityPackages: 336,
  truckCapacityPackages: 616,
  lorryFillPercentage: 100,
  truckFillPercentage: 54.5,
  packageItems: {},
  quoteCode: 'TYBONUS01',
  kvkkConsent: true,
}

function request(payload: Record<string, unknown>) {
  return new NextRequest('https://www.tasyunufiyatlari.com/api/quotes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': '7a52c1d4-9e83-4b27-a651-2fd0c31b8e55',
      'x-forwarded-for': '203.0.113.42',
    },
    body: JSON.stringify(payload),
  })
}

describe('/api/quotes Bonus tam araç doğrulaması', () => {
  beforeEach(() => {
    process.env.QUOTE_ABUSE_HASH_SECRET =
      'test-only-quote-abuse-secret-at-least-32-bytes'
    process.env.PDF_CAPABILITY_SECRET =
      'test-only-pdf-capability-secret-at-least-32-bytes'
    mocks.rpc.mockReset()
    // Tek from() zinciri: ilk (ve tek) single çağrısı material_types kuralı.
    // Bonus dalında logistics_capacity HİÇ sorgulanmamalıdır; sorgulanırsa
    // ikinci çağrı tanımsız kalır ve test bunu yakalar.
    mocks.single.mockReset().mockResolvedValueOnce({
      data: { min_order_m2: 0, full_vehicle_only: true },
      error: null,
    })
    mocks.sendNotification.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('tam kamyon metrajını (967,7 m²) Bonus kapasitesiyle kabul eder; genel lojistik kaydına bakmaz', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        outcome: 'created',
        quote_id: 501,
        created_at: '2026-07-14T00:00:00Z',
        retry_after_seconds: null,
        limited_by: null,
      }],
      error: null,
    })

    const response = await POST(request(bonusPayload))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    // from().single() yalnız material_types için çağrıldı (1 kez):
    expect(mocks.single).toHaveBeenCalledTimes(1)
  })

  it('tam TIR metrajını (1.774,1 m²) kabul eder', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        outcome: 'created',
        quote_id: 502,
        created_at: '2026-07-14T00:00:00Z',
        retry_after_seconds: null,
        limited_by: null,
      }],
      error: null,
    })

    const response = await POST(request({
      ...bonusPayload,
      areaM2: 1774.1,
      vehicleType: 'truck' as const,
    }))

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('ara metrajı (500 m²) RPC yan etkisi olmadan reddeder', async () => {
    const response = await POST(request({ ...bonusPayload, areaM2: 500 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/tam Kamyon/u)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('kapasitesi bilinmeyen kalınlıkta fail-closed 400 döner', async () => {
    // 14 cm (140 mm) F 150 üretici listesinde yok (…,120,130,150).
    const response = await POST(request({ ...bonusPayload, thicknessCm: 14 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/Bonus araç kapasitesi doğrulanamadı/u)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  materialSingle: vi.fn(),
  logisticsSingle: vi.fn(),
  sendNotification: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: table === 'material_types'
            ? mocks.materialSingle
            : mocks.logisticsSingle,
        }),
      }),
    }),
  }),
}))
vi.mock('@/lib/notifications', () => ({
  sendNotification: mocks.sendNotification,
}))

import { POST } from '@/app/api/quotes/route'

const originalEnv = { ...process.env }

const validPayload = {
  customerName: 'Emrah Test',
  customerEmail: '',
  customerPhone: '0532 123 45 67',
  customerCompany: '',
  customerAddress: '',
  submissionType: 'whatsapp_order' as const,
  sourceChannel: 'wizard',
  materialType: 'eps' as const,
  brandId: 1,
  brandName: 'Dalmaçyalı',
  modelId: 1,
  modelName: 'EPS Levha',
  thicknessCm: 5,
  areaM2: 1200,
  cityCode: '34',
  cityName: 'İstanbul',
  districtCode: null,
  districtName: null,
  packageName: 'EPS Sistem Paketi',
  packageDescription: '',
  plateBrandName: 'Dalmaçyalı',
  accessoryBrandName: 'Dalmaçyalı',
  totalPrice: 120_000,
  pricePerM2: 300,
  shippingCost: 0,
  discountPercentage: 0,
  priceWithoutVat: 100_000,
  vatAmount: 20_000,
  packageCount: 240,
  packageSizeM2: 5,
  itemsPerPackage: 1,
  vehicleType: 'truck' as const,
  lorryCapacityPackages: null,
  truckCapacityPackages: null,
  lorryFillPercentage: null,
  truckFillPercentage: null,
  packageItems: {},
  quoteCode: 'TYTEST001',
  kvkkConsent: true,
}

function request(payload: Record<string, unknown>) {
  return new NextRequest('https://www.tasyunufiyatlari.com/api/quotes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': '3f43a9b2-d620-4f16-b173-8fc4d59eedbe',
      'x-forwarded-for': '203.0.113.24',
    },
    body: JSON.stringify(payload),
  })
}

function localDevelopmentRequest(payload: Record<string, unknown>) {
  return new NextRequest('http://127.0.0.1:3000/api/quotes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': '3f43a9b2-d620-4f16-b173-8fc4d59eedbe',
    },
    body: JSON.stringify(payload),
  })
}

describe('/api/quotes atomik route entegrasyonu', () => {
  beforeEach(() => {
    process.env.QUOTE_ABUSE_HASH_SECRET =
      'test-only-quote-abuse-secret-at-least-32-bytes'
    process.env.PDF_CAPABILITY_SECRET =
      'test-only-pdf-capability-secret-at-least-32-bytes'
    mocks.rpc.mockReset()
    mocks.materialSingle.mockReset().mockResolvedValue({
      data: { min_order_m2: 400, full_vehicle_only: false },
      error: null,
    })
    mocks.logisticsSingle.mockReset().mockResolvedValue({
      data: {
        lorry_capacity_m2: 806.4,
        truck_capacity_m2: 1200,
        package_size_m2: 5,
        lorry_capacity_packages: 161.28,
        truck_capacity_packages: 240,
      },
      error: null,
    })
    mocks.sendNotification.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('KVKK onayı yoksa DB ve bildirim yan etkisi oluşturmadan 400 döner', async () => {
    const response = await POST(request({ ...validPayload, kvkkConsent: false }))

    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('EPS 399,9 m² teklifi RPC yan etkisinden önce reddeder', async () => {
    const response = await POST(request({ ...validPayload, areaM2: 399.9 }))

    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('EPS minimum seti geçse bile tam araç olmayan düşük metrajı RPC öncesinde reddeder', async () => {
    const response = await POST(request({
      ...validPayload,
      areaM2: 500,
      vehicleType: 'none',
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/tam kamyon veya TIR/u)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('kamyon kapasitesini geçse bile tam araç kombinasyonu olmayan EPS metrajını reddeder', async () => {
    const response = await POST(request({
      ...validPayload,
      areaM2: 1000,
      vehicleType: 'none',
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/tam kamyon, tam TIR/u)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('created sonucunda hashli guard girdileriyle tek RPC ve tek bildirim yapar', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        outcome: 'created',
        quote_id: 42,
        created_at: '2026-07-13T00:00:00.000Z',
        retry_after_seconds: null,
        limited_by: null,
      }],
      error: null,
    })

    const response = await POST(request(validPayload))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, quoteId: 42, outcome: 'created' })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    const [, rpcArgs] = mocks.rpc.mock.calls[0]
    expect(rpcArgs.p_idempotency_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rpcArgs.p_request_fingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(rpcArgs.p_phone_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rpcArgs.p_ip_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rpcArgs.p_quote_payload).not.toHaveProperty('consent_ip')
    expect(rpcArgs.p_quote_payload).toMatchObject({
      consent_version: 'kvkk-teklif-v1',
      consent_purpose: 'fiyat_teklifi_ve_iletisim',
      consent_channel: 'wizard',
    })
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1)
  })

  it('yerel development isteğini proxy IP başlığı ve production secret olmadan çalıştırır', async () => {
    delete process.env.QUOTE_ABUSE_HASH_SECRET
    vi.stubEnv('NODE_ENV', 'development')
    mocks.rpc.mockResolvedValue({
      data: [{
        outcome: 'created',
        quote_id: 43,
        created_at: '2026-08-22T00:00:00.000Z',
        retry_after_seconds: null,
        limited_by: null,
      }],
      error: null,
    })

    try {
      const response = await POST(localDevelopmentRequest(validPayload))
      expect(response.status).toBe(200)
      expect(mocks.rpc).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('yerel development PDF teklifini production secret olmadan kaydedip upload capability döner', async () => {
    delete process.env.QUOTE_ABUSE_HASH_SECRET
    delete process.env.PDF_CAPABILITY_SECRET
    vi.stubEnv('NODE_ENV', 'development')
    mocks.rpc.mockResolvedValue({
      data: [{
        outcome: 'created',
        quote_id: 44,
        created_at: '2026-08-22T00:00:00.000Z',
        retry_after_seconds: null,
        limited_by: null,
      }],
      error: null,
    })

    try {
      const response = await POST(localDevelopmentRequest({
        ...validPayload,
        submissionType: 'pdf_quote',
      }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toMatchObject({ ok: true, quoteId: 44 })
      expect(body.pdfUploadCapability).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
      expect(mocks.rpc).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('10 eşzamanlı tekrarın yalnız created sonucunda tek bildirim üretmesine izin verir', async () => {
    let rpcCall = 0
    mocks.rpc.mockImplementation(async () => {
      rpcCall += 1
      return {
        data: [{
          outcome: rpcCall === 1 ? 'created' : 'replayed',
          quote_id: 42,
          created_at: '2026-07-13T00:00:00.000Z',
          retry_after_seconds: null,
          limited_by: null,
        }],
        error: null,
      }
    })

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => POST(request(validPayload))),
    )

    expect(responses.every((response) => response.status === 200)).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledTimes(10)
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1)
  })

  it.each(['replayed', 'deduplicated'] as const)(
    '%s sonucunda tekrar bildirim göndermez',
    async (outcome) => {
      mocks.rpc.mockResolvedValue({
        data: [{
          outcome,
          quote_id: 42,
          created_at: '2026-07-13T00:00:00.000Z',
          retry_after_seconds: null,
          limited_by: null,
        }],
        error: null,
      })

      const response = await POST(request(validPayload))

      expect(response.status).toBe(200)
      expect(mocks.sendNotification).not.toHaveBeenCalled()
    },
  )

  it('rate limit sonucunda 429 ve Retry-After döner', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        outcome: 'rate_limited',
        quote_id: null,
        created_at: null,
        retry_after_seconds: 417,
        limited_by: 'phone',
      }],
      error: null,
    })

    const response = await POST(request(validPayload))

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('417')
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('PDF teklifi için kayda bağlı upload capability döner', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        outcome: 'created',
        quote_id: 99,
        created_at: '2026-07-13T00:00:00.000Z',
        retry_after_seconds: null,
        limited_by: null,
      }],
      error: null,
    })

    const response = await POST(request({
      ...validPayload,
      submissionType: 'pdf_quote',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.pdfUploadCapability).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(body.pdfUploadCapabilityExpiresAt).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    )
  })
})

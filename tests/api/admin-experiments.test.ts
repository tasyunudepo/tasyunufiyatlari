import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 4A — deney defteri API'si: auth zorunlu (mevcut bazı admin
// route'larının aksine bilinçli olarak kapılı doğar), sözleşme alanları
// snake_case'e eşlenir, kapanış kararı sözlük dışına çıkamaz.

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        order: async () => ({ data: [], error: null }),
      }),
      insert: (payload: Record<string, unknown>) => {
        mocks.insert(payload)
        return {
          select: () => ({ single: async () => ({ data: { id: 9, ...payload }, error: null }) }),
        }
      },
      update: (payload: Record<string, unknown>) => {
        mocks.update(payload)
        return {
          eq: () => ({
            select: () => ({ single: async () => ({ data: { id: 9, ...payload }, error: null }) }),
          }),
        }
      },
    }),
  }),
}))

import { GET, POST } from '@/app/api/admin/experiments/route'
import { PATCH } from '@/app/api/admin/experiments/[id]/route'

const originalEnv = { ...process.env }
const AUTH = 'Basic ' + Buffer.from('admin:test-sifre-1234').toString('base64')

function request(method: string, payload?: Record<string, unknown>, withAuth = true) {
  return new NextRequest('https://www.tasyunufiyatlari.com/api/admin/experiments', {
    method,
    headers: {
      'content-type': 'application/json',
      ...(withAuth ? { authorization: AUTH } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  })
}

const validExperiment = {
  name: 'Test deneyi',
  hypothesis: 'X yaparsak Y artar; çünkü Z.',
  surface: 'wizard sonucu',
  primaryMetric: 'nitelikli teklif oranı',
  startedAt: '2026-07-15',
}

describe('admin experiments API', () => {
  beforeEach(() => {
    process.env.ADMIN_USER = 'admin'
    process.env.ADMIN_PASSWORD = 'test-sifre-1234'
    mocks.insert.mockReset()
    mocks.update.mockReset()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('auth olmadan okuma/yazma reddedilir', async () => {
    expect((await GET(request('GET', undefined, false))).status).toBe(401)
    expect((await POST(request('POST', validExperiment, false))).status).toBe(401)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('sözleşme alanlarını snake_case ile kaydeder', async () => {
    const res = await POST(request('POST', {
      ...validExperiment,
      targetVisitor: 'araştırmacı müşteri',
      guardrails: 'brüt kâr korunur',
    }))
    expect(res.status).toBe(200)
    const payload = mocks.insert.mock.calls[0][0]
    expect(payload.primary_metric).toBe('nitelikli teklif oranı')
    expect(payload.target_visitor).toBe('araştırmacı müşteri')
    expect(payload.started_at).toBe('2026-07-15')
  })

  it('eksik sözleşme alanını 400 ile reddeder', async () => {
    const { name: _name, ...eksik } = validExperiment
    expect((await POST(request('POST', eksik))).status).toBe(400)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('kapanışı karar + sonuç özetiyle yazar; sözlük dışı kararı reddeder', async () => {
    const params = { params: Promise.resolve({ id: '9' }) }
    const ok = await PATCH(
      request('PATCH', {
        status: 'tamamlandi',
        decision: 'veri_yetersiz',
        resultSummary: 'örneklem küçük',
        endedAt: '2026-07-20',
      }),
      params,
    )
    expect(ok.status).toBe(200)
    const payload = mocks.update.mock.calls[0][0]
    expect(payload.decision).toBe('veri_yetersiz')
    expect(payload.result_summary).toBe('örneklem küçük')
    expect(payload.ended_at).toBe('2026-07-20')

    const bad = await PATCH(request('PATCH', { decision: 'kazandik_gibi' }), params)
    expect(bad.status).toBe(400)
  })
})

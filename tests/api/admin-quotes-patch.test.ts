import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 3 — admin PATCH satış sonucu alanları: camelCase → snake_case
// eşlemesi ve durum sözlüğü. completed=KAZANILDI, rejected=KAYBEDİLDİ.

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        mocks.update(payload)
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({ data: { id: 1, ...payload }, error: null }),
            }),
          }),
        }
      },
    }),
  }),
}))

import { PATCH } from '@/app/api/admin/quotes/[id]/route'

function request(payload: Record<string, unknown>) {
  return new NextRequest('https://www.tasyunufiyatlari.com/api/admin/quotes/1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

const params = { params: Promise.resolve({ id: '1' }) }

describe('admin quotes PATCH — satış sonucu alanları', () => {
  beforeEach(() => {
    mocks.update.mockReset()
  })

  it('kaybedildi kapanışını snake_case alanlara eşler', async () => {
    const res = await PATCH(
      request({ status: 'rejected', lossCategory: 'fiyat', lossReason: 'rakip daha uygun verdi' }),
      params,
    )
    expect(res.status).toBe(200)
    const payload = mocks.update.mock.calls[0][0]
    expect(payload.status).toBe('rejected')
    expect(payload.loss_category).toBe('fiyat')
    expect(payload.loss_reason).toBe('rakip daha uygun verdi')
  })

  it('kazanıldı kapanışında brüt kâr ve satış fiyatını yazar', async () => {
    await PATCH(
      request({ status: 'completed', grossProfit: 42_000, salesFinalPrice: 610_000 }),
      params,
    )
    const payload = mocks.update.mock.calls[0][0]
    expect(payload.status).toBe('completed')
    expect(payload.gross_profit).toBe(42_000)
    expect(payload.sales_final_price).toBe(610_000)
  })

  it('temas ve takip alanlarını kabul eder', async () => {
    await PATCH(
      request({
        contactAttemptedAt: '2026-07-14T10:00:00.000Z',
        contactSuccessful: true,
        followUpDate: '2026-07-20',
        quotedBy: 'Emrah',
        adminNotes: 'yarın tekrar aranacak',
      }),
      params,
    )
    const payload = mocks.update.mock.calls[0][0]
    expect(payload.contact_attempted_at).toBe('2026-07-14T10:00:00.000Z')
    expect(payload.contact_successful).toBe(true)
    expect(payload.follow_up_date).toBe('2026-07-20')
    expect(payload.quoted_by).toBe('Emrah')
    expect(payload.admin_notes).toBe('yarın tekrar aranacak')
  })

  it('sözlük dışı durum ve kategoriyi reddeder', async () => {
    expect((await PATCH(request({ status: 'kazandik' }), params)).status).toBe(400)
    expect((await PATCH(request({ lossCategory: 'moral' }), params)).status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

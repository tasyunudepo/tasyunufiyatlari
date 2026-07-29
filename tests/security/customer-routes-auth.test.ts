import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// v24 müşteri kütüğü tam PII taşır (ad, telefon, e-posta, adres) ve teklif
// geçmişini birleştirir. Audit S1: /api/admin/quotes'ta handler seviyesinde
// okuma kapısı YOKTU — yalnız proxy koruyordu. Yeni yüzeyde bu açık baştan
// kapalı doğsun diye okuma uçları da requireOfficeReadAuth kullanıyor.
//
// Bu test her ucun DB'ye dokunmadan ÖNCE kapıyı çaldığını kilitler.

const mocks = vi.hoisted(() => ({
  requireAdminMutationAuth: vi.fn(),
  requireOfficeReadAuth: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/security/adminMutationAuth', () => ({
  requireAdminMutationAuth: mocks.requireAdminMutationAuth,
  requireOfficeReadAuth: mocks.requireOfficeReadAuth,
}))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}))
vi.mock('server-only', () => ({}))

import { GET as customersGet, POST as customersPost } from '@/app/api/admin/customers/route'
import { GET as customerGet, PATCH as customerPatch } from '@/app/api/admin/customers/[id]/route'
import {
  GET as interactionsGet,
  POST as interactionsPost,
} from '@/app/api/admin/customers/[id]/interactions/route'

const params = { params: Promise.resolve({ id: '1' }) }

function denied(status: number) {
  return {
    ok: false as const,
    response: NextResponse.json({ ok: false, error: 'Yetkisiz.' }, { status }),
  }
}

function req(method: string, url = 'https://www.tasyunufiyatlari.com/api/admin/customers') {
  return new NextRequest(url, {
    method,
    ...(method === 'POST' || method === 'PATCH'
      ? { body: JSON.stringify({}), headers: { 'content-type': 'application/json' } }
      : {}),
  })
}

describe('müşteri rotalarında handler seviyesinde yetki', () => {
  beforeEach(() => {
    mocks.createServerSupabaseClient.mockReset().mockImplementation(() => {
      throw new Error('Yetkisiz istekte Supabase istemcisi oluşturulmamalı.')
    })
    mocks.requireOfficeReadAuth.mockReset().mockReturnValue(denied(401))
    mocks.requireAdminMutationAuth.mockReset().mockReturnValue(denied(401))
  })

  it.each([
    ['müşteri listesi', () => customersGet(req('GET'))],
    ['müşteri detayı', () => customerGet(req('GET'), params)],
    ['etkileşim listesi', () => interactionsGet(req('GET'), params)],
  ])('%s: kimliksiz okuma DB’ye ulaşmadan 401 alır', async (_ad, call) => {
    const response = await call()

    expect(response.status).toBe(401)
    expect(mocks.requireOfficeReadAuth).toHaveBeenCalledTimes(1)
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it.each([
    ['müşteri oluşturma', () => customersPost(req('POST'))],
    ['müşteri güncelleme', () => customerPatch(req('PATCH'), params)],
    ['görüşme kaydı', () => interactionsPost(req('POST'), params)],
  ])('%s: kimliksiz mutasyon DB’ye ulaşmadan 401 alır', async (_ad, call) => {
    const response = await call()

    expect(response.status).toBe(401)
    expect(mocks.requireAdminMutationAuth).toHaveBeenCalledTimes(1)
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it.each([
    ['müşteri oluşturma', () => customersPost(req('POST'))],
    ['müşteri güncelleme', () => customerPatch(req('PATCH'), params)],
    ['görüşme kaydı', () => interactionsPost(req('POST'), params)],
  ])('%s: patron (403) yazamaz ve DB’ye dokunulmaz', async (_ad, call) => {
    mocks.requireAdminMutationAuth.mockReturnValue(denied(403))

    const response = await call()

    expect(response.status).toBe(403)
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('okuma uçları mutasyon kapısını yanlışlıkla kullanmaz', async () => {
    await customersGet(req('GET'))
    expect(mocks.requireAdminMutationAuth).not.toHaveBeenCalled()
  })

  it('mutasyon uçları salt-okunur kapıyı yanlışlıkla kullanmaz', async () => {
    await customersPost(req('POST'))
    expect(mocks.requireOfficeReadAuth).not.toHaveBeenCalled()
  })
})

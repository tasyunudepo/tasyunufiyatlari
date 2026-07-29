import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Audit S1 (26 Temmuz 2026): /api/admin altındaki OKUMA uçları yalnızca
// proxy.ts ile korunuyordu; handler seviyesinde kapı yoktu. Oysa kardeş
// uçlar (experiments GET, quotes/[id]/pdf GET) requireOfficeReadAuth
// kullanıyordu — tutarsızlık vardı ve matcher'da yapılacak bir düzenleme
// bu uçları sessizce açardı.
//
// Bu uçların döndürdüğü şeyler:
//   quotes              → tam müşteri PII'si (ad, e-posta, telefon, adres)
//   dashboard/combination-metrics → ciro ve marka kırılımı
//   brands              → margin_pct (kâr marjı)
//   material-types      → tier1/2/3_margin_pct (kademe marjları)
//   storage-images      → yayımlanmamış görsel dosya listesi

const mocks = vi.hoisted(() => ({
  requireOfficeReadAuth: vi.fn(),
  requireAdminMutationAuth: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/security/adminMutationAuth', () => ({
  requireOfficeReadAuth: mocks.requireOfficeReadAuth,
  requireAdminMutationAuth: mocks.requireAdminMutationAuth,
}))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}))

import { GET as quotesGet } from '@/app/api/admin/quotes/route'
import { GET as dashboardGet } from '@/app/api/admin/dashboard-metrics/route'
import { GET as combinationGet } from '@/app/api/admin/combination-metrics/route'
import { GET as brandsGet } from '@/app/api/admin/brands/route'
import { GET as materialTypesGet } from '@/app/api/admin/material-types/route'
import { GET as storageImagesGet } from '@/app/api/admin/storage-images/route'

function req(url = 'https://www.tasyunufiyatlari.com/api/admin/test') {
  return new NextRequest(url)
}

describe('admin okuma uçlarında handler seviyesinde yetki (S1)', () => {
  beforeEach(() => {
    mocks.createServerSupabaseClient.mockReset().mockImplementation(() => {
      throw new Error('Yetkisiz istekte Supabase istemcisi oluşturulmamalı.')
    })
    mocks.requireOfficeReadAuth.mockReset().mockReturnValue({
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Yetkisiz.' }, { status: 401 }),
    })
  })

  it.each([
    ['teklifler (müşteri PII)', () => quotesGet(req('https://x.test/api/admin/quotes'))],
    ['panel metrikleri (ciro)', () => dashboardGet(req())],
    ['kombinasyon metrikleri', () => combinationGet(req())],
    ['markalar (margin_pct)', () => brandsGet(req())],
    ['malzeme tipleri (kademe marjları)', () => materialTypesGet(req())],
    ['depo görselleri', () => storageImagesGet(req())],
  ])('%s: kimliksiz istek DB’ye ulaşmadan 401 alır', async (_ad, call) => {
    const response = await call()

    expect(response.status).toBe(401)
    expect(mocks.requireOfficeReadAuth).toHaveBeenCalledTimes(1)
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled()
  })
})

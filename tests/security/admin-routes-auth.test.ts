import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdminMutationAuth: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/security/adminMutationAuth', () => ({
  requireAdminMutationAuth: mocks.requireAdminMutationAuth,
}))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}))

import { POST as importPost } from '@/app/api/import/route'
import { POST as applyPost } from '@/app/api/import/[id]/apply/route'
import { POST as rollbackPost } from '@/app/api/import/[id]/rollback/route'
import { POST as createProductsPost } from '@/app/api/import/[id]/create-new-products/route'
import { POST as bulkInsertPost } from '@/app/api/products/bulk-insert/route'

describe('admin mutasyon rotalarında handler-level auth', () => {
  beforeEach(() => {
    mocks.requireAdminMutationAuth.mockReset().mockReturnValue({
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Yetkilendirme gerekli.' },
        { status: 401 },
      ),
    })
    mocks.createServerSupabaseClient.mockReset().mockImplementation(() => {
      throw new Error('Yetkisiz istekte Supabase istemcisi oluşturulmamalı.')
    })
  })

  it.each([
    ['import', (request: Request) => importPost(request)],
    ['bulk insert', (request: Request) => bulkInsertPost(request)],
    ['import apply', (request: Request) => applyPost(request, { params: Promise.resolve({ id: '1' }) })],
    ['import rollback', (request: Request) => rollbackPost(request, { params: Promise.resolve({ id: '1' }) })],
    ['yeni ürün oluşturma', (request: Request) => createProductsPost(request, { params: Promise.resolve({ id: '1' }) })],
  ])('%s rotası yetkisiz isteği DB erişiminden önce 401 ile keser', async (_name, callRoute) => {
    const response = await callRoute(
      new Request('https://www.tasyunufiyatlari.com/api/test', { method: 'POST' }),
    )

    expect(response.status).toBe(401)
    expect(mocks.requireAdminMutationAuth).toHaveBeenCalledTimes(1)
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled()
  })
})


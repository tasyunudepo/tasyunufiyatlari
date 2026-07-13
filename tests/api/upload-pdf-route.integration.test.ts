import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  selectQuote: vi.fn(),
  attachQuote: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}))

import { POST } from '@/app/api/upload-pdf/route'
import { createPdfCapabilityToken } from '@/lib/security/pdfCapability'

const originalEnv = { ...process.env }
const secret = 'test-only-pdf-route-secret-at-least-32-bytes'

function buildRequest(capability: string, quoteId = '42') {
  const form = new FormData()
  form.append('quoteId', quoteId)
  form.append('capability', capability)
  form.append('file', new Blob(['%PDF-1.7\nTest'], { type: 'application/pdf' }), 'test.pdf')

  return new NextRequest('https://www.tasyunufiyatlari.com/api/upload-pdf', {
    method: 'POST',
    body: form,
  })
}

function validCapability(quoteId = 42) {
  const now = Math.floor(Date.now() / 1000)
  return createPdfCapabilityToken(
    { quoteId, action: 'upload', expiresAt: now + 600 },
    secret,
    now,
  )
}

describe('/api/upload-pdf capability ve overwrite sözleşmesi', () => {
  beforeEach(() => {
    process.env.PDF_CAPABILITY_SECRET = secret
    process.env.QUOTE_PDF_SIGNED_URL_TTL_SECONDS = '900'
    mocks.selectQuote.mockReset()
    mocks.attachQuote.mockReset()
    mocks.upload.mockReset().mockResolvedValue({ error: null })
    mocks.remove.mockReset().mockResolvedValue({ error: null })
    mocks.createSignedUrl.mockReset().mockResolvedValue({
      data: { signedUrl: 'https://example.test/private.pdf' },
      error: null,
    })
    mocks.createServerSupabaseClient.mockReset().mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: mocks.selectQuote }),
        }),
        update: () => ({
          eq: () => ({
            is: () => ({
              select: () => ({ maybeSingle: mocks.attachQuote }),
            }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          upload: mocks.upload,
          remove: mocks.remove,
          createSignedUrl: mocks.createSignedUrl,
        }),
      },
    })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('geçersiz capability isteğini service-role istemcisi oluşturmadan 403 ile keser', async () => {
    const response = await POST(buildRequest('geçersiz-token'))

    expect(response.status).toBe(403)
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('aynı teklif için ikinci yüklemeyi storage yan etkisi olmadan 409 ile reddeder', async () => {
    mocks.selectQuote.mockResolvedValue({
      data: { id: 42, request_type: 'pdf_quote', pdf_storage_path: '42/existing.pdf' },
      error: null,
    })

    const response = await POST(buildRequest(validCapability()))

    expect(response.status).toBe(409)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('geçerli capability ile random private path, upsert false ve 900 saniyelik signed URL üretir', async () => {
    mocks.selectQuote.mockResolvedValue({
      data: { id: 42, request_type: 'pdf_quote', pdf_storage_path: null },
      error: null,
    })
    mocks.attachQuote.mockResolvedValue({ data: { id: 42 }, error: null })

    const response = await POST(buildRequest(validCapability()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      signedUrl: 'https://example.test/private.pdf',
      expiresInSeconds: 900,
    })
    expect(body.storagePath).toMatch(/^42\/[0-9a-f-]{36}\.pdf$/)
    expect(mocks.upload).toHaveBeenCalledWith(
      body.storagePath,
      expect.any(Blob),
      { contentType: 'application/pdf', upsert: false },
    )
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(body.storagePath, 900)
  })
})


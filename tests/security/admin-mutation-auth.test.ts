import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  requireAdminMutationAuth,
  requireOfficeReadAuth,
} from '@/lib/security/adminMutationAuth'

const ORIGINAL_ENV = { ...process.env }

function basicAuthorization(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`
}

function requestWithAuthorization(authorization?: string): Request {
  return new Request('https://www.tasyunufiyatlari.com/api/import', {
    method: 'POST',
    headers: authorization ? { authorization } : undefined,
  })
}

async function expectDenied(
  request: Request,
  expectedStatus: 401 | 403 | 503,
): Promise<void> {
  const result = requireAdminMutationAuth(request)

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('Yetkisiz isteğin geçmemesi gerekiyordu.')

  expect(result.response.status).toBe(expectedStatus)
  const body = await result.response.json()
  const serializedBody = JSON.stringify(body)
  for (const secret of [
    process.env.ADMIN_PASSWORD,
    process.env.PATRON_PASSWORD,
  ]) {
    if (secret) expect(serializedBody).not.toContain(secret)
  }
}

describe('admin mutasyon handler yetkilendirmesi', () => {
  beforeEach(() => {
    process.env.ADMIN_USER = 'yonetici'
    process.env.ADMIN_PASSWORD = 'Admin-Cok-Gizli-123'
    process.env.PATRON_PASSWORD = 'Patron-Salt-Okunur-456'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('Authorization başlığı yoksa 401 döner', async () => {
    await expectDenied(requestWithAuthorization(), 401)
  })

  it.each([
    'Bearer token',
    'Basic geçersiz!!!',
    basicAuthorization('yonetici', 'yanlis-parola'),
    basicAuthorization('baskasi', 'Admin-Cok-Gizli-123'),
  ])('bozuk veya hatalı kimlik bilgisini 401 ile reddeder: %s', async (header) => {
    await expectDenied(requestWithAuthorization(header), 401)
  })

  it('geçerli patron hesabını mutasyonda 403 ile reddeder', async () => {
    await expectDenied(
      requestWithAuthorization(
        basicAuthorization('patron', 'Patron-Salt-Okunur-456'),
      ),
      403,
    )
  })

  it('yalnız doğru admin hesabını geçirir', () => {
    const result = requireAdminMutationAuth(
      requestWithAuthorization(
        basicAuthorization('yonetici', 'Admin-Cok-Gizli-123'),
      ),
    )

    expect(result).toEqual({ ok: true, user: 'yonetici' })
  })

  it('admin parolası yapılandırılmamışsa kapalı kalır', async () => {
    delete process.env.ADMIN_PASSWORD

    await expectDenied(
      requestWithAuthorization(basicAuthorization('yonetici', 'herhangi')),
      503,
    )
  })

  it('hassas ofis okumalarında admin ve patron hesaplarını geçirir', () => {
    const adminResult = requireOfficeReadAuth(
      requestWithAuthorization(
        basicAuthorization('yonetici', 'Admin-Cok-Gizli-123'),
      ),
    )
    const patronResult = requireOfficeReadAuth(
      requestWithAuthorization(
        basicAuthorization('patron', 'Patron-Salt-Okunur-456'),
      ),
    )

    expect(adminResult).toEqual({ ok: true, user: 'yonetici' })
    expect(patronResult).toEqual({ ok: true, user: 'patron' })
  })

  it('hassas ofis okumasında yapılandırma yoksa kapalı kalır', async () => {
    delete process.env.ADMIN_PASSWORD
    delete process.env.PATRON_PASSWORD

    const result = requireOfficeReadAuth(
      requestWithAuthorization(basicAuthorization('yonetici', 'herhangi')),
    )
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Yapılandırmasız okuma geçmemeliydi.')
    expect(result.response.status).toBe(503)
  })
})

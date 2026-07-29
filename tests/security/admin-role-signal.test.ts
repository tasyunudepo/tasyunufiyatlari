import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Audit B1/B3 (26 Temmuz 2026): panel admin ile patronu ayırt edemiyordu.
// /api/admin/me yalnızca kullanıcı ADINI dönüyordu; arayüz patron hesabına da
// silme/durum kontrollerini gösteriyor, tıklanınca API 403 dönüyor ve ekranda
// hiçbir açıklama çıkmıyordu.
//
// Bu test rol SİNYALİNİ kilitler. Rol bir yetki kapısı DEĞİLDİR — asıl kapı
// requireAdminMutationAuth'tur (tests/security/admin-mutation-auth.test.ts).
// Buradaki sözleşme: kimlik doğru role çevrilmeli ve belirsizlikte
// fail-closed davranılmalı.

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}))

import { GET } from '@/app/api/admin/me/route'
import { canMutate } from '@/lib/admin/roles'

const originalEnv = { ...process.env }

function withAuthUser(user: string | null) {
  mocks.headers.mockResolvedValue({
    get: (name: string) => (name === 'x-auth-user' ? user : null),
  })
}

describe('ofis rol sinyali (/api/admin/me)', () => {
  beforeEach(() => {
    mocks.headers.mockReset()
    process.env.ADMIN_USER = 'barbaros'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('admin kullanıcısını admin rolüne çevirir', async () => {
    withAuthUser('barbaros')
    const body = await (await GET()).json()

    expect(body).toEqual({ user: 'barbaros', role: 'admin' })
    expect(canMutate(body.role)).toBe(true)
  })

  it('patron kullanıcısını patron rolüne çevirir ve mutasyona izin vermez', async () => {
    withAuthUser('patron')
    const body = await (await GET()).json()

    expect(body).toEqual({ user: 'patron', role: 'patron' })
    expect(canMutate(body.role)).toBe(false)
  })

  it('ADMIN_USER tanımsızken varsayılan "admin" kimliğini tanır', async () => {
    delete process.env.ADMIN_USER
    withAuthUser('admin')
    const body = await (await GET()).json()

    expect(body.role).toBe('admin')
  })

  it('bilinmeyen kimlikte rol null döner ve mutasyon kapalıdır (fail-closed)', async () => {
    withAuthUser('baskabiri')
    const body = await (await GET()).json()

    expect(body.role).toBeNull()
    expect(canMutate(body.role)).toBe(false)
  })

  it('başlık hiç yoksa rol null döner (fail-closed)', async () => {
    withAuthUser(null)
    const body = await (await GET()).json()

    expect(body).toEqual({ user: '', role: null })
    expect(canMutate(body.role)).toBe(false)
  })

  it('rol yanıtı önbelleğe alınmaz', async () => {
    withAuthUser('patron')
    const response = await GET()

    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

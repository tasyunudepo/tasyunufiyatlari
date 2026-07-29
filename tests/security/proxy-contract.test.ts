import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { proxy } from '@/proxy'

const originalEnv = { ...process.env }

function basic(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`
}

describe('Next proxy güvenlik ve legacy kontratı', () => {
  beforeEach(() => {
    process.env.ADMIN_USER = 'admin'
    process.env.ADMIN_PASSWORD = 'test-admin-password'
    process.env.PATRON_PASSWORD = 'test-patron-password'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it.each(['/ofis', '/api/admin/quotes'])(
    '%s kimlik bilgisi olmadan 401 döner',
    (path) => {
      const response = proxy(
        new NextRequest(`https://www.tasyunufiyatlari.com${path}`),
      )
      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toContain('Basic')
    },
  )

  it('geçerli admin kimliğini korunan route boyunca iletir', () => {
    const response = proxy(
      new NextRequest('https://www.tasyunufiyatlari.com/api/admin/quotes', {
        headers: { authorization: basic('admin', 'test-admin-password') },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  // ── Audit S2 sertleştirmesi (27 Temmuz 2026) ──
  // Eski hâlinde `atob()` doğrudan çağrılıyordu: bozuk base64 gönderen bir
  // istemci istisna fırlatıp 401 yerine 500 aldırıyordu (bilgi sızıntısı ve
  // gürültü). Ayrıca kimlik karşılaştırması `===` ile yapılıyordu; handler
  // katmanı zaten timingSafeEqual kullanıyordu, proxy geride kalmıştı.
  it.each([
    ['bozuk base64', 'Basic !!!!'],
    ['base64 değil', 'Basic ????????'],
    ['iki nokta yok', `Basic ${Buffer.from('kullanicisifresiz', 'utf8').toString('base64')}`],
    ['boş kullanıcı adı', `Basic ${Buffer.from(':sifre', 'utf8').toString('base64')}`],
    ['şema yanlış', 'Bearer abc123'],
    ['boş değer', 'Basic '],
  ])('%s gönderilirse 500 değil 401 döner', (_ad, header) => {
    const response = proxy(
      new NextRequest('https://www.tasyunufiyatlari.com/ofis', {
        headers: { authorization: header },
      }),
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain('Basic')
  })

  it('doğru kullanıcı + yanlış şifre 401 döner', () => {
    const response = proxy(
      new NextRequest('https://www.tasyunufiyatlari.com/ofis', {
        headers: { authorization: basic('admin', 'yanlis-sifre') },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('şifre doğru ama kullanıcı yanlışsa 401 döner', () => {
    const response = proxy(
      new NextRequest('https://www.tasyunufiyatlari.com/ofis', {
        headers: { authorization: basic('baskabiri', 'test-admin-password') },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('patron kimliği geçer ve x-auth-user olarak iletilir', () => {
    const response = proxy(
      new NextRequest('https://www.tasyunufiyatlari.com/ofis', {
        headers: { authorization: basic('patron', 'test-patron-password') },
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('ADMIN_PASSWORD tanımsızken admin girişi imkânsızdır', () => {
    delete process.env.ADMIN_PASSWORD
    const response = proxy(
      new NextRequest('https://www.tasyunufiyatlari.com/ofis', {
        headers: { authorization: basic('admin', '') },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('eski ürün URL\'lerini 410, mağaza URL\'sini kalıcı yönlendirme yapar', () => {
    const goneResponse = proxy(
      new NextRequest('https://www.tasyunufiyatlari.com/urun/eski-urun'),
    )
    const shopResponse = proxy(
      new NextRequest('https://www.tasyunufiyatlari.com/shop'),
    )

    expect(goneResponse.status).toBe(410)
    expect(goneResponse.headers.get('x-robots-tag')).toContain('noindex')
    expect(shopResponse.status).toBe(301)
    expect(shopResponse.headers.get('location')).toBe(
      'https://www.tasyunufiyatlari.com/urunler',
    )
  })

  it('eski depo satış yolunu doğrudan ürün kataloğuna yönlendirir', () => {
    const response = proxy(
      new NextRequest('https://www.tasyunufiyatlari.com/tasyunu-eps-depo'),
    )

    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe(
      'https://www.tasyunufiyatlari.com/urunler',
    )
  })
})

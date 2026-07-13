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

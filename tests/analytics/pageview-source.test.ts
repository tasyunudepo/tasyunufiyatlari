import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildSafePageViewPayload,
  emitDeduplicatedPageView,
  resetPageViewDeduplicationForTests,
} from '@/lib/analytics/pageview'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

describe('GA4 sayfa görüntüleme veri hijyeni', () => {
  beforeEach(() => {
    resetPageViewDeduplicationForTests()
  })

  it('query, hash ve tam href yerine yalnız güvenli pathname gönderir', () => {
    const payload = buildSafePageViewPayload({
      pathname: '/urun/test?phone=05321234567&email=test@example.com#teklif',
      origin: 'https://www.tasyunufiyatlari.com',
      title: 'Test Ürün',
      measurementId: 'G-TEST',
    })

    expect(payload).toEqual({
      page_path: '/urun/test',
      page_location: 'https://www.tasyunufiyatlari.com/urun/test',
      page_title: 'Test Ürün',
      send_to: 'G-TEST',
    })
    expect(JSON.stringify(payload)).not.toContain('05321234567')
    expect(JSON.stringify(payload)).not.toContain('test@example.com')
    expect(JSON.stringify(payload)).not.toContain('#teklif')
  })

  it('aynı pathname için art arda yalnız bir page_view gönderir', () => {
    const gtag = vi.fn()
    const input = {
      gtag,
      pathname: '/urun/test',
      origin: 'https://www.tasyunufiyatlari.com',
      title: 'Test Ürün',
      measurementId: 'G-TEST',
    }

    expect(emitDeduplicatedPageView(input)).toBe(true)
    expect(emitDeduplicatedPageView(input)).toBe(false)
    expect(gtag).toHaveBeenCalledTimes(1)
    expect(gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_path: '/urun/test',
      page_location: 'https://www.tasyunufiyatlari.com/urun/test',
      page_title: 'Test Ürün',
      send_to: 'G-TEST',
    })
  })

  it('pathname değiştirilince yeni page_view gönderir', () => {
    const gtag = vi.fn()
    const base = {
      gtag,
      origin: 'https://www.tasyunufiyatlari.com',
      title: 'Sayfa',
      measurementId: 'G-TEST',
    }

    emitDeduplicatedPageView({ ...base, pathname: '/urun/a' })
    emitDeduplicatedPageView({ ...base, pathname: '/urun/b' })
    emitDeduplicatedPageView({ ...base, pathname: '/urun/a' })

    expect(gtag).toHaveBeenCalledTimes(3)
  })

  it('analitik depolamayı açık, tüm reklam sinyallerini kapalı tutar', () => {
    const source = [
      'components/analytics/GoogleAnalytics.tsx',
      'components/analytics/CookieConsent.tsx',
    ].map((path) => readFileSync(`${repoRoot}${path}`, 'utf8')).join('\n')

    expect(source).toMatch(/analytics_storage:\s*'granted'/)
    expect(source).toMatch(/ad_storage:\s*'denied'/)
    expect(source).toMatch(/ad_user_data:\s*'denied'/)
    expect(source).toMatch(/ad_personalization:\s*'denied'/)
    expect(source).toMatch(/allow_google_signals:\s*false/)
    expect(source).toMatch(/allow_ad_personalization_signals:\s*false/)
    expect(source).not.toMatch(/ad_storage:\s*'granted'/)
    expect(source).not.toMatch(/ad_user_data:\s*'granted'/)
    expect(source).not.toMatch(/ad_personalization:\s*'granted'/)
  })

  it('GA event sözleşmesine müşteri kaydıyla eşleştirilebilen teklif kodunu almaz', () => {
    const source = readFileSync(`${repoRoot}lib/notifyWizardEvent.ts`, 'utf8')

    expect(source).not.toContain('ref_code')
  })
})

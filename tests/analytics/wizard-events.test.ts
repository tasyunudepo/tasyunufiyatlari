import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  notifyComparisonCtaClick,
  notifyComparisonOpened,
  notifyPdfQuoteRequested,
  notifyWhatsappOrderRequested,
} from '@/lib/notifyWizardEvent'

afterEach(() => {
  vi.unstubAllGlobals()
})

const base = {
  material_type: 'tasyunu',
  brand_name: 'Dalmaçyalı',
  model_name: 'SW035',
  thickness_cm: 5,
  city_code: 34,
  city_name: 'İstanbul',
  area_m2: 806.4,
  total_m2: 806.4,
  package_count: 160,
  result_session_id: 'ga-only-session-1',
  selected_package_name: 'Dengeli Sistem',
  selected_package_total: 316_218,
  selected_per_m2: 326.78,
}

describe('Wizard GA4 event allowlist', () => {
  it.each([
    ['PDF', () => notifyPdfQuoteRequested({ ...base, customer_type: 'individual' })],
    ['WhatsApp', () => notifyWhatsappOrderRequested(base)],
  ])('%s eventinde yalnız ticari ölçüm alanlarını gönderir', (_name, notify) => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/urunler/test' },
    })

    notify()

    expect(gtag).toHaveBeenCalledTimes(1)
    const payload = gtag.mock.calls[0][2] as Record<string, unknown>
    expect(payload.page_path).toBe('/urunler/test')
    expect(payload).not.toHaveProperty('ref_code')
    expect(payload).not.toHaveProperty('customer_name')
    expect(payload).not.toHaveProperty('customer_phone')
    expect(payload).not.toHaveProperty('customer_email')
    expect(payload).not.toHaveProperty('customer_address')
    expect(JSON.stringify(payload)).not.toContain('05321234567')
  })

  it('karşılaştırma açılış ve CTA eventlerini aynı anonim oturuma bağlar', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/tasyunu-karsilastir' },
    })

    notifyComparisonOpened({
      surface: 'genel',
      urun_sayisi: 8,
      entry_placement: 'category',
      comparison_session_id: 'cmp_test_1',
    })
    notifyComparisonCtaClick({
      surface: 'genel',
      entry_placement: 'category',
      comparison_session_id: 'cmp_test_1',
      brand_name: 'Bonus',
      model_name: 'F 150',
      city_code: 6,
      thickness_cm: 8,
    })

    expect(gtag).toHaveBeenCalledTimes(2)
    expect(gtag.mock.calls[0][1]).toBe('Karsilastirma_Acildi')
    expect(gtag.mock.calls[1][1]).toBe('Karsilastirma_CTA_Click')
    expect(gtag.mock.calls[0][2]).toMatchObject({
      comparison_session_id: 'cmp_test_1',
      entry_placement: 'category',
    })
    expect(gtag.mock.calls[1][2]).toMatchObject({
      comparison_session_id: 'cmp_test_1',
      model_name: 'F 150',
    })
  })
})

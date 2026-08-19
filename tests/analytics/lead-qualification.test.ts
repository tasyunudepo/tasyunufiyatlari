import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  readSalesIntent,
  saveSalesIntent,
  notifyLeadGateSelection,
  notifyLeadRejected,
  notifyContactUnlocked,
} from '@/lib/analytics/leadQualification'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lead uygunluk GA4 olayları', () => {
  it('satış niyetini sonraki ziyarette de korur', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })

    saveSalesIntent('research_only')
    expect(readSalesIntent()).toBe('research_only')
  })

  it('niyet seçiminde yalnız kategorik alanları gönderir', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/urunler' },
    })

    notifyLeadGateSelection('project_scale')

    expect(gtag).toHaveBeenCalledWith(
      'event',
      'Lead_Gate_Secimi',
      expect.objectContaining({
        intent: 'project_scale',
        page_path: '/urunler',
      }),
    )
  })

  it('ret ve kilit açılma olaylarında kişisel veri taşımaz', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/' },
    })

    notifyLeadRejected('below_full_vehicle', { material_type: 'eps' })
    notifyContactUnlocked({ source: 'quote_success' })

    const payloads = gtag.mock.calls.map((call) => call[2] as Record<string, unknown>)
    expect(payloads).toHaveLength(2)
    expect(payloads[0]).toMatchObject({
      reason: 'below_full_vehicle',
      material_type: 'eps',
    })
    expect(JSON.stringify(payloads)).not.toMatch(/phone|email|customer|0532/iu)
  })
})

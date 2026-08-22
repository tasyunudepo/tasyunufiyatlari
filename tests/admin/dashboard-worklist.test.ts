import { describe, expect, it } from 'vitest'

import {
  dashboardQuoteChannelLabel,
  selectRecentUncontactedQuotes,
} from '@/lib/admin/dashboardQuotes'

describe('genel bakış güncel teklif görünürlüğü', () => {
  it('üst listede en eski kayıtlar yerine en yeni temassız teklifleri gösterir', () => {
    const quotes = [
      { id: 1, created_at: '2026-07-01T09:00:00Z', status: 'quoted', contact_attempted_at: null },
      { id: 2, created_at: '2026-08-21T08:00:00Z', status: 'quoted', contact_attempted_at: null },
      { id: 3, created_at: '2026-08-21T10:00:00Z', status: 'quoted', contact_attempted_at: null },
      { id: 4, created_at: '2026-08-21T11:00:00Z', status: 'completed', contact_attempted_at: null },
      { id: 5, created_at: '2026-08-21T12:00:00Z', status: 'quoted', contact_attempted_at: '2026-08-21T12:05:00Z' },
    ]

    expect(selectRecentUncontactedQuotes(quotes, 2).map((q) => q.id)).toEqual([3, 2])
  })

  it('manuel teklif kanalını WhatsApp diye göstermeyip Ofis olarak etiketler', () => {
    expect(dashboardQuoteChannelLabel('manual_quote')).toBe('Ofis')
    expect(dashboardQuoteChannelLabel('pdf_quote')).toBe('PDF')
    expect(dashboardQuoteChannelLabel('whatsapp_order')).toBe('WhatsApp')
  })
})

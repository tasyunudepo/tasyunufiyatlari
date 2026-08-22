export interface DashboardWorkQuote {
  id: number
  created_at: string
  status: string | null
  contact_attempted_at?: string | null
}

export function isOpenDashboardQuote(quote: DashboardWorkQuote): boolean {
  return !['completed', 'rejected'].includes(quote.status ?? '')
}

/** Genel bakışın üstünde yeni teklifleri görünür tutar. */
export function selectRecentUncontactedQuotes<T extends DashboardWorkQuote>(
  quotes: T[],
  limit = 5,
): T[] {
  return quotes
    .filter((quote) => isOpenDashboardQuote(quote) && !quote.contact_attempted_at)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, limit)
}

export function dashboardQuoteChannelLabel(requestType: string | null): string {
  if (requestType === 'manual_quote') return 'Ofis'
  if (requestType === 'pdf_quote') return 'PDF'
  if (requestType === 'whatsapp_order') return 'WhatsApp'
  return 'Diğer'
}

export type SalesIntent = 'project_scale' | 'research_only'

export type LeadRejectionReason =
  | 'unknown_product'
  | 'unknown_thickness'
  | 'missing_city'
  | 'below_full_vehicle'
  | 'invalid_vehicle_combination'
  | 'quote_reference_required'

export const SALES_INTENT_STORAGE_KEY = 'tasyunu_sales_intent_v1'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-VCHRKVJCEN'

type GtagWindow = Window & {
  gtag?: (
    command: 'event',
    eventName: string,
    eventParams: Record<string, unknown>,
  ) => void
}

function emit(eventName: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  const w = window as GtagWindow
  if (typeof w.gtag !== 'function') return

  w.gtag('event', eventName, {
    ...params,
    page_path: window.location.pathname,
    send_to: GA_MEASUREMENT_ID,
  })
}

export function readSalesIntent(): SalesIntent | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(SALES_INTENT_STORAGE_KEY)
    return value === 'project_scale' || value === 'research_only' ? value : null
  } catch {
    return null
  }
}

export function saveSalesIntent(intent: SalesIntent): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SALES_INTENT_STORAGE_KEY, intent)
  } catch {
    // Depolama kapalıysa kullanıcı akışı yine devam eder.
  }
}

export function notifyLeadGateViewed(): void {
  emit('Lead_Gate_Goruntulendi')
}

export function notifyLeadGateSelection(intent: SalesIntent): void {
  emit('Lead_Gate_Secimi', { intent })
}

export function notifyLeadRejected(
  reason: LeadRejectionReason,
  params: Record<string, unknown> = {},
): void {
  emit('Lead_Uygunluk_Reddedildi', { reason, ...params })
}

export function notifyContactUnlocked(params: Record<string, unknown> = {}): void {
  emit('Iletisim_Kilidi_Acildi', params)
}

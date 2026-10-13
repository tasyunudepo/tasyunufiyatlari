import { PORTFOLIO_OFFERS, type OfferKey, type OfferPlacement } from '@/lib/portfolio/offers'

// Kardeş satış kanalına giden bağlantının görülmesi ve tıklanması.
// Gezinme olayıdır, temas değildir; GCR'de yok sayılanlar listesindedir.

export const PORTFOLIO_OFFER_VIEW = 'portfolio_offer_view'
export const PORTFOLIO_OFFER_CLICK = 'portfolio_offer_click'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-VCHRKVJCEN'

type GtagWindow = Window & {
  gtag?: (
    command: 'event',
    eventName: string,
    eventParams: Record<string, unknown>,
  ) => void
}

export function isOfferKey(value: string | undefined): value is OfferKey {
  return value != null && Object.prototype.hasOwnProperty.call(PORTFOLIO_OFFERS, value)
}

export function buildOfferClickParams(
  offer: OfferKey,
  placement: OfferPlacement,
): { offer: OfferKey; placement: OfferPlacement; target_host: string } {
  return {
    offer,
    placement,
    target_host: new URL(PORTFOLIO_OFFERS[offer].url).hostname,
  }
}

function emit(eventName: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const w = window as GtagWindow
  if (typeof w.gtag !== 'function') return

  w.gtag('event', eventName, {
    ...params,
    page_path: window.location.pathname,
    send_to: GA_MEASUREMENT_ID,
  })
}

export function notifyPortfolioOfferView(placement: OfferPlacement): void {
  emit(PORTFOLIO_OFFER_VIEW, { placement })
}

export function notifyPortfolioOfferClick(offer: OfferKey, placement: OfferPlacement): void {
  emit(PORTFOLIO_OFFER_CLICK, buildOfferClickParams(offer, placement))
}

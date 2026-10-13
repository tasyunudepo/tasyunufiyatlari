import { MATERIAL_OFFER_KEYS, PORTFOLIO_OFFERS, offerHref } from '@/lib/portfolio/offers'

// Teklif PDF'indeki "Alçı ve alçıpan da lazım mı?" bölümünün verisi ve
// resim olarak basılan sayfanın üstüne konan tıklanır alanların hesabı.

export interface PortfolioPdfItem {
  title: string
  priceLine: string
  terms: string
  /** Belgede yazılı görünen adres; basılı kopyada elle girilebilsin. */
  linkLabel: string
  /** Tıklanınca açılan, kaynağı etiketli adres. */
  href: string
  /** Kartta ayrı satırlara basılan parçalar. */
  amount: string
  product: string
  vehicle: string
  priceTerms: string
  listDate: string
  cta: string
}

export function buildPortfolioPdfItems(): PortfolioPdfItem[] {
  return MATERIAL_OFFER_KEYS.map((key) => {
    const offer = PORTFOLIO_OFFERS[key]
    const price = offer.price
    const priceLine = price ? [price.amount, price.vehicle].filter(Boolean).join(' · ') : ''
    const target = new URL(offer.url)

    return {
      title: offer.title,
      priceLine,
      terms: price ? `${price.product} · ${price.terms} · Liste tarihi ${price.listDate}` : '',
      linkLabel: `${target.hostname}${target.pathname.replace(/\/$/u, '')}`,
      href: offerHref(key, 'pdf'),
      amount: price?.amount ?? '',
      product: price?.product ?? '',
      vehicle: price?.vehicle ?? '',
      priceTerms: price?.terms ?? '',
      listDate: price?.listDate ?? '',
      cta: offer.cta,
    }
  })
}

export interface PxRect {
  left: number
  top: number
  width: number
  height: number
}

export interface PdfRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Sayfa resim olarak basıldığı için bağlantılar ayrıca işaretlenir: HTML
 * kabındaki bir öğenin piksel kutusunu PDF'in milimetre koordinatına çevirir.
 */
export function toPdfRect(rect: PxRect, origin: { left: number; top: number }, mmPerPx: number): PdfRect {
  return {
    x: (rect.left - origin.left) * mmPerPx,
    y: (rect.top - origin.top) * mmPerPx,
    w: rect.width * mmPerPx,
    h: rect.height * mmPerPx,
  }
}

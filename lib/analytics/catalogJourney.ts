const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-VCHRKVJCEN'
const CATALOG_JOURNEY_STORAGE_KEY = 'tasyunu_catalog_journey_v1'
const CATALOG_JOURNEY_PATTERN = /^cat_[a-z0-9]+_[a-z0-9]+$/

type GtagWindow = Window & {
  gtag?: (
    command: 'event',
    eventName: string,
    eventParams: Record<string, unknown>,
  ) => void
}

type CategoryCtaType = 'price_calculator' | 'comparison' | 'product_discovery'
type CategoryCtaLocation = 'hero' | 'catalog_header' | 'mobile_sticky' | 'section' | 'product_card'

interface CategoryJourneyBase {
  category_slug: string
  catalog_journey_id: string
}

export interface CategoryCtaPayload extends CategoryJourneyBase {
  cta_type: CategoryCtaType
  cta_location: CategoryCtaLocation
}

export interface CategoryCtaClickPayload extends CategoryCtaPayload {
  section_key: string
}

export interface CategorySectionPayload extends CategoryJourneyBase {
  section_key: string
  section_position: number
  result_count: number
}

export interface CategoryFilterPayload extends CategoryJourneyBase {
  section_key: string
  filter_name: 'brand' | 'thickness' | 'density'
  filter_value: string
  result_count: number
}

export interface CategoryProductPayload extends CategoryJourneyBase {
  product_slug: string
  brand_name: string
  model_name: string | null
  section_key: string
  card_position: number
  price_visibility: string
}

let cachedJourneyId: string | null = null
const viewedCtaKeys = new Set<string>()

function createCatalogJourneyId(): string {
  return `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function readCatalogJourneyId(): string | null {
  if (cachedJourneyId && CATALOG_JOURNEY_PATTERN.test(cachedJourneyId)) {
    return cachedJourneyId
  }
  if (typeof window === 'undefined') return null
  try {
    const stored = window.sessionStorage.getItem(CATALOG_JOURNEY_STORAGE_KEY)
    if (!stored || !CATALOG_JOURNEY_PATTERN.test(stored)) return null
    cachedJourneyId = stored
    return stored
  } catch {
    return null
  }
}

export function getOrCreateCatalogJourneyId(): string {
  const existing = readCatalogJourneyId()
  if (existing) return existing

  const created = createCatalogJourneyId()
  cachedJourneyId = created
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(CATALOG_JOURNEY_STORAGE_KEY, created)
    } catch {
      // Depolama kapalıysa sayfa yaşam döngüsündeki bellek kimliği yeterlidir.
    }
  }
  return created
}

function emit(eventName: string, params: object): void {
  if (typeof window === 'undefined') return
  const w = window as GtagWindow
  if (typeof w.gtag !== 'function') return

  w.gtag('event', eventName, {
    ...params,
    page_path: window.location.pathname,
    send_to: GA_MEASUREMENT_ID,
  })
}

export function notifyCategoryCtaViewed(payload: CategoryCtaPayload): void {
  const dedupeKey = [
    payload.catalog_journey_id,
    payload.cta_type,
    payload.cta_location,
  ].join(':')
  if (viewedCtaKeys.has(dedupeKey)) return
  viewedCtaKeys.add(dedupeKey)
  emit('Kategori_CTA_Goruntulendi', payload)
}

export function notifyCategoryCtaClick(payload: CategoryCtaClickPayload): void {
  emit('Kategori_CTA_Click', payload)
}

export function notifyCategorySectionSelected(payload: CategorySectionPayload): void {
  emit('Kategori_Bolum_Secildi', payload)
}

export function notifyCategoryFilterChanged(payload: CategoryFilterPayload): void {
  emit('Kategori_Filtre_Degisti', payload)
}

export function notifyCategoryProductClick(payload: CategoryProductPayload): void {
  emit('Kategori_Urun_Click', payload)
}

export function resetCatalogJourneyForTests(): void {
  cachedJourneyId = null
  viewedCtaKeys.clear()
}

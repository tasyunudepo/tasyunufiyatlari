import {
  TASYUNU_SECTIONS,
  type TasyunuSectionKey,
} from '@/lib/catalog/sections'

export interface CategoryEntryContext {
  entrySurface: 'category'
  sectionKey: TasyunuSectionKey
  sectionTitle: string
  sectionShortTitle: string
  returnHref: string
  isLegacySectionParam: boolean
}

function toSearchParams(input?: string | URLSearchParams): URLSearchParams | null {
  if (input instanceof URLSearchParams) return input
  if (typeof input === 'string') return new URLSearchParams(input)
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search)
}

export function buildCategoryProductQuery(sectionKey: TasyunuSectionKey): string {
  return new URLSearchParams({
    entry: 'category',
    uygulama: sectionKey,
  }).toString()
}

export function getCategoryEntryContext(
  input?: string | URLSearchParams,
): CategoryEntryContext | null {
  const params = toSearchParams(input)
  if (!params || params.get('entry') !== 'category') return null

  const applicationParam = params.get('uygulama')
  const legacySectionParam = params.get('section')
  const sectionKey = applicationParam ?? legacySectionParam
  const section = TASYUNU_SECTIONS.find((candidate) => candidate.key === sectionKey)
  if (!section) return null

  return {
    entrySurface: 'category',
    sectionKey: section.key,
    sectionTitle: section.title,
    sectionShortTitle: section.title.replace(' Levhaları', ''),
    returnHref: `/urunler/tasyunu-levha?uygulama=${encodeURIComponent(section.key)}#urunler`,
    isLegacySectionParam: !applicationParam && Boolean(legacySectionParam),
  }
}

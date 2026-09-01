import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getOrCreateCatalogJourneyId,
  notifyCategoryCtaClick,
  notifyCategoryCtaViewed,
  notifyCategoryFilterChanged,
  notifyCategoryProductClick,
  notifyCategorySectionSelected,
  resetCatalogJourneyForTests,
} from '@/lib/analytics/catalogJourney'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  resetCatalogJourneyForTests()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function stubBrowser(gtag = vi.fn()) {
  vi.stubGlobal('window', {
    gtag,
    location: { pathname: '/urunler/tasyunu-levha' },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  return gtag
}

describe('kategori yolculuğu GA4 sözleşmesi', () => {
  it('aynı sekmede kişisel veri içermeyen tek anonim kimlik üretir', () => {
    stubBrowser()

    const first = getOrCreateCatalogJourneyId()
    const second = getOrCreateCatalogJourneyId()

    expect(first).toMatch(/^cat_[a-z0-9]+_[a-z0-9]+$/)
    expect(second).toBe(first)
    expect(first).not.toMatch(/phone|email|customer|0532/iu)
  })

  it('CTA, bölüm, filtre ve ürün olaylarını aynı yolculuğa bağlar', () => {
    const gtag = stubBrowser()
    const catalogJourneyId = getOrCreateCatalogJourneyId()
    const base = {
      category_slug: 'tasyunu-levha',
      catalog_journey_id: catalogJourneyId,
    }

    notifyCategoryCtaViewed({
      ...base,
      cta_type: 'price_calculator',
      cta_location: 'hero',
    })
    notifyCategoryCtaClick({
      ...base,
      cta_type: 'price_calculator',
      cta_location: 'hero',
      section_key: 'mantolama',
    })
    notifyCategorySectionSelected({
      ...base,
      section_key: 'cati',
      section_position: 3,
      result_count: 2,
    })
    notifyCategoryFilterChanged({
      ...base,
      section_key: 'cati',
      filter_name: 'thickness',
      filter_value: '5',
      result_count: 1,
    })
    notifyCategoryProductClick({
      ...base,
      product_slug: 'ornek-urun',
      brand_name: 'Bonus',
      model_name: 'F 150',
      section_key: 'mantolama',
      card_position: 1,
      price_visibility: 'quote_required',
    })

    expect(gtag.mock.calls.map((call) => call[1])).toEqual([
      'Kategori_CTA_Goruntulendi',
      'Kategori_CTA_Click',
      'Kategori_Bolum_Secildi',
      'Kategori_Filtre_Degisti',
      'Kategori_Urun_Click',
    ])
    const payloads = gtag.mock.calls.map((call) => call[2] as Record<string, unknown>)
    expect(payloads).toHaveLength(5)
    for (const payload of payloads) {
      expect(payload).toMatchObject({
        category_slug: 'tasyunu-levha',
        catalog_journey_id: catalogJourneyId,
        page_path: '/urunler/tasyunu-levha',
      })
    }
    expect(JSON.stringify(payloads)).not.toMatch(/phone|email|customer|0532|example\.com/iu)
  })

  it('aynı CTA görüntüleme olayını yolculuk başına tek kez gönderir', () => {
    const gtag = stubBrowser()
    const payload = {
      category_slug: 'tasyunu-levha',
      catalog_journey_id: getOrCreateCatalogJourneyId(),
      cta_type: 'price_calculator' as const,
      cta_location: 'hero' as const,
    }

    notifyCategoryCtaViewed(payload)
    notifyCategoryCtaViewed(payload)

    expect(gtag).toHaveBeenCalledTimes(1)
  })
})

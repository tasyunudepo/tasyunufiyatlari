import { describe, expect, it } from 'vitest'

import type { CatalogItem } from '@/app/api/admin/catalog-items/route'
import { lineFromCatalog } from '@/components/admin/quote-editor/useQuoteEditor'

const base: CatalogItem = {
  key: 'aksesuar-117',
  kind: 'aksesuar',
  id: 117,
  thicknessCm: null,
  label: 'Dalmaçyalı Plastik Dübel 15.5',
  fullName: 'Dalmaçyalı Tuğla Dübeli Plastik çivili 15,5 cm',
  brandName: 'Dalmaçyalı',
  unit: 'KUTU',
  unitContent: 200,
  packageM2: null,
  truckM2: null,
  lorryM2: null,
  netCost: 100,
  suggestedUnitPrice: 105,
  marginPct: 5,
  marginSource: 'malzeme',
  materialSlug: null,
  isActive: true,
}

describe('manuel teklif ürün adı', () => {
  it('aksesuar satırı ve PDF için kısa, çakışan etiket yerine tam ürün adını taşır', () => {
    expect(lineFromCatalog(base, 1).description).toBe(base.fullName)
  })

  it('levhada kalınlığı içeren katalog etiketini korur', () => {
    const plate: CatalogItem = {
      ...base,
      key: 'levha-1-10',
      kind: 'levha',
      label: 'Dalmaçyalı EPS 10 cm',
      fullName: 'Dalmaçyalı EPS',
      thicknessCm: 10,
      unit: 'm²',
      materialSlug: 'eps',
    }

    expect(lineFromCatalog(plate, 600).description).toBe('Dalmaçyalı EPS 10 cm')
  })
})

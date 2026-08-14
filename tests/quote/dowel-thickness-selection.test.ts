import { describe, expect, it } from 'vitest'

import {
  buildAccessorySet,
  type AccessoryRow,
  type AccessoryTypeRow,
} from '@/lib/quote/buildAccessorySet'

const DUBEL_TIPI: AccessoryTypeRow[] = [
  {
    id: 3,
    name: 'Dübel',
    slug: 'dubel',
    sort_order: 3,
    consumption_rate_eps: 6,
    consumption_rate_tasyunu: 6,
  },
]

function dubel(id: number, boyCm: number): AccessoryRow {
  return {
    id,
    name: `Fawori Optimix Taşyünü Dübeli Çelik Çivili ${String(boyCm).replace('.', ',')}cm 200 adet`,
    short_name: null,
    brand_id: 4,
    accessory_type_id: 3,
    base_price: boyCm === 15.5 ? 1450 : 1230,
    discount_1: 9,
    discount_2: 8,
    is_kdv_included: false,
    unit: 'KUTU',
    unit_content: 200,
    dowel_length: boyCm,
    is_for_eps: false,
    is_for_tasyunu: true,
    is_active: true,
  }
}

describe('taşyünü dübeli levha kalınlığına göre seçilir', () => {
  it('9 cm levhada ilk kayıt olan 11,5 cm yerine 15,5 cm dübel seçer', () => {
    const set = buildAccessorySet({
      accessoryTypes: DUBEL_TIPI,
      accessories: [dubel(35, 11.5), dubel(36, 13.5), dubel(37, 15.5)],
      accessoryBrandId: 4,
      accessoryBrandName: 'Fawori Optimix',
      materialType: 'tasyunu',
      plateThicknessCm: 9,
      areaM2: 2851.2,
      marginPct: 3,
      city: { eps_toz_region_discount: 8, optimix_toz_discount: 8 },
    })

    expect(set.complete).toBe(true)
    expect(set.items[0]?.accessoryId).toBe(37)
    expect(set.items[0]?.description).toContain('15,5cm')
  })

  it('4 cm levhada 11,5 cm dübel seçimini korur', () => {
    const set = buildAccessorySet({
      accessoryTypes: DUBEL_TIPI,
      accessories: [dubel(35, 11.5), dubel(37, 15.5)],
      accessoryBrandId: 4,
      accessoryBrandName: 'Fawori Optimix',
      materialType: 'tasyunu',
      plateThicknessCm: 4,
      areaM2: 1000,
      marginPct: 3,
      city: null,
    })

    expect(set.items[0]?.accessoryId).toBe(35)
  })

  it('TEKNO verisindeki 155 mm değerini 15,5 cm olarak yorumlar', () => {
    const tekno = [
      { ...dubel(85, 11.5), brand_id: 6, name: 'Çelik Çivili Dübel 115 mm', dowel_length: 115 },
      { ...dubel(86, 15.5), brand_id: 6, name: 'Çelik Çivili Dübel 155 mm', dowel_length: 155 },
    ]
    const set = buildAccessorySet({
      accessoryTypes: DUBEL_TIPI,
      accessories: tekno,
      accessoryBrandId: 6,
      accessoryBrandName: 'TEKNO',
      materialType: 'tasyunu',
      plateThicknessCm: 9,
      areaM2: 1000,
      marginPct: 3,
      city: null,
    })

    expect(set.items[0]?.accessoryId).toBe(86)
  })

  it('10 cm üstünde doğrulanmış dübel kuralı olmadığı için yanlış ürün üretmez', () => {
    const set = buildAccessorySet({
      accessoryTypes: DUBEL_TIPI,
      accessories: [dubel(35, 11.5), dubel(37, 15.5)],
      accessoryBrandId: 4,
      accessoryBrandName: 'Fawori Optimix',
      materialType: 'tasyunu',
      plateThicknessCm: 12,
      areaM2: 1000,
      marginPct: 3,
      city: null,
    })

    expect(set.complete).toBe(false)
    expect(set.items).toEqual([])
    expect(set.missingTypes).toEqual(['Dübel'])
  })
})

import { describe, expect, it } from 'vitest'

import {
  buildAccessorySet,
  type AccessoryRow,
  type AccessoryTypeRow,
} from '@/lib/quote/buildAccessorySet'
import { requiredDowelLengthCm } from '@/lib/quote/selectAccessoryForSet'

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

function dubel(
  id: number,
  boyCm: number,
  options: { material?: 'eps' | 'tasyunu'; name?: string; unitContent?: number } = {},
): AccessoryRow {
  const material = options.material ?? 'tasyunu'
  return {
    id,
    name: options.name ?? `Fawori Optimix Taşyünü Dübeli Çelik Çivili ${String(boyCm).replace('.', ',')}cm 200 adet`,
    short_name: null,
    brand_id: 4,
    accessory_type_id: 3,
    base_price: boyCm === 15.5 ? 1450 : 1230,
    discount_1: 9,
    discount_2: 8,
    is_kdv_included: false,
    unit: 'KUTU',
    unit_content: options.unitContent ?? 200,
    dowel_length: boyCm,
    is_for_eps: material === 'eps',
    is_for_tasyunu: material === 'tasyunu',
    is_active: true,
  }
}

describe('dübelde 4–5 cm duvar tutunma payı gözetilir', () => {
  it('9 cm levhada 13 cm alt sınırını karşılayan 13,5 cm dübeli seçer', () => {
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
    expect(set.items[0]?.accessoryId).toBe(36)
    expect(set.items[0]?.description).toContain('13,5cm')
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

  it('10 cm EPS levhada 14 cm alt sınırını karşılayan 15,5 cm plastik dübeli seçer', () => {
    const set = buildAccessorySet({
      accessoryTypes: DUBEL_TIPI,
      accessories: [
        dubel(6, 11.5, {
          material: 'eps',
          name: 'Dalmaçyalı Plastik Dübel 11,5cm 600 adet',
          unitContent: 600,
        }),
        // Tuğla dübeli önce gelse bile standart paket tercih edilmeli.
        dubel(117, 15.5, {
          material: 'eps',
          name: 'Dalmaçyalı Tuğla Dübeli Plastik çivili 15,5 cm',
          unitContent: 200,
        }),
        dubel(8, 15.5, {
          material: 'eps',
          name: 'Dalmaçyalı Plastik Dübel 15,5cm 600 adet',
          unitContent: 600,
        }),
      ],
      accessoryBrandId: 4,
      accessoryBrandName: 'Dalmaçyalı',
      materialType: 'eps',
      plateThicknessCm: 10,
      areaM2: 600,
      marginPct: 3,
      city: null,
    })

    expect(set.complete).toBe(true)
    expect(requiredDowelLengthCm('eps', 10)).toBe(14)
    expect(set.items[0]?.accessoryId).toBe(8)
    expect(set.items[0]?.description).toBe('Dalmaçyalı Plastik Dübel 15,5cm 600 adet')
  })

  it('10 cm taşyününde 15,5 cm çelik çivili dübel seçer', () => {
    const set = buildAccessorySet({
      accessoryTypes: DUBEL_TIPI,
      accessories: [dubel(35, 11.5), dubel(36, 13.5), dubel(37, 15.5)],
      accessoryBrandId: 4,
      accessoryBrandName: 'Fawori Optimix',
      materialType: 'tasyunu',
      plateThicknessCm: 10,
      areaM2: 600,
      marginPct: 3,
      city: null,
    })

    expect(set.items[0]?.accessoryId).toBe(37)
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

  it('levha + 4 cm alt sınırını karşılayan ürün yoksa yanlış dübel üretmez', () => {
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

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  buildAccessorySet,
  type AccessoryRow,
  type AccessoryTypeRow,
} from '@/lib/quote/buildAccessorySet'

const YAPISTIRICI_TIPI: AccessoryTypeRow[] = [
  {
    id: 1,
    name: 'Yapıştırıcı',
    slug: 'yapistirici',
    sort_order: 1,
    consumption_rate_tasyunu: 6,
    consumption_rate_eps: 4,
  },
]

const OPTIMIX_YAPISTIRICI: AccessoryRow[] = [
  {
    id: 29,
    name: 'Fawori Optimix Isı Yalıtım Yapıştırma Harcı 25kg',
    short_name: null,
    brand_id: 4,
    accessory_type_id: 1,
    base_price: 205.5,
    discount_1: 9,
    discount_2: 8,
    is_kdv_included: false,
    unit: 'PKT',
    unit_content: 25,
    is_for_eps: true,
    is_for_tasyunu: true,
    is_active: true,
  },
]

const DIYARBAKIR = {
  // Filli/Dalmaçyalı haritasında %7, Optimix haritasında %9.
  eps_toz_region_discount: 7,
  optimix_toz_discount: 9,
}

const ARTVIN = {
  eps_toz_region_discount: 5,
  optimix_toz_discount: 5,
}

function optimixSeti(materialType: 'tasyunu' | 'eps', city: typeof DIYARBAKIR) {
  return buildAccessorySet({
    accessoryTypes: YAPISTIRICI_TIPI,
    accessories: OPTIMIX_YAPISTIRICI,
    accessoryBrandId: 4,
    accessoryBrandName: 'Optimix',
    materialType,
    areaM2: 100,
    marginPct: 5,
    city,
  })
}

describe('Optimix toz grubu şehir iskontosu', () => {
  it('taşyününde Artvin %5 + bayi %8 + marj %5 uygular', () => {
    expect(optimixSeti('tasyunu', ARTVIN).items[0].unitPrice).toBe(188.59)
  })

  it('taşyününde Diyarbakır Optimix haritasındaki %9 değerini uygular', () => {
    expect(optimixSeti('tasyunu', DIYARBAKIR).items[0].unitPrice).toBe(180.65)
  })

  it('EPS seçilse de Filli %7 yerine Optimix %9 haritasını kullanır', () => {
    expect(optimixSeti('eps', DIYARBAKIR).items[0].unitPrice).toBe(180.65)
  })

  it('admin katalog, set kurucu ve wizard aynı ortak çözümleyiciyi kullanır', () => {
    const setKurucu = readFileSync('lib/quote/buildAccessorySet.ts', 'utf8')
    const katalog = readFileSync('app/api/admin/catalog-items/route.ts', 'utf8')
    const wizard = readFileSync('components/wizard/WizardCalculator.tsx', 'utf8')

    expect(setKurucu).toContain('resolveAccessoryDiscounts')
    expect(katalog).toContain('resolveAccessoryDiscounts')
    expect(wizard).toContain('resolveAccessoryDiscounts')
  })
})

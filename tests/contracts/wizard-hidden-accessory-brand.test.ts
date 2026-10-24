import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  filterWizardPackageDefinitions,
  isWizardAccessoryBrandHidden,
} from '@/lib/wizard/eligibility'

// Emrah, 24 Ekim 2026: TEKNO toz seti hesaplayıcıda gösterilmez — set tam
// kurulmuyor, fiyatı ve nakliyesi netleşmiyor. Kayıt veritabanında durur.

const BRANDS = [
  { id: 1, name: 'Dalmaçyalı' },
  { id: 2, name: 'Expert' },
  { id: 4, name: 'Optimix' },
  { id: 6, name: 'TEKNO' },
  { id: 12, name: 'Bonus' },
]

// Canlıdaki paket tanımlarının özeti (package_definitions).
const DEFINITIONS = [
  { id: 4, plate_brand_id: 1, accessory_brand_id: 1 },
  { id: 5, plate_brand_id: 1, accessory_brand_id: 4 },
  { id: 6, plate_brand_id: 1, accessory_brand_id: 6 },
  { id: 9, plate_brand_id: 2, accessory_brand_id: 6 },
  { id: 10, plate_brand_id: 4, accessory_brand_id: 4 },
  { id: 11, plate_brand_id: 4, accessory_brand_id: 6 },
  { id: 22, plate_brand_id: 12, accessory_brand_id: 2 },
  { id: 24, plate_brand_id: 12, accessory_brand_id: 6 },
]

describe('hesaplayıcıda gizli toz grubu markası', () => {
  it('TEKNO gizlidir; yazım farkı sonucu değiştirmez', () => {
    expect(isWizardAccessoryBrandHidden('TEKNO')).toBe(true)
    expect(isWizardAccessoryBrandHidden('Tekno')).toBe(true)
    expect(isWizardAccessoryBrandHidden(' tekno ')).toBe(true)
    expect(isWizardAccessoryBrandHidden('Optimix')).toBe(false)
    expect(isWizardAccessoryBrandHidden(null)).toBe(false)
  })

  it('TEKNO tozlu paketler çıkar, diğerleri sırasıyla kalır', () => {
    const kalan = filterWizardPackageDefinitions(DEFINITIONS, BRANDS).map((d) => d.id)
    expect(kalan).toEqual([4, 5, 10, 22])
  })

  it('hesaplayıcı paket tanımlarını yüklerken filtreyi uygular', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/wizard/WizardCalculator.tsx'), 'utf8')
    expect(source).toContain('setPackageDefinitions(filterWizardPackageDefinitions(packagesRes.data, brandsRes.data ?? []))')
    expect(source).not.toMatch(/setPackageDefinitions\(packagesRes\.data\)/)
  })
})

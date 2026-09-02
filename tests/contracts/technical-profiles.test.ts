import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DENSITY_SOURCE_LABELS,
  densitySourceLabel,
  densityWithSourceLabel,
  getAllProfiles,
  getComparisonProfiles,
  getProfileByKey,
  getProfileByModel,
  isWizardEligibleModel,
} from '@/lib/technical-profiles'

// Kabul kaynağı: docs/verification/bonus-yogunluk-karsilastirma-prd.md
// AC-001 (kaynak türü + tarih zorunlu), FR-002 (wizard uygunluğu),
// FR-006 (sözlü etiket + iç kaydın sızmaması) ve Tur 3 kararındaki
// sözlü yoğunluk aralıkları.

const EXPECTED_KEYS = [
  'bonus-premium-f-150',
  'bonus-premium-f-150-pro',
  'expert-hd150',
  'bonus-premium-f-120',
  'expert-ld125',
  'dalmacyali-sw035',
  'expert-tasyunu-premium',
  'fawori-optimix-tr75',
] as const

// 2026-07-20 genişletmesi: Bonus mantolama dışı aileler (wizard/karşılaştırma DIŞI).
const BONUS_EXPANSION_KEYS = [
  'bonus-gold-plus-50',
  'bonus-gold-black-50',
  'bonus-gold-yellow-50',
  'bonus-gold-alu-50',
  'bonus-gold-plus-70',
  'bonus-gold-black-70',
  'bonus-gold-yellow-70',
  'bonus-gold-plus-90',
  'bonus-gold-black-90',
  'bonus-premium-f',
  'bonus-premium-r',
  'bonus-premium-r-150',
  'bonus-platin-110',
  'bonus-private-70',
  'bonus-endustriyel-levha-70',
  'bonus-endustriyel-levha-110',
  'bonus-endustriyel-silte-650',
  'bonus-endustriyel-silte-700',
  'bonus-endustriyel-silte-720',
  'bonus-endustriyel-silte-750',
] as const

// Föyünde/kaynağında kg/m³ beyanı olmayanlar: değer uydurulmaz, null tutulur.
const NO_DENSITY_KEYS = ['bonus-premium-f', 'bonus-premium-r', 'bonus-premium-r-150'] as const

describe('teknik profil verisi — AC-001', () => {
  it('profil havuzu 8 karşılaştırma ürünü + 20 Bonus genişletme ürünüdür', () => {
    const keys = getAllProfiles().map((p) => p.productKey).sort()
    expect(keys).toEqual([...EXPECTED_KEYS, ...BONUS_EXPANSION_KEYS].sort())
  })

  it.each(EXPECTED_KEYS)('%s kaynak türü, kaynak tarihi ve değer metni taşır', (key) => {
    const profile = getProfileByKey(key)
    expect(profile).not.toBeNull()
    const density = profile!.density
    expect(density).not.toBeNull()
    expect(['datasheet', 'manufacturer_verbal']).toContain(density!.sourceType)
    expect(density!.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(density!.display.length).toBeGreaterThan(0)
    expect(density!.minKgM3).toBeLessThanOrEqual(density!.maxKgM3)
    expect(profile!.datasheetRef.length).toBeGreaterThan(0)
    expect(profile!.editorial?.summary.length).toBeGreaterThan(40)
    expect(profile!.editorial?.highlights.length).toBeGreaterThanOrEqual(3)
    expect(profile!.editorial?.boardSize).toMatch(/mm$/)
  })
})

describe('Bonus genişletmesi — wizard/karşılaştırma sızıntısı yok', () => {
  it.each(BONUS_EXPANSION_KEYS)('%s wizard ve karşılaştırma dışıdır', (key) => {
    const profile = getProfileByKey(key)
    expect(profile).not.toBeNull()
    expect(profile!.wizardEligible).toBe(false)
    expect(profile!.comparisonEligible).toBe(false)
    expect(profile!.datasheetRef.length).toBeGreaterThan(0)
  })

  it.each(NO_DENSITY_KEYS)('%s föy beyanı olmadığı için yoğunluk taşımaz', (key) => {
    const profile = getProfileByKey(key)!
    expect(profile.density).toBeNull()
    expect(densityWithSourceLabel(profile)).toBe('Yoğunluk: föyde beyan edilmemiş')
  })

  it('genişletme ürünlerinden beyanı olanlar datasheet kaynaklıdır', () => {
    for (const key of BONUS_EXPANSION_KEYS) {
      const profile = getProfileByKey(key)!
      if (profile.density) {
        expect(profile.density.sourceType).toBe('datasheet')
        expect(profile.density.minKgM3).toBeLessThanOrEqual(profile.density.maxKgM3)
      }
    }
  })

  it('mantolama dışı kapsamlar mantolama wizard modeli sayılmaz', () => {
    for (const key of BONUS_EXPANSION_KEYS) {
      const profile = getProfileByKey(key)!
      expect(isWizardEligibleModel(profile.modelShortName)).toBe(false)
    }
  })
})

describe('sözlü yoğunluk beyanları — Tur 3 kararı', () => {
  it.each([
    ['dalmacyali-sw035', 110, 120],
    ['expert-tasyunu-premium', 100, 110],
    ['fawori-optimix-tr75', 100, 120],
  ])('%s sözlü kaynaklı ve %d–%d kg/m³ aralığındadır', (key, min, max) => {
    const density = getProfileByKey(key)!.density!
    expect(density.sourceType).toBe('manufacturer_verbal')
    expect(density.minKgM3).toBe(min)
    expect(density.maxKgM3).toBe(max)
    expect(density.display).toBe(`${min}–${max} kg/m³`)
  })

  it('sözlü kaynak müşteri etiketi karar metniyle birebir aynıdır', () => {
    expect(DENSITY_SOURCE_LABELS.manufacturer_verbal).toBe('Üretici sözlü beyanı — değişken')
    const sw035 = getProfileByKey('dalmacyali-sw035')!
    expect(densitySourceLabel(sw035)).toBe('Üretici sözlü beyanı — değişken')
    expect(densityWithSourceLabel(sw035)).toBe('110–120 kg/m³ · Üretici sözlü beyanı — değişken')
  })

  it('karşılaştırma havuzunda föy beyanlı beş ürün datasheet kaynak türündedir', () => {
    const expansion = new Set<string>(BONUS_EXPANSION_KEYS)
    const datasheetKeys = getAllProfiles()
      .filter((p) => !expansion.has(p.productKey) && p.density?.sourceType === 'datasheet')
      .map((p) => p.productKey)
      .sort()
    expect(datasheetKeys).toEqual(
      [
        'bonus-premium-f-150',
        'bonus-premium-f-150-pro',
        'bonus-premium-f-120',
        'expert-hd150',
        'expert-ld125',
      ].sort(),
    )
  })
})

describe('TR7.5 adı çekme sınıfıdır, yoğunluk değildir', () => {
  it('TR7.5 profili 7,5 değerini yoğunluk olarak taşımaz', () => {
    const profile = getProfileByModel('TR7.5')!
    expect(profile.density!.minKgM3).toBe(100)
    expect(profile.density!.maxKgM3).toBe(120)
    expect(profile.density!.display).not.toMatch(/7[.,]5/u)
    expect(profile.tensileClass).toBe('TR7.5')
    expect(profile.tensileDisplay).toContain('7,5 kPa')
  })
})

describe('wizard uygunluğu — FR-002', () => {
  it.each(['SW035', 'Premium', 'HD150', 'LD125', 'TR7.5', 'F 150', 'F 150 Pro', 'F 120'])(
    '%s mantolama wizard uygunluğu taşır',
    (model) => {
      expect(isWizardEligibleModel(model)).toBe(true)
    },
  )

  it.each(['RF150', 'PW50', 'VF80', 'İdeal Carbon', ''])(
    '%s mantolama profili değildir; wizard uygunluğu vermez',
    (model) => {
      expect(isWizardEligibleModel(model)).toBe(false)
    },
  )
})

describe('karşılaştırma sıralaması — 150 föy beyanlıları önde', () => {
  it('ilk üç sıra föy beyanlı 150 ürünleridir', () => {
    const firstThree = getComparisonProfiles()
      .slice(0, 3)
      .map((p) => p.productKey)
      .sort()
    expect(firstThree).toEqual(
      ['bonus-premium-f-150', 'bonus-premium-f-150-pro', 'expert-hd150'].sort(),
    )
  })
})

describe('iç kaynak kaydı sızmaz — FR-006', () => {
  it('modül kaynağı ve dışa verdiği veri bildirim kanalı bilgisini içermez', () => {
    const moduleSource = readFileSync(
      resolve(process.cwd(), 'lib/technical-profiles/index.ts'),
      'utf8',
    )
    const serialized = JSON.stringify(getAllProfiles())

    for (const forbidden of ['bayi ticari bilgisi', 'internal_source_note', 'internalSourceNote']) {
      expect(moduleSource).not.toContain(forbidden)
      expect(serialized).not.toContain(forbidden)
    }
  })
})

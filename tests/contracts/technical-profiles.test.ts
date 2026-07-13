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

describe('teknik profil verisi — AC-001', () => {
  it('karşılaştırma listesi tam olarak sekiz üründür', () => {
    const keys = getAllProfiles().map((p) => p.productKey).sort()
    expect(keys).toEqual([...EXPECTED_KEYS].sort())
  })

  it.each(EXPECTED_KEYS)('%s kaynak türü, kaynak tarihi ve değer metni taşır', (key) => {
    const profile = getProfileByKey(key)
    expect(profile).not.toBeNull()
    expect(['datasheet', 'manufacturer_verbal']).toContain(profile!.density.sourceType)
    expect(profile!.density.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(profile!.density.display.length).toBeGreaterThan(0)
    expect(profile!.density.minKgM3).toBeLessThanOrEqual(profile!.density.maxKgM3)
    expect(profile!.datasheetRef.length).toBeGreaterThan(0)
  })
})

describe('sözlü yoğunluk beyanları — Tur 3 kararı', () => {
  it.each([
    ['dalmacyali-sw035', 110, 120],
    ['expert-tasyunu-premium', 100, 110],
    ['fawori-optimix-tr75', 100, 120],
  ])('%s sözlü kaynaklı ve %d–%d kg/m³ aralığındadır', (key, min, max) => {
    const profile = getProfileByKey(key)!
    expect(profile.density.sourceType).toBe('manufacturer_verbal')
    expect(profile.density.minKgM3).toBe(min)
    expect(profile.density.maxKgM3).toBe(max)
    expect(profile.density.display).toBe(`${min}–${max} kg/m³`)
  })

  it('sözlü kaynak müşteri etiketi karar metniyle birebir aynıdır', () => {
    expect(DENSITY_SOURCE_LABELS.manufacturer_verbal).toBe('Üretici sözlü beyanı — değişken')
    const sw035 = getProfileByKey('dalmacyali-sw035')!
    expect(densitySourceLabel(sw035)).toBe('Üretici sözlü beyanı — değişken')
    expect(densityWithSourceLabel(sw035)).toBe('110–120 kg/m³ · Üretici sözlü beyanı — değişken')
  })

  it('föy beyanlı beş ürün datasheet kaynak türündedir', () => {
    const datasheetKeys = getAllProfiles()
      .filter((p) => p.density.sourceType === 'datasheet')
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
    expect(profile.density.minKgM3).toBe(100)
    expect(profile.density.maxKgM3).toBe(120)
    expect(profile.density.display).not.toMatch(/7[.,]5/u)
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

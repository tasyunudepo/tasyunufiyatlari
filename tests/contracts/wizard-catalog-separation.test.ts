import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildWizardPrefill } from '@/lib/catalog/prefill'
import {
  EPS_MANTOLAMA_MODELLER,
  filterMantolamaWizardModels,
  isMantolamaWizardModel,
} from '@/lib/wizard/eligibility'

// Kabul kaynağı: PRD FR-002 / FR-007 / AC-002 / AC-007.
// Wizard uygunluğu tek noktadan (teknik profil + EPS listesi) verilir;
// bileşenlerde sabit model listesi (DIS_CEPHE_MODELLER) kalamaz ve
// mantolama-dışı levhalar wizard prefill'i üretemez.

const ROOT = process.cwd()

function source(file: string): string {
  return readFileSync(resolve(ROOT, file), 'utf8')
}

describe('model uygunluğu — FR-002 / AC-002', () => {
  it.each(['SW035', 'Premium', 'HD150', 'LD125', 'TR7.5', 'F 150', 'F 150 Pro', 'F 120'])(
    'taşyünü %s wizard için uygundur',
    (model) => {
      expect(isMantolamaWizardModel('tasyunu', model)).toBe(true)
    },
  )

  it.each(['RF150', 'PW50', 'VF80'])('katalog ürünü %s wizard için uygun değildir', (model) => {
    expect(isMantolamaWizardModel('tasyunu', model)).toBe(false)
    expect(isMantolamaWizardModel('eps', model)).toBe(false)
  })

  it('EPS mantolama modelleri yalnız eps malzemesinde uygundur', () => {
    for (const model of EPS_MANTOLAMA_MODELLER) {
      expect(isMantolamaWizardModel('eps', model)).toBe(true)
      expect(isMantolamaWizardModel('tasyunu', model)).toBe(false)
    }
  })

  it('malzeme çapraz geçişine izin verilmez', () => {
    expect(isMantolamaWizardModel('eps', 'SW035')).toBe(false)
    expect(isMantolamaWizardModel(null, 'SW035')).toBe(false)
    expect(isMantolamaWizardModel('tasyunu', null)).toBe(false)
  })

  it('filtre uygun olmayanları eler, sırayı korur', () => {
    expect(
      filterMantolamaWizardModels('tasyunu', ['RF150', 'HD150', 'PW50', 'SW035', 'VF80']),
    ).toEqual(['HD150', 'SW035'])
  })
})

describe('wizard prefill kapısı — FR-007 / AC-007', () => {
  const base = {
    plateId: 42,
    plateName: 'Test Levhası',
    brandId: 7,
    brandName: 'Expert',
    kalinlik: 5,
  }

  it('mantolama-uygun taşyünü levhası prefill üretir', () => {
    const prefill = buildWizardPrefill({
      ...base,
      shortName: 'HD150',
      materialSlug: 'tasyunu',
    })
    expect(prefill).toEqual({
      levhaTipi: 'tasyunu',
      markaId: 7,
      markaAdi: 'Expert',
      modelId: 42,
      modelAdi: 'HD150',
      kalinlik: 5,
    })
  })

  it.each(['RF150', 'PW50', 'VF80'])('%s için prefill üretilmez', (shortName) => {
    expect(
      buildWizardPrefill({ ...base, shortName, materialSlug: 'tasyunu' }),
    ).toBeNull()
  })

  it('short_name yoksa ürün adına düşer ve yine kapıdan geçmek zorundadır', () => {
    expect(
      buildWizardPrefill({
        ...base,
        plateName: 'Expert RF150 Çatı Levhası',
        shortName: null,
        materialSlug: 'tasyunu',
      }),
    ).toBeNull()
  })

  it('EPS mantolama levhası prefill üretir', () => {
    const prefill = buildWizardPrefill({
      ...base,
      shortName: 'İdeal Carbon',
      materialSlug: 'eps',
    })
    expect(prefill?.levhaTipi).toBe('eps')
    expect(prefill?.modelAdi).toBe('İdeal Carbon')
  })
})

describe('kablolama sözleşmesi — sabit liste yasağı', () => {
  it.each([
    'components/wizard/WizardStep1.tsx',
    'components/wizard/Step1ProductSelection.tsx',
  ])('%s sabit DIS_CEPHE_MODELLER listesi taşımaz, uygunluk modülünü kullanır', (file) => {
    const content = source(file)
    expect(content).not.toMatch(/DIS_CEPHE_MODELLER\s*=\s*\[/u)
    expect(content).toContain("from '@/lib/wizard/eligibility'")
  })

  it('katalog server prefill kararını modüle bırakır, inline kurmaz', () => {
    const content = source('lib/catalog/server.ts')
    expect(content).toContain("from '@/lib/catalog/prefill'")
    expect(content).not.toMatch(/wizard_prefill\s*:\s*WizardPrefill\s*=\s*\{/u)
  })
})

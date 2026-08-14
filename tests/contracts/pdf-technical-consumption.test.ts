import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  formatTechnicalConsumption,
  technicalConsumptionUnitForSlug,
} from '@/lib/quote/technicalConsumption'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function source(path: string) {
  return readFileSync(`${repoRoot}${path}`, 'utf8')
}

describe('teklif PDF teknik sarfiyat sözleşmesi', () => {
  const wizardSource = source('components/wizard/WizardCalculator.tsx')
  const pdfSource = source('lib/pdfGenerator.ts')

  it('ambalaj adedini metraja bölüp teknik sarfiyat gibi göstermez', () => {
    expect(wizardSource).not.toContain('it.quantity / metrajNumber')
    expect(wizardSource).toContain('consumptionRate: it.consumptionRate')
    expect(wizardSource).toContain('consumptionUnit: it.consumptionUnit')
  })

  it('aksesuarın veri tabanındaki teknik sarfiyatını ve birimini PDF kalemine taşır', () => {
    expect(wizardSource).toContain('consumptionRate: consumption')
    expect(wizardSource).toContain('technicalConsumptionUnitForSlug(accType.slug)')
  })

  it('PDF sütunu değeri birimiyle birlikte açıkça gösterir', () => {
    expect(pdfSource).toContain('M² SARFİYATI')
    expect(pdfSource).not.toContain('>SARFİYAT</th>')
    expect(pdfSource).toContain(
      'formatTechnicalConsumption(it.consumptionRate, it.consumptionUnit)',
    )
    expect(pdfSource).toContain(
      'formatTechnicalConsumption(item.consumptionRate, item.consumptionUnit)',
    )
  })
})

describe('teknik sarfiyat biçimi', () => {
  it.each([
    ['yapistirici', 6, '6 kg/m²'],
    ['siva', 6, '6 kg/m²'],
    ['dubel', 6, '6 adet/m²'],
    ['file', 1.1, '1,1 m²/m²'],
    ['fileli-kose', 0.5, '0,5 mt/m²'],
    ['astar', 0.2, '0,2 kg/m²'],
    ['kaplama', 2.5, '2,5 kg/m²'],
  ])('%s için %s değerini fiziksel birimiyle gösterir', (slug, rate, expected) => {
    const unit = technicalConsumptionUnitForSlug(slug)
    expect(formatTechnicalConsumption(rate, unit)).toBe(expected)
  })

  it('sarfiyatı olmayan serbest kalemde yanıltıcı sıfır göstermez', () => {
    expect(formatTechnicalConsumption(0)).toBe('—')
  })
})

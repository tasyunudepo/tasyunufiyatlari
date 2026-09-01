import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function readRepoFile(path: string) {
  return readFileSync(`${repoRoot}${path}`, 'utf8')
}

describe('teklif istemcisi KVKK sözleşmesi', () => {
  it('Wizard ortak payloadına gerçek form onayını taşır', () => {
    const source = readRepoFile('components/wizard/WizardCalculator.tsx')

    expect(source).toContain(
      'kvkkConsent: overrides?.kvkkConsent ?? quoteForm.kvkkConsent',
    )
    expect(source).toMatch(
      /quoteCode:\s*refCode,\s*kvkkConsent:\s*data\.kvkkConsent/,
    )
  })

  it('Wizard teklif metadata’sına karşılaştırma yolculuk bağını taşır', () => {
    const source = readRepoFile('components/wizard/WizardCalculator.tsx')

    expect(source).toContain('entry_surface: entryAttribution.entrySurface')
    expect(source).toContain('comparison_session_id: entryAttribution.comparisonSessionId')
    expect(source).toContain('catalog_journey_id: entryAttribution.catalogJourneyId')
    expect(source).toContain('section_key: entryAttribution.sectionKey')
    expect(source).toContain('result_session_id: resultSessionId || null')
    expect(source).toContain("sourceChannel: entryAttribution.entrySurface === 'comparison'")
    expect(source).toContain('comparisonSessionId: entryAttribution.comparisonSessionId')
  })

  it('PDP PDF payloadına gerçek form onayını taşır', () => {
    const source = readRepoFile(
      'components/catalog/SingleProductQuoteButton.tsx',
    )

    expect(source).toContain('kvkkConsent:   formData.kvkkConsent')
    expect(source).toContain('section_key: categoryContext?.sectionKey ?? null')
  })
})

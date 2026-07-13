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

  it('PDP PDF payloadına gerçek form onayını taşır', () => {
    const source = readRepoFile(
      'components/catalog/SingleProductQuoteButton.tsx',
    )

    expect(source).toContain('kvkkConsent:   formData.kvkkConsent')
  })
})

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function read(path: string): string {
  return readFileSync(`${repoRoot}${path}`, 'utf8')
}

describe('private PDF istemci ve route sözleşmesi', () => {
  it.each([
    'components/wizard/WizardCalculator.tsx',
    'components/catalog/SingleProductQuoteButton.tsx',
  ])('%s quote/capability oluşmadan upload yapmaz', (path) => {
    const source = read(path)
    const quoteIndex = source.indexOf("fetch('/api/quotes'")
    const uploadIndex = source.indexOf('uploadPdfToStorage(', quoteIndex)

    expect(quoteIndex).toBeGreaterThan(-1)
    expect(uploadIndex).toBeGreaterThan(quoteIndex)
    expect(source).toContain('pdfUploadCapability')
    expect(source).toContain("'Idempotency-Key': crypto.randomUUID()")
  })

  it('storage route server path üretir, overwrite ve public URL kullanmaz', () => {
    const route = read('app/api/upload-pdf/route.ts')

    expect(route).toContain('randomUUID()')
    expect(route).toContain('upsert: false')
    expect(route).not.toContain('getPublicUrl')
    expect(route).not.toContain('upsert: true')
    expect(route).toContain('verifyPdfCapabilityToken')
  })

  it('istemci helperı kalıcı public URL sözleşmesi taşımaz', () => {
    const helper = read('lib/uploadPdfToStorage.ts')

    expect(helper).toContain('signedUrl')
    expect(helper).not.toContain('publicUrl')
    expect(helper).toContain("formData.append('capability'")
    expect(helper).toContain("formData.append('quoteId'")
  })
})

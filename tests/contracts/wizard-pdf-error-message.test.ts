import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'components/wizard/WizardCalculator.tsx'),
  'utf8',
)

describe('Wizard PDF hata mesajı sözleşmesi', () => {
  it('teklif kayıt hatasını PDF üretim hatası olarak göstermiyor', () => {
    expect(source).toContain("let pdfOfferFailureStage: 'pdf' | 'quote' = 'pdf'")
    expect(source).toContain("pdfOfferFailureStage = 'quote'")
    expect(source).toContain("pdfOfferFailureStage === 'pdf'")
    expect(source).toContain('error instanceof Error && error.message')
    expect(source).not.toContain('alert("PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyiniz.")')
  })
})

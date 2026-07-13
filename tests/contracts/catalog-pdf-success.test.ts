import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  fileURLToPath(
    new URL('../../components/catalog/SingleProductQuoteButton.tsx', import.meta.url),
  ),
  'utf8',
)
const deliverySource = readFileSync(
  fileURLToPath(
    new URL('../../components/quote/PdfDeliveryCard.tsx', import.meta.url),
  ),
  'utf8',
)

describe('PDP PDF başarı sözleşmesi', () => {
  it('API başarısızlığını başarı durumuna çevirmeden durdurur', () => {
    expect(source).toMatch(/if \(!quoteRes\.ok \|\| !quoteResult\?\.ok\)/)
    expect(source).toContain("throw new Error(quoteResult?.error || 'Teklif kaydı oluşturulamadı.')")
  })

  it('başarıda sade paylaşım ve indirme seçeneklerini gösterir', () => {
    expect(source).toContain('<PdfDeliveryCard')
    expect(deliverySource).toContain('WhatsApp’ta aç')
    expect(deliverySource).toContain('E-postada aç')
    expect(deliverySource).toContain('PDF indir')
    expect(source).not.toContain("window.open(pdfResult.blobUrl, '_blank')")
  })
})

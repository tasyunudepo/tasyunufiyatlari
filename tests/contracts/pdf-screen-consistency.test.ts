import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(file: string): string {
  return readFileSync(resolve(process.cwd(), file), 'utf8')
}

/**
 * Ekran ↔ PDF fiyat tabanı sözleşmesi (karar: 2026-07-23).
 * Müşteri wizard'daki 3 paket kartında KDV DAHİL m² fiyatı görür;
 * PDF'in büyük rakamı da aynı tabanda olmalıdır. Ayrışma güveni bozar
 * ("ekranda 869, PDF'te 724" şikâyeti).
 */
describe('PDF hero ↔ ekran paket kartı fiyat tabanı', () => {
  it('ekran kartının büyük rakamı KDV dahildir', () => {
    const card = source('components/package/PackageCard.tsx')
    expect(card).toContain('m2PriceWithVat = pkg.pricePerM2 * 1.2')
    const heroBlock = card.slice(card.indexOf('{m2PriceLabel}'), card.indexOf('Toplam:'))
    expect(heroBlock).toContain('m2PriceWithVat')
  })

  // Kutu düzeni 24 Temmuz'da değişti (Emrah kararı): Toplam Metraj
  // büyük ve üstte, KDV dahil/hariç m² fiyatları altta EŞİT boyutta.
  // Korunan asıl sözleşme aynı: KDV DAHİL değeri ekran kartıyla aynı
  // tabandan (calculatedM2Price × 1,2), KDV hariç değeri çıplak tabandan.
  it('PDF kutusunda Toplam Metraj üstte ve KDV satırlarından önce gelir', () => {
    const pdf = source('lib/pdfGenerator.ts')
    const box = pdf.slice(pdf.indexOf('Toplam Metraj'), pdf.indexOf('<!-- Tablo -->'))
    expect(box.indexOf('KDV DAHİL')).toBeGreaterThan(0)
    expect(box.indexOf('KDV hariç')).toBeGreaterThan(box.indexOf('KDV DAHİL'))
  })

  it('PDF KDV DAHİL değeri ekranla aynı tabandadır ve etiketlidir', () => {
    const pdf = source('lib/pdfGenerator.ts')
    const box = pdf.slice(pdf.indexOf('Toplam Metraj'), pdf.indexOf('<!-- Tablo -->'))
    expect(box).toContain('calculatedM2Price * 1.2')
    expect(box).toMatch(/KDV DAHİL[\s\S]{0,300}fmtMoney\(calculatedM2Price \* 1\.2\)/)
  })

  it('PDF KDV hariç değeri ayrı, etiketli ve KDV dahil ile EŞİT boyutta satırdadır', () => {
    const pdf = source('lib/pdfGenerator.ts')
    const box = pdf.slice(pdf.indexOf('Toplam Metraj'), pdf.indexOf('<!-- Tablo -->'))
    expect(box).toMatch(/KDV hariç[\s\S]{0,300}fmtMoney\(calculatedM2Price\)/)
    // Eşit boyut sözleşmesi: iki değer satırı aynı font-size'ı kullanır.
    const sizes = [...box.matchAll(/font-size:(\d+)px[^>]*font-feature-settings:'tnum';">\$\{escapeHtml\(fmtMoney\(calculatedM2Price/g)].map((m) => m[1])
    expect(sizes.length).toBe(2)
    expect(sizes[0]).toBe(sizes[1])
  })

  it('heroLabel varyantları KDV ibaresi taşımaz (KDV etiketi değerlerin yanındadır)', () => {
    const rules = source('lib/pricing/commercialRules.ts')
    const heroLabels = rules.match(/heroLabel: '([^']+)'/g) ?? []
    expect(heroLabels.length).toBeGreaterThanOrEqual(3)
    for (const label of heroLabels) {
      expect(label).not.toContain('KDV')
    }
  })
})

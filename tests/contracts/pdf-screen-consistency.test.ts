import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(file: string): string {
  return readFileSync(resolve(process.cwd(), file), 'utf8')
}

/**
 * Ekran ↔ PDF fiyat tabanı sözleşmesi (karar: 2026-07-23).
 * Müşteri wizard'daki 3 paket kartında KDV DAHİL m² fiyatı görür;
 * PDF'in KDV dahil m² fiyatı da aynı tabanda olmalıdır. Ayrışma güveni
 * bozar ("ekranda 869, PDF'te 724" şikâyeti).
 *
 * Kutu düzeni iki kez değişti; korunan asıl sözleşme aynıdır:
 *   - 24 Temmuz 2026 (Emrah): Toplam Metraj büyük ve üstte, KDV dahil/hariç
 *     m² fiyatları altta eşit boyutta.
 *   - 13 Ekim 2026 (Emrah, yuvarlak masa): dört rakam üstte EŞİT ağırlıkta:
 *     toplam fiyat, toplam metraj, m² fiyatı KDV dahil, m² fiyatı KDV hariç.
 *     24 Temmuz düzeninin yerine geçer.
 *     Karar kaydı: reports/teklif-formu-cro-2026-10-13/pdf-yuvarlak-masasi.md
 *
 * Şablon lib/pdfGenerator.ts'ten lib/pdf/quoteDocument.ts'e taşındı;
 * davranış testleri tests/pdf/quote-document.test.ts içindedir.
 */
describe('PDF hero ↔ ekran paket kartı fiyat tabanı', () => {
  it('ekran kartının büyük rakamı KDV dahildir', () => {
    const card = source('components/package/PackageCard.tsx')
    expect(card).toContain('m2PriceWithVat = pkg.pricePerM2 * 1.2')
    const heroBlock = card.slice(card.indexOf('{m2PriceLabel}'), card.indexOf('Toplam:'))
    expect(heroBlock).toContain('m2PriceWithVat')
  })

  const pdf = source('lib/pdf/quoteDocument.ts')
  const hero = pdf.slice(pdf.indexOf("const hero = block('hero'"), pdf.indexOf("const info = block('info'"))

  it('PDF üst bölümünde dört rakam bu sırayla durur', () => {
    const order = ['TOPLAM FİYAT', 'TOPLAM METRAJ', 'KDV DAHİL', 'KDV HARİÇ'].map((label) => hero.indexOf(label))
    expect(order.every((index) => index > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('PDF KDV DAHİL değeri ekranla aynı tabandadır ve etiketlidir', () => {
    expect(hero).toContain('calculatedM2Price * 1.2')
    expect(hero).toMatch(/KDV DAHİL[\s\S]{0,120}m2Value\(calculatedM2Price \* 1\.2\)/)
  })

  it('PDF KDV hariç değeri ayrı ve etiketlidir', () => {
    expect(hero).toMatch(/KDV HARİÇ[\s\S]{0,120}m2Value\(calculatedM2Price\)/)
  })

  it('dört rakam EŞİT boyuttadır: aynı sınıf, tek yazı boyutu', () => {
    expect(hero.match(/class="tq-metric-value"/g)?.length).toBe(4)
    const styles = source('lib/pdf/quoteDocumentStyles.ts')
    const sizes = [...styles.matchAll(/\.tq-metric-value\{font-size:(\d+)px/g)].map((m) => m[1])
    expect(sizes.length).toBe(1)
  })

  it('m² fiyatı tabanı tek fonksiyondan gelir; KDV iki kez eklenmez', () => {
    expect(pdf).toContain('const calculatedM2Price = resolveNetM2Price(data, metrajValue)')
    expect(pdf).not.toContain('data.grandTotal / metrajValue')
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

// ── Ofis teklifi: negatif kalem satırı (27 Temmuz 2026) ──
//
// Elle yazılan teklifte toplu alım iskontosu NEGATİF bir kalem satırı
// olarak basılabilir (alcifiyatlari teklif düzenindeki "Toplu alım
// iskontosu (%3)" satırının karşılığı).
//
// Eski kontrol `it.unitPrice < 0.01` idi ve negatifi de kapsıyordu:
// iskonto satırı tutar yerine "paket içeriği" gösteriyor, TUTAR sütununa
// "-" basıyordu. Müşteriye giden belgede iskonto görünmüyordu.
describe('PDF kalem satırı — negatif tutar ve paket sayısı', () => {
  const pdfSource = source('lib/pdf/quoteDocument.ts')

  it('negatif birim fiyat "paket içeriği" sayılmaz', () => {
    expect(pdfSource).toContain('it.unitPrice >= 0 && it.unitPrice < 0.01')
    // Eski hatalı kontrol geri gelmemeli.
    expect(pdfSource).not.toMatch(/it\.unitPrice === 0 \|\| it\.unitPrice < 0\.01/)
  })

  it('paket sayısı yoksa "(0 PKT)" yazılmaz', () => {
    expect(pdfSource).toContain('(it.packageCount ?? 0) > 0')
    expect(pdfSource).not.toContain('${it.packageCount || 0} PKT')
  })
})

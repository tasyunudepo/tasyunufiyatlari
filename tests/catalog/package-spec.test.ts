import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { formatPackageSpecNote, resolvePackageSpec, roundAreaToPackages } from '@/lib/catalog/packageSpec'
import { resolvePlatePackageDetail } from '@/lib/catalog/package-details'
import type { CatalogProductView } from '@/lib/catalog/types'
import { buildQuoteDocument } from '@/lib/pdf/quoteDocument'
import type { PDFQuoteData } from '@/lib/pdfGenerator'
import { buildBonusPackageTable } from '@/lib/pricing/bonus/packageTable'
import { lineFromCatalog } from '@/components/admin/quote-editor/useQuoteEditor'
import type { CatalogItem } from '@/app/api/admin/catalog-items/route'

// Emrah, 26 Ekim 2026: ofiste metraj tam pakete yuvarlansın, paket miktarı ve
// ölçüleri teklifte yazsın, Bonus ürün sayfasında kalınlığa göre paket listesi olsun.

describe('paket ve levha kuralı', () => {
  it('Bonus: paket içi adet listeden, ölçü listede yazan 60 × 120', () => {
    expect(resolvePackageSpec({ brandName: 'Bonus', materialSlug: 'tasyunu', modelShortName: 'Gold Plus 70', packageM2: 2.88, packagePieces: 4 }))
      .toEqual({ piecesPerPackage: 4, pieceLabel: 'levha', sizeLabel: '60 × 120 cm' })
  })

  it('Bonus: listede ölçüsü yazmayan levha alanında (0,96 m²) ölçü uydurmaz', () => {
    expect(resolvePackageSpec({ brandName: 'Bonus', materialSlug: 'tasyunu', modelShortName: 'F 120', packageM2: 2.88, packagePieces: 3 }))
      .toEqual({ piecesPerPackage: 3, pieceLabel: 'levha', sizeLabel: null })
  })

  it('Bonus şilte: rulo ve listedeki rulo ölçüsü', () => {
    expect(resolvePackageSpec({ brandName: 'Bonus', materialSlug: 'tasyunu', modelShortName: 'Endüstriyel Şilte 650', packageM2: 3, packagePieces: 1 }))
      .toEqual({ piecesPerPackage: 1, pieceLabel: 'rulo', sizeLabel: '100 × 300 cm' })
  })

  it('Filli taşyünü 60 × 100, EPS 50 × 100; adet paket m²\'sinden', () => {
    expect(resolvePackageSpec({ brandName: 'Optimix', materialSlug: 'tasyunu', packageM2: 1.2 }))
      .toEqual({ piecesPerPackage: 2, pieceLabel: 'levha', sizeLabel: '60 × 100 cm' })
    expect(resolvePackageSpec({ brandName: 'Dalmaçyalı', materialSlug: 'eps', packageM2: 2.5 }))
      .toEqual({ piecesPerPackage: 5, pieceLabel: 'levha', sizeLabel: '50 × 100 cm' })
  })

  it('bilinmeyen markada ya da geçersiz pakette sonuç yok', () => {
    expect(resolvePackageSpec({ brandName: 'TEKNO', materialSlug: 'tasyunu', packageM2: 1.8 })).toBeNull()
    expect(resolvePackageSpec({ brandName: 'Optimix', materialSlug: 'tasyunu', packageM2: 0 })).toBeNull()
  })

  it('belge notu', () => {
    const spec = resolvePackageSpec({ brandName: 'Bonus', materialSlug: 'tasyunu', modelShortName: 'Gold Plus 70', packageM2: 2.88, packagePieces: 4 })
    expect(formatPackageSpecNote(2.88, spec)).toBe('Paket: 4 levha · 2,88 m² · Levha 60 × 120 cm')
    expect(formatPackageSpecNote(2.88, null)).toBe('Paket: 2,88 m²')
    expect(formatPackageSpecNote(null, spec)).toBeNull()
  })
})

describe('metrajın tam pakete yuvarlanması', () => {
  it('1.200 m² Gold Plus 70 10 cm → 417 paket = 1.200,96 m²', () => {
    expect(roundAreaToPackages(1200, 2.88)).toEqual({ packageCount: 417, quantityM2: 1200.96 })
  })

  it('tam paket katı olan metraj büyümez (kayan nokta payı)', () => {
    expect(roundAreaToPackages(2496, 1.2)).toEqual({ packageCount: 2080, quantityM2: 2496 })
    expect(roundAreaToPackages(887, 2.88)?.packageCount).toBe(308)
  })

  it('ofis: katalogdan seçilen levha satırı yuvarlanmış miktar ve paket adedi taşır', () => {
    const item = {
      key: 'levha-61-10', kind: 'levha', id: 61, thicknessCm: 10, label: 'Bonus Gold Plus 70 10 cm', fullName: 'Bonus Gold Plus',
      brandName: 'Bonus', unit: 'm²', unitContent: null, packageM2: 2.88, packagePieces: 4, truckM2: 887, lorryM2: 483.8,
      netCost: 338.92, suggestedUnitPrice: 355.87, marginPct: 5, marginSource: 'marka', materialSlug: 'tasyunu', modelShortName: 'Gold Plus 70', isActive: true,
    } as CatalogItem
    const line = lineFromCatalog(item, 1200)
    expect(line.quantity).toBe(1200.96)
    expect(line.packageCount).toBe(417)
    expect(line.packageM2).toBe(2.88)
  })

  it('ofis: metraj değişince levha yeniden pakete yuvarlanır', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/admin/quote-editor/useQuoteEditor.ts'), 'utf8')
    expect(source).toMatch(/const rounded = l\.packageM2 \? roundAreaToPackages\(yeniAlanM2, l\.packageM2\) : null;/)
  })
})

describe('ürün sayfası paket bilgisi', () => {
  it('EPS levhada lojistik tablosundaki taşyünü adedini değil EPS levhasını gösterir', () => {
    const product = {
      brand: { name: 'Dalmaçyalı' },
      material_type: 'eps',
      model: 'İdeal Carbon',
      thickness_options: [10],
      thickness_prices: [{ thickness: 10, base_price: 1, is_kdv_included: false, discount_2: 0, stock_tuzla: 0, package_m2: 2.5 }],
    } as unknown as CatalogProductView
    const logistics = [{
      thickness: 100, items_per_package: 3, package_size_m2: 1.8, lorry_capacity_m2: 403.2, truck_capacity_m2: 748.8,
      lorry_capacity_packages: 224, truck_capacity_packages: 416, is_popular: true, notes: 'Levha boyutu: 600×1000mm, Paket içi: 3 adet',
    }]
    expect(resolvePlatePackageDetail(product, logistics, 10)).toMatchObject({ itemsPerPackage: 5, boardSizeLabel: '50 × 100 cm', packageM2: 2.5 })
  })

  it('Bonus kalınlık tablosu üretici listesinden; Gold Plus 90 paketi farklıdır', () => {
    const table = buildBonusPackageTable(['Gold Plus 70', 'Gold Plus 90'])
    expect(table['Gold Plus 70'].find((r) => r.thicknessCm === 10)).toEqual({
      thicknessCm: 10, packagePieces: 4, packageM2: 2.88, lorryPackages: 168, lorryM2: 483.8, truckPackages: 308, truckM2: 887,
    })
    expect(table['Gold Plus 90'].find((r) => r.thicknessCm === 10)).toMatchObject({ packagePieces: 3, packageM2: 2.16 })
    expect(JSON.stringify(table)).not.toMatch(/listPrices|Price/)
  })
})

describe('teklif PDF\'inde paket satırı', () => {
  const base: PDFQuoteData = {
    packageName: 'Ofis Teklifi', packageDescription: '', plateBrandName: 'Bonus', accessoryBrandName: '-', metraj: 1200.96,
    thickness: '10', materialType: 'tasyunu', materialLongName: 'Taşyünü', cityName: 'Kocaeli', grandTotal: 512852.8,
    pricePerM2: 355.87, totalProductCost: 427377.67, shippingCost: 0, priceWithoutVat: 427377.67, vatAmount: 85475.53,
    refCode: 'TE-2026-000999', validityDate: '29.10.2026', whatsappOrderLink: 'https://wa.me/905435186988?text=x',
    customerCompany: '', relatedPerson: 'Deneme', deliveryAddress: '', phone: '05321234567', email: '',
    systemDescription: 'Bonus Gold Plus 70 10 cm', shippingMode: 'included_in_sale_price',
    items: [{
      description: 'Bonus Gold Plus 70 10 cm', quantity: 1200.96, unit: 'm²', consumptionRate: 1, consumptionUnit: 'm²/m²',
      unitPrice: 355.87, totalPrice: 427377.67, isPlate: true, packageCount: 417,
      packageNote: 'Paket: 4 levha · 2,88 m² · Levha 60 × 120 cm', technicalNote: 'Yoğunluk: 70 kg/m³ · Föy beyanı',
    }],
  }
  const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gu, '').replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim()

  it('paket adedi, paket içeriği ve yoğunluk levha satırında bu sırayla yazar', () => {
    const parts = buildQuoteDocument(base, { qrDataUrl: 'data:image/png;base64,QR', issuedAt: new Date('2026-10-26T10:00:00+03:00') })
    const doc = text([parts.header, parts.context, ...parts.flow, parts.footer].join('\n'))
    expect(doc).toContain('Bonus Gold Plus 70 10 cm (417 PKT) Paket: 4 levha · 2,88 m² · Levha 60 × 120 cm Yoğunluk: 70 kg/m³ · Föy beyanı')
  })

  it('üç teklif yolu paket notunu belgeye taşır', () => {
    const src = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8')
    expect(src('app/ofis/tabs/quotes/QuoteBuilder.tsx')).toContain('packageNote: item\n')
    expect(src('components/catalog/SingleProductQuoteButton.tsx')).toContain('packageNote:     formatPackageSpecNote(effectivePackageSizeM2')
    expect(src('components/wizard/WizardCalculator.tsx')).toContain('packageNote: it.isPlate ? platePackageNote : null,')
    expect(src('lib/quote/buildManualPdfData.ts')).toContain('packageNote: l.packageNote ?? null,')
  })
})

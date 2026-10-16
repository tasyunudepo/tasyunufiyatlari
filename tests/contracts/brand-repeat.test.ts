import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { collapseRepeatedWords, joinBrandAndModel } from '@/lib/catalog/productLabel'
import { productLabelFromQuote } from '@/lib/pdf/orderConfirmation'
import { buildQuoteDocument } from '@/lib/pdf/quoteDocument'
import type { PDFQuoteData } from '@/lib/pdfGenerator'

// Marka adı ürün adında iki kez yazılmasın (Emrah, 16 Ekim 2026).
//
// Canlıda 48 sayfada marka çift yazılıyordu: "Optimix Optimix Karbonlu"
// (ürün sayfası başlığı, adres, katalog kartları, PDF), meta açıklamada
// "Expert Expert EPS 035 Beyaz", "TEKNO TEKNO GRENLİ BOYA BEYAZ". İki kaynak:
//   1) Ürün 42'nin kaydı: short_name'e marka da yazılmıştı. Kayıt düzeltildi.
//   2) Kod `${marka} ${ad}` diye düz birleştiriyordu; ürün adı (name) zaten
//      markayla başladığı için her ürün çiftleniyordu.
// Temmuz'daki düzeltme yalnız PDF tarafını kapatmıştı; yeni bir yüzey düz
// birleştirme yazınca tekrar geri geldi. Bu test o kapıyı kaynakta kapatır.

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

// Birleştirmenin tek yeri ve ekrana çıkmayan arama/eşleştirme metinleri.
const ALLOWED = new Set([
  'lib/catalog/productLabel.ts',
  'lib/brandFormat.ts',
  'lib/quote/searchCatalog.ts',
  'lib/importMatchers/shared.ts',
])

const TEMPLATE_JOIN = /\$\{[^}]*[bB]rand[^}]*\}\s+\$\{[^}]*(?:[nN]ame|[mM]odel)[^}]*\}/
const JSX_JOIN = /\{[\w.?]*[bB]rand[\w.?]*\}\s+\{[\w.?]*(?:[nN]ame|[mM]odel)[\w.?]*\}/

describe('marka + ürün adı tek yerden birleşir', () => {
  it('uygulama kodunda düz `${marka} ${ad}` birleştirmesi yok', () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => sourceFiles(join(repoRoot, dir)))
      .flatMap((file) => {
        const rel = relative(repoRoot, file)
        if (ALLOWED.has(rel)) return []
        return readFileSync(file, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, no: i + 1 }))
          .filter(({ line }) => !/^\s*(\/\/|\*)/.test(line) && (TEMPLATE_JOIN.test(line) || JSX_JOIN.test(line)))
          .map(({ line, no }) => `${rel}:${no}  ${line.trim()}`)
      })

    expect(offenders, 'joinBrandAndModel kullanın (lib/catalog/productLabel.ts)').toEqual([])
  })

  it('ürün adı markayla başlıyorsa marka bir kez yazılır', () => {
    expect(joinBrandAndModel('Optimix', 'Optimix Karbonlu')).toBe('Optimix Karbonlu')
    expect(joinBrandAndModel('Optimix', 'Karbonlu')).toBe('Optimix Karbonlu')
    expect(joinBrandAndModel('Optimix', 'Optimix TR7.5')).toBe('Optimix TR7.5')
    expect(joinBrandAndModel('Expert', 'Expert EPS 035 Beyaz')).toBe('Expert EPS 035 Beyaz')
    expect(joinBrandAndModel('TEKNO', 'TEKNO GRENLİ BOYA BEYAZ')).toBe('TEKNO GRENLİ BOYA BEYAZ')
    expect(joinBrandAndModel('Bonus', 'F 150 Pro')).toBe('Bonus F 150 Pro')
  })

  it('art arda tekrarlanan kelime teke iner, sayılar olduğu gibi kalır', () => {
    expect(collapseRepeatedWords('Optimix Optimix Karbonlu 5 cm EPS')).toBe('Optimix Karbonlu 5 cm EPS')
    expect(collapseRepeatedWords('Fawori Optimix Optimix Karbonlu')).toBe('Fawori Optimix Karbonlu')
    expect(collapseRepeatedWords('optimix Optimix Karbonlu')).toBe('optimix Karbonlu')
    expect(collapseRepeatedWords('Optimix Optimix Karbonlu (12 PKT)')).toBe('Optimix Karbonlu (12 PKT)')
    expect(collapseRepeatedWords('5 5 cm')).toBe('5 5 cm')
    expect(collapseRepeatedWords('Bonus F 150 Pro')).toBe('Bonus F 150 Pro')
    expect(collapseRepeatedWords(undefined)).toBeUndefined()
  })

  it('eski teklif kaydından üretilen Sipariş Onay Formu adı tek yazar', () => {
    expect(
      productLabelFromQuote({ brand_name: 'Optimix', model_name: 'Optimix Optimix Karbonlu', material_type: 'eps', thickness_cm: 5 }),
    ).toBe('Optimix Karbonlu EPS 5 cm')
  })

  it('teklif PDF\'i tekrarlı kalem adını tek yazar', () => {
    const data: PDFQuoteData = {
      packageName: 'Optimix Optimix Karbonlu',
      packageDescription: '',
      plateBrandName: 'Optimix Optimix Karbonlu',
      accessoryBrandName: '',
      metraj: 840,
      thickness: '8',
      materialType: 'eps',
      materialLongName: 'Karbonlu EPS',
      cityName: 'İstanbul',
      grandTotal: 249208,
      pricePerM2: 247.23,
      totalProductCost: 207673,
      shippingCost: 0,
      priceWithoutVat: 207673,
      vatAmount: 41535,
      refCode: 'TE-2026-000999',
      validityDate: '19.10.2026',
      whatsappOrderLink: 'https://wa.me/905435186988?text=Merhaba',
      customerCompany: '',
      relatedPerson: 'Test',
      deliveryAddress: '',
      phone: '05555555555',
      email: '',
      systemDescription: 'Optimix Optimix Karbonlu EPS 8cm',
      shippingMode: 'included_in_sale_price',
      items: [
        {
          description: 'Optimix Optimix Karbonlu 8 cm EPS',
          quantity: 840,
          unit: 'm²',
          consumptionRate: 1,
          consumptionUnit: 'm²/m²',
          unitPrice: 247.23,
          totalPrice: 207673,
          isPlate: true,
        },
      ],
    }

    const parts = buildQuoteDocument(data, { qrDataUrl: 'data:image/png;base64,QR' })
    const html = [parts.header, parts.context, ...parts.flow, parts.footer].join('\n')
    expect(html).toContain('Optimix Karbonlu 8 cm EPS')
    expect(html).not.toMatch(/optimix\s+optimix/i)
  })
})

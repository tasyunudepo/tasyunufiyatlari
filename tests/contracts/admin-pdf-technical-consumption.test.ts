import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { lineFromAccessorySet } from '@/components/admin/quote-editor/useQuoteEditor'
import { buildAccessorySet } from '@/lib/quote/buildAccessorySet'
import { buildManualPdfData } from '@/lib/quote/buildManualPdfData'
import { manualQuoteLineSchema } from '@/lib/schemas/manualQuote.schema'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function source(path: string) {
  return readFileSync(`${repoRoot}${path}`, 'utf8')
}

function teknoYapistiriciSeti() {
  return buildAccessorySet({
    accessoryTypes: [
      {
        id: 1,
        name: 'Yapıştırıcı',
        slug: 'yapistirici',
        sort_order: 1,
        consumption_rate_tasyunu: 6,
        consumption_rate_eps: 4,
      },
    ],
    accessories: [
      {
        id: 77,
        name: 'TEKNOİZOFİX',
        short_name: null,
        brand_id: 6,
        accessory_type_id: 1,
        base_price: 247.17,
        discount_1: 40,
        discount_2: 5,
        is_kdv_included: false,
        unit: 'PKT',
        unit_content: 25,
        is_for_eps: false,
        is_for_tasyunu: true,
        is_active: true,
      },
    ],
    accessoryBrandId: 6,
    accessoryBrandName: 'TEKNO',
    materialType: 'tasyunu',
    areaM2: 2000,
    marginPct: 5,
    city: null,
  })
}

describe('admin özel teklif → PDF teknik sarfiyat sözleşmesi', () => {
  it('toz grubu seti teknik sarfiyatın fiziksel birimini editör satırına taşır', () => {
    const item = teknoYapistiriciSeti().items[0]
    expect(item).toMatchObject({
      quantity: 480,
      consumptionRate: 6,
      consumptionUnit: 'kg/m²',
    })

    const editorLine = lineFromAccessorySet(item)
    expect(editorLine.consumptionUnit).toBe('kg/m²')

    const parsedLine = manualQuoteLineSchema.parse(editorLine)
    expect(parsedLine.consumptionUnit).toBe('kg/m²')
  })

  it('manuel PDF hazırlayıcısı levha ve TEKNO sarfiyatını sıfırlamaz', () => {
    const accessoryLine = lineFromAccessorySet(teknoYapistiriciSeti().items[0])
    const pdf = buildManualPdfData({
      quoteCode: 'TE-TEST',
      customerName: 'Test Müşteri',
      customerPhone: '05550000000',
      cityName: 'Artvin',
      materialType: 'tasyunu',
      areaM2: 2000,
      validityDays: 7,
      lines: [
        {
          description: 'Bonus F 120 10 cm',
          quantity: 2000,
          unit: 'm²',
          unitPrice: 699.86,
          isPlate: true,
        },
        accessoryLine,
      ],
      discountPct: 0,
      shippingCharge: 0,
      totals: {
        linesNet: 1_470_726.4,
        discountAmount: 0,
        priceWithoutVat: 1_470_726.4,
        vatAmount: 294_145.28,
        totalPrice: 1_764_871.68,
      },
    })

    expect(pdf.items.slice(0, 2)).toMatchObject([
      { consumptionRate: 1, consumptionUnit: 'm²/m²' },
      { consumptionRate: 6, consumptionUnit: 'kg/m²' },
    ])
  })

  it('istemci payloadı ve sunucu kaydı birimi düşürmez', () => {
    const builder = source('app/ofis/tabs/quotes/QuoteBuilder.tsx')
    const route = source('app/api/admin/quotes/manual/route.ts')
    const duplicate = source('components/admin/quote-editor/QuoteDuplicateDialog.tsx')

    expect(builder).toContain('consumptionUnit: l.consumptionUnit ?? null')
    expect(route).toContain('consumptionUnit: l.consumptionUnit ?? null')
    expect(duplicate).toContain(
      'consumptionUnit: k.consumptionUnit ?? null',
    )
  })
})

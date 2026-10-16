import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { LEAD_TIME_LABEL, LEAD_TIME_NOTE, LEAD_TIME_SCOPE, LEAD_TIME_SHORT, showsLeadTime } from '@/lib/sales/leadTime'

// Termin süresi (Emrah, 16 Ekim 2026): "Taşyününde termin süresi: 7–21 gün", altında "çoğunlukla 1 haftada
// teslim edilir". Bu, sitede izin verilen tek teslim süresi cümlesidir; başka süre sözü (dakika, saat, aynı gün)
// customer-promises sözleşmesiyle yasak kalır. Cümle bileşenlere yazılmaz, tek sabitten okunur.

describe('termin süresi', () => {
  it('Emrah\'ın cümlesiyle aynıdır', () => {
    expect(LEAD_TIME_LABEL).toBe('Termin süresi: 7–21 gün')
    expect(LEAD_TIME_SHORT).toBe('Termin 7–21 gün')
    expect(LEAD_TIME_NOTE).toBe('Çoğunlukla 1 hafta içinde teslim edilir.')
    expect(LEAD_TIME_SCOPE).toBe('Sipariş onayından teslime kadar.')
  })

  it('yalnız taşyünü ürünlerinde gösterilir', () => {
    expect(showsLeadTime('tasyunu')).toBe(true)
    expect(showsLeadTime('eps')).toBe(false)
    expect(showsLeadTime(undefined)).toBe(false)
  })

  it.each([
    'components/catalog/StandardPlateCommercialHeader.tsx',
    'components/catalog/ProductPricePanel.tsx',
    'components/catalog/BonusRegionPrice.tsx',
    'lib/pdf/quoteDocument.ts',
  ])('%s cümleyi elle yazmaz, sabitten okur', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')
    expect(source).toContain('@/lib/sales/leadTime')
    expect(source).not.toMatch(/7\s*[–-]\s*21\s*gün/u)
  })
})

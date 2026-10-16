import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildOrderConfirmationModel } from '@/lib/pdf/orderConfirmation'
import { LEAD_TIME_FAQ, LEAD_TIME_LABEL, LEAD_TIME_NOTE, LEAD_TIME_SCOPE, LEAD_TIME_SHORT, showsLeadTime } from '@/lib/sales/leadTime'

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
    'lib/pdf/orderConfirmation.ts',
    'components/home/HomePageClient.tsx',
    'components/wizard/WizardCalculator.tsx',
    'components/catalog/BonusPurchaseExperience.tsx',
    'components/home/HomepageCalculationResult.tsx',
    'lib/compare/hubCopy.ts',
  ])('%s cümleyi elle yazmaz, sabitten okur', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')
    expect(source).toContain('@/lib/sales/leadTime')
    expect(source).not.toMatch(/7\s*[–-]\s*21\s*gün/u)
  })

  it('soru-cevap cümlesi tam ve tek parçadır', () => {
    expect(LEAD_TIME_FAQ.q).toBe('Taşyünü siparişi kaç günde teslim edilir?')
    expect(LEAD_TIME_FAQ.a).toBe(
      'Termin süresi sipariş onayından teslime 7–21 gündür. Çoğunlukla 1 hafta içinde teslim edilir. Yükleme tarihi fabrika uygunluğuna göre bildirilir.',
    )
  })

  it('Sipariş Onay Formu: taşyününde sevkiyat planı termini yazar, EPS\'te yazmaz', () => {
    const base = { quoteCode: 'T-1', customerName: 'Deneme', cityName: 'İstanbul', productLabel: 'Bonus F 150 Taşyünü 5 cm', areaM2: 967.68, totalPrice: 429684.76, issuedAt: new Date('2026-10-16T12:00:00+03:00') }
    const plan = (materialType: string) => buildOrderConfirmationModel({ ...base, materialType }).steps.find((s) => s.title === 'Sevkiyat planı')?.detail ?? ''
    expect(plan('tasyunu')).toBe('Termin süresi: 7–21 gün (sipariş onayından teslime). Çoğunlukla 1 hafta içinde teslim edilir. Yükleme tarihi fabrika uygunluğuna göre bildirilir.')
    expect(plan('eps')).toBe('Yükleme tarihi fabrika uygunluğuna göre bildirilir.')
  })
})

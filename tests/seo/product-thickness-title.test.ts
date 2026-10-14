import { describe, expect, it } from 'vitest'

import { productThicknessTitle } from '@/lib/seo/productThicknessTitle'

// 14 Ekim 2026 (Emrah onayı): ürün kalınlık sayfası ürün adıyla başlar; genel "N cm taş yünü fiyatları"
// araması kalınlık hub'ının. SW035 hub'lar Google'a girene kadar eski başlıkta (Faz 5).

const base = { kategori: 'tasyunu-levha', thicknessCm: 10, searchLabel: 'Taş Yünü', monthYear: 'Ekim 2026' }

describe('ürün kalınlık başlığı', () => {
  it('150 föy beyanlı ürün: ürün adı + kalınlık + 150 yoğunluk', () => {
    expect(productThicknessTitle({ ...base, slug: 'expert-hd150-tasyunu', productName: 'Expert HD150', model: 'HD150' }))
      .toBe('Expert HD150 10 cm 150 Yoğunluk Taş Yünü Fiyatı - Ekim 2026')
    expect(productThicknessTitle({ ...base, slug: 'bonus-f-150-tasyunu', productName: 'Bonus Premium F 150 Taşyünü Isı Yalıtım Levhası', model: 'F 150' }))
      .toBe('Bonus Premium F 150 10 cm 150 Yoğunluk Taş Yünü Fiyatı - Ekim 2026')
  })

  it('120 föy beyanlı ürün yoğunluğu taşır; sözlü beyanlı ürün taşımaz', () => {
    expect(productThicknessTitle({ ...base, slug: 'bonus-f-120-tasyunu', productName: 'Bonus Premium F 120', model: 'F 120' }))
      .toBe('Bonus Premium F 120 10 cm 120 Yoğunluk Taş Yünü Fiyatı - Ekim 2026')
    expect(productThicknessTitle({ ...base, slug: 'optimix-tr7-5-tasyunu', productName: 'Optimix TR7.5', model: 'TR7.5' }))
      .toBe('Fawori Optimix TR7.5 10 cm Taş Yünü Fiyatı - Ekim 2026')
  })

  it('SW035 ve EPS eski başlıkta kalır', () => {
    expect(productThicknessTitle({ ...base, slug: 'dalmacyali-sw035-tasyunu', productName: 'Dalmaçyalı SW035', model: 'SW035' }))
      .toBe('10 cm Taş Yünü Fiyatları - Ekim 2026 | Dalmaçyalı SW035')
    expect(productThicknessTitle({ ...base, kategori: 'eps-levha', searchLabel: 'EPS', slug: 'x', productName: 'Dalmaçyalı Ideal Carbon', model: null }))
      .toBe('10 cm EPS Fiyatları - Ekim 2026 | Dalmaçyalı Ideal Carbon')
  })
})

describe('ürün meta başlığı düzeltmeleri', () => {
  it('veritabanı başlığındaki site adı tekrarı kalkar', async () => {
    const { stripSiteSuffix } = await import('@/lib/seo/productThicknessTitle')
    expect(stripSiteSuffix('Bonus Endüstriyel Şilte — Rabitz Telli | Taşyünü Fiyatları')).toBe('Bonus Endüstriyel Şilte — Rabitz Telli')
    expect(stripSiteSuffix('Optimix TR7.5 Taşyünü Levha Fiyatları')).toBe('Optimix TR7.5 Taşyünü Levha Fiyatları')
    expect(stripSiteSuffix(null)).toBeNull()
  })

  it('rabitz telli şilte "Rulo Taşyünü Şilte" başlığıyla, teklif ile', async () => {
    const { PRODUCT_META_OVERRIDES } = await import('@/lib/seo/productThicknessTitle')
    const silte = PRODUCT_META_OVERRIDES['bonus-endustriyel-silte-tasyunu']
    expect(silte.title).toMatch(/^Rulo Taşyünü Şilte/u)
    expect(silte.description).toContain('teklif ile')
  })
})

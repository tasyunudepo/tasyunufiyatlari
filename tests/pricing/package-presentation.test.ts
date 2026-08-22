import { describe, expect, it } from 'vitest'

import {
  getPackageTierDescriptor,
  getTierGridClass,
} from '@/lib/pricing/packagePresentation'
import type { CalculatedPackage } from '@/lib/types'

const packageFixture = (
  id: number,
  name: string,
  tier: string,
  totalProductCost: number,
  itemBrands: string[],
  description = '',
): CalculatedPackage => ({
  definition: {
    id,
    plate_brand_id: id,
    accessory_brand_id: id,
    tier,
    name,
    description,
    badge: null,
    sort_order: id,
    warranty_years: 0,
  },
  plateBrandName: itemBrands[0] || '',
  accessoryBrandName: itemBrands[1] || itemBrands[0] || '',
  items: itemBrands.map((brandName, index) => ({
    name: `${brandName} ürün ${index + 1}`,
    shortName: `Ürün ${index + 1}`,
    brandName,
    quantity: 1,
    unit: 'adet',
    unitPrice: 1,
    totalPrice: 1,
    isPlate: index === 0,
  })),
  totalProductCost,
  shippingCost: 0,
  grandTotal: totalProductCost,
  pricePerM2: totalProductCost,
})

describe('Ana sayfa sistem alternatifi sunumu', () => {
  it('iki ve üç mevcut alternatif için boş kolon bırakmayan ızgara üretir', () => {
    expect(getTierGridClass(2)).toContain('grid-cols-2')
    expect(getTierGridClass(2)).not.toContain('sm:grid-cols-3')
    expect(getTierGridClass(3)).toContain('sm:grid-cols-3')
  })

  it('dengeli paketin gerçek iş kuralı açıklamasını verir', () => {
    const balanced = packageFixture(2, 'Dengeli Sistem', 'performance', 300_000, ['Dalmaçyalı', 'Optimix'])
    expect(getPackageTierDescriptor(balanced, [balanced])).toBe('Fiyat / performans kombinasyonu')
  })

  it('aynı markalı orijinal reçeteyi yalnız gerçek kalem markaları aynıysa böyle niteler', () => {
    const original = packageFixture(1, 'Orijinal Sistem', 'premium', 400_000, ['Dalmaçyalı', 'Dalmaçyalı'])
    const mixedPremium = packageFixture(
      2,
      'Premium Sistem',
      'premium',
      390_000,
      ['Bonus', 'Expert'],
      'Bonus levha + Expert toz grubu',
    )

    expect(getPackageTierDescriptor(original, [original])).toBe('Aynı marka sistem bütünlüğü')
    expect(getPackageTierDescriptor(mixedPremium, [mixedPremium])).toBe('Bonus levha + Expert toz grubu')
  })

  it('en düşük maliyet açıklamasını yalnız gerçekten en ucuz pakete verir', () => {
    const economic = packageFixture(1, 'Ekonomik Sistem', 'eco', 280_000, ['Dalmaçyalı', 'TEKNO'])
    const balanced = packageFixture(2, 'Dengeli Sistem', 'performance', 300_000, ['Dalmaçyalı', 'Optimix'])
    expect(getPackageTierDescriptor(economic, [economic, balanced])).toBe('En düşük toplam maliyet')

    const anomalousEconomic = packageFixture(
      3,
      'Ekonomik Sistem',
      'eco',
      320_000,
      ['Dalmaçyalı', 'TEKNO'],
      'Dalmaçyalı levha + Ekonomik aksesuarlar',
    )
    expect(getPackageTierDescriptor(anomalousEconomic, [anomalousEconomic, balanced])).toBe(
      'Dalmaçyalı levha + Ekonomik aksesuarlar',
    )
  })
})

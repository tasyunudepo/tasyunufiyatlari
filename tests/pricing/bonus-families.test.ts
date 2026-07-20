import { describe, expect, it } from 'vitest'

import {
  getBonusFamily,
  getBonusFamilyVariant,
  isUnpricedBonusModel,
} from '@/lib/pricing/bonus/families'
import { computeBonusUnitSale, computeBonusCapacity } from '@/lib/pricing/bonus/sale'
import { getProfileByModel } from '@/lib/technical-profiles'
import { getBonusPriceRows } from '@/lib/pricing/bonus/regionPricing'

// 20 Temmuz kararı: aile başına tek PDP + yoğunluk seçici.
// Bu test seçicinin veri sözleşmesini fiyat motoruna bağlar.

describe('Bonus aile varyantları — veri sözleşmesi', () => {
  it('her varyant modeli teknik profil havuzunda ve fiyat listesinde vardır', () => {
    for (const head of ['Gold Plus 50', 'Gold Black 50', 'Gold Yellow 50', 'Endüstriyel Levha 70', 'Endüstriyel Şilte 650']) {
      const family = getBonusFamily(head)
      expect(family, head).not.toBeNull()
      for (const v of family!.variants) {
        const profile = getProfileByModel(v.modelShortName)
        expect(profile, v.modelShortName).not.toBeNull()
        expect(profile!.brandName).toBe('Bonus')
        const rows = getBonusPriceRows(profile!.productKey)
        expect(rows, v.modelShortName).not.toBeNull()
        // Seçicideki kalınlık listesi fiyat listesindeki satırlarla birebir
        const priceThicknessCm = rows!.map((r) => r.thicknessMm / 10).sort((a, b) => a - b)
        expect(v.thicknessCmOptions, v.modelShortName).toEqual(priceThicknessCm)
      }
    }
  })

  it('Gold Alu tek varyantlıdır (seçici çıkmaz)', () => {
    expect(getBonusFamily('Gold Alu 50')).toBeNull()
    expect(getBonusFamilyVariant('Gold Alu 50')).toBeNull()
  })

  it('fiyatsız modeller işaretli, fiyatlılar değil', () => {
    for (const m of ['Desibel', 'Kapı Paneli', 'Panel', 'Marin']) {
      expect(isUnpricedBonusModel(m), m).toBe(true)
    }
    for (const m of ['Gold Plus 50', 'Premium F', 'Endüstriyel Şilte 650', 'F 150']) {
      expect(isUnpricedBonusModel(m), m).toBe(false)
    }
  })

  it('varyant değişimi fiyat motorundan uçtan uca fiyat üretir (Gold Plus 70, Bolu)', () => {
    // s.51 görüntüsünden doğrulandı: Gold Plus 70, 50 mm, 1. Bölge liste
    // 179,27 → taban 161,34 (%10 iskonto) → %5 marj = 169,41
    const sale = computeBonusUnitSale({
      modelShortName: 'Gold Plus 70',
      thicknessCm: 5,
      cityCode: 14,
      brandMarginPct: 5,
    })
    expect(sale.ok).toBe(true)
    if (sale.ok) {
      expect(sale.region).toBe(1)
      expect(sale.salePricePerM2).toBeCloseTo(169.41, 2)
      expect(sale.packagePieces).toBe(8)
    }
  })

  it('rabitz telli şilte kapasitesi paket=1 rulo yapısıyla döner', () => {
    const cap = computeBonusCapacity({ modelShortName: 'Endüstriyel Şilte 650', thicknessCm: 5 })
    expect(cap.ok).toBe(true)
    if (cap.ok) {
      expect(cap.packagePieces).toBe(1)
      expect(cap.packageM2).toBe(5)
      expect(cap.kamyonM2).toBe(1200)
    }
  })

  it('varyantın olmayan kalınlığı fail-closed reddedilir (Gold Plus 90, 20 cm)', () => {
    const sale = computeBonusUnitSale({
      modelShortName: 'Gold Plus 90',
      thicknessCm: 20,
      cityCode: 14,
      brandMarginPct: 5,
    })
    expect(sale).toEqual({ ok: false, reason: 'thickness_unavailable' })
  })
})

import { describe, expect, it } from 'vitest'

import { computeBonusUnitSale } from '@/lib/pricing/bonus/sale'

// Golden değerler: BONUS FİYAT LİSTESİ Haziran 2026 + Tur 4 kararları
// (taban = liste × 0,90; Bonus marka marjı %5).

describe('Bonus levha birim satış hesabı', () => {
  it('F 150 / 5 cm / İstanbul-Avrupa / %5 marj → 370,03 TL/m² (KDV hariç)', () => {
    const result = computeBonusUnitSale({
      modelShortName: 'F 150',
      thicknessCm: 5,
      cityCode: 34,
      subChoice: 'avrupa',
      brandMarginPct: 5,
    })
    expect(result).toEqual({
      ok: true,
      region: 3,
      thicknessMm: 50,
      salePricePerM2: 370.03,
      // Net alış = bölge listesi × 0,90. /ofis kâr göstergesi bunu kullanır;
      // public rota (app/api/bonus-price) bu alanı DÖNDÜRMEZ — beyaz liste
      // kilidi `tests/contracts/bonus-price-privacy.test.ts` içinde.
      netCostPerM2: 352.41,
      packageM2: 2.88,
      packagePieces: 4,
      kamyonM2: 967.7,
      tirM2: 1774.1,
    })
  })

  it('Kocaeli/Gebze 2. bölgeden, Kocaeli-diğer 1. bölgeden fiyatlanır', () => {
    const gebze = computeBonusUnitSale({
      modelShortName: 'F 120',
      thicknessCm: 5,
      cityCode: 41,
      subChoice: 'gebze',
      brandMarginPct: 5,
    })
    const diger = computeBonusUnitSale({
      modelShortName: 'F 120',
      thicknessCm: 5,
      cityCode: 41,
      subChoice: 'diger',
      brandMarginPct: 5,
    })
    expect(gebze.ok && diger.ok).toBe(true)
    if (gebze.ok && diger.ok) {
      // 2. bölge (308,66) > 1. bölge (299,48); satış = liste × 0,90 × 1,05
      expect(gebze.salePricePerM2).toBe(291.68)
      expect(diger.salePricePerM2).toBe(283.01)
    }
  })

  it('alt-bölge seçilmeden İstanbul fiyat üretmez', () => {
    const result = computeBonusUnitSale({
      modelShortName: 'F 150',
      thicknessCm: 5,
      cityCode: 34,
      subChoice: null,
      brandMarginPct: 5,
    })
    expect(result).toEqual({ ok: false, reason: 'sub_region_required' })
  })

  it('listede olmayan kalınlık fiyat üretmez (F 150 Pro 3 cm yok)', () => {
    const result = computeBonusUnitSale({
      modelShortName: 'F 150 Pro',
      thicknessCm: 3,
      cityCode: 6,
      brandMarginPct: 5,
    })
    expect(result).toEqual({ ok: false, reason: 'thickness_unavailable' })
  })

  it('marka marjı yoksa fiyat üretilmez (fail-closed)', () => {
    const result = computeBonusUnitSale({
      modelShortName: 'F 150',
      thicknessCm: 5,
      cityCode: 6,
      brandMarginPct: null,
    })
    expect(result).toEqual({ ok: false, reason: 'margin_unavailable' })
  })

  it('Bonus dışı model bu hesaba giremez', () => {
    expect(
      computeBonusUnitSale({ modelShortName: 'SW035', thicknessCm: 5, cityCode: 6, brandMarginPct: 5 }),
    ).toEqual({ ok: false, reason: 'not_bonus' })
    expect(
      computeBonusUnitSale({ modelShortName: 'YOK', thicknessCm: 5, cityCode: 6, brandMarginPct: 5 }),
    ).toEqual({ ok: false, reason: 'unknown_model' })
  })

  it('başarılı sonuç liste/taban fiyat veya iskonto alanı sızdırmaz', () => {
    const result = computeBonusUnitSale({
      modelShortName: 'F 150',
      thicknessCm: 5,
      cityCode: 6,
      brandMarginPct: 5,
    })
    expect(result.ok).toBe(true)
    const keys = Object.keys(result)
    for (const forbidden of ['listPrice', 'basePrice', 'discount', 'marginPct']) {
      expect(keys.join(',')).not.toContain(forbidden)
    }
  })
})

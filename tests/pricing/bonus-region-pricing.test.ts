import { describe, expect, it } from 'vitest'

import data from '@/lib/pricing/bonus/bonus-region-prices.json'
import {
  BONUS_DISCOUNT_PCT,
  citySubRegionQuestion,
  getBonusBasePrice,
  getBonusListPrice,
  getBonusPriceRows,
  getBonusProductKeys,
  resolveBonusRegion,
} from '@/lib/pricing/bonus/regionPricing'
import { applyMargin, resolveBrandMarginPctStrict } from '@/lib/pricing/margin'
import { getProfileByKey } from '@/lib/technical-profiles'

// Kaynak: BONUS FİYAT LİSTESİ Haziran 2026 (s.57-61 fiyatlar, s.83 bölge
// haritası) + Bonus İskonto Listesi (taşyünü %10). Golden değerler PDF
// sayfa görüntülerinden elle doğrulanmıştır — karar günlüğü Tur 4.

describe('veri bütünlüğü — doğrulanmış seed', () => {
  it('23 Bonus ürünü ve beklenen satır sayıları', () => {
    // İlk üçü 13 Temmuz elle doğrulanmış çekirdek; kalanı 20 Temmuz
    // genişletmesi (pdftotext -layout çıkarımı, çekirdekle altın test).
    expect(getBonusProductKeys()).toEqual([
      'bonus-premium-f-150',
      'bonus-premium-f-120',
      'bonus-premium-f-150-pro',
      'bonus-gold-plus-50',
      'bonus-gold-black-50',
      'bonus-gold-yellow-50',
      'bonus-gold-alu-50',
      'bonus-gold-plus-70',
      'bonus-gold-black-70',
      'bonus-gold-yellow-70',
      'bonus-gold-black-90',
      'bonus-gold-plus-90',
      'bonus-premium-f',
      'bonus-premium-r',
      'bonus-premium-r-150',
      'bonus-platin-110',
      'bonus-private-70',
      'bonus-endustriyel-levha-70',
      'bonus-endustriyel-levha-110',
      'bonus-endustriyel-silte-650',
      'bonus-endustriyel-silte-700',
      'bonus-endustriyel-silte-720',
      'bonus-endustriyel-silte-750',
    ])
    expect(getBonusPriceRows('bonus-premium-f-150')).toHaveLength(13)
    expect(getBonusPriceRows('bonus-premium-f-120')).toHaveLength(12)
    expect(getBonusPriceRows('bonus-premium-f-150-pro')).toHaveLength(8)
    expect(getBonusPriceRows('bonus-gold-plus-50')).toHaveLength(10)
    expect(getBonusPriceRows('bonus-premium-f')).toHaveLength(11)
    expect(getBonusPriceRows('bonus-endustriyel-silte-650')).toHaveLength(8)
  })

  it('genişletme golden satırları — sayfa görüntüsünden elle doğrulandı', () => {
    // s.53 Gold Yellow 70, 30 mm ve 150 mm satırları
    const gy70 = getBonusPriceRows('bonus-gold-yellow-70')!
    expect(gy70[0]).toEqual({
      thicknessMm: 30,
      packagePieces: 12,
      packageM2: 8.64,
      truckPackages: 192,
      truckM2: 1658.9,
      trailerPackages: 352,
      trailerM2: 3041.3,
      listPricesByRegion: [149.66, 154.92, 161.49, 168.07, 179.25, 191.09, 205.55],
    })
    expect(gy70[gy70.length - 1].listPricesByRegion).toEqual([
      576.67, 604.73, 639.8, 674.88, 734.5, 797.63, 874.79,
    ])
    // s.73 Endüstriyel Şilte 650 (rabitz telli), 30 mm ve 120 mm bölge uçları
    const silte = getBonusPriceRows('bonus-endustriyel-silte-650')!
    expect(silte[0].listPricesByRegion[0]).toBe(254.02)
    expect(silte[0].listPricesByRegion[6]).toBe(305.23)
    expect(silte[silte.length - 1].listPricesByRegion[0]).toBe(587.58)
    expect(silte[silte.length - 1].listPricesByRegion[6]).toBe(724.13)
  })

  it('her ürün anahtarı teknik profil havuzunda vardır', () => {
    for (const key of getBonusProductKeys()) {
      expect(getProfileByKey(key), key).not.toBeNull()
    }
  })

  it('her satırda 7 bölge fiyatı vardır ve bölgeler batıdan doğuya artar', () => {
    for (const product of data.products) {
      for (const row of product.rows) {
        expect(row.listPricesByRegion, `${product.productKey} ${row.thicknessMm}mm`).toHaveLength(7)
        for (let i = 1; i < 7; i++) {
          expect(
            row.listPricesByRegion[i],
            `${product.productKey} ${row.thicknessMm}mm bölge ${i + 1}`,
          ).toBeGreaterThan(row.listPricesByRegion[i - 1])
        }
      }
    }
  })

  it('kalınlıklar ürün içinde tekildir', () => {
    for (const product of data.products) {
      const thicknesses = product.rows.map((r) => r.thicknessMm)
      expect(new Set(thicknesses).size).toBe(thicknesses.length)
    }
  })

  it('81 ilin tamamı haritada: 79 doğrudan + İstanbul ve Kocaeli alt-bölgeli', () => {
    const entries = Object.entries(data.regionsByCityCode)
    expect(entries).toHaveLength(81)
    const direct = entries.filter(([, v]) => v !== null)
    const special = entries.filter(([, v]) => v === null).map(([k]) => k)
    expect(direct).toHaveLength(79)
    expect(special.sort()).toEqual(['34', '41'])
    for (const [code, region] of direct) {
      expect(region, `plaka ${code}`).toBeGreaterThanOrEqual(1)
      expect(region, `plaka ${code}`).toBeLessThanOrEqual(7)
    }
  })
})

describe('bölge çözümü — İstanbul yakası ve Kocaeli/Gebze kararı', () => {
  it.each([
    [14, 'Bolu', 1],
    [16, 'Bursa', 2],
    [6, 'Ankara', 3],
    [35, 'İzmir', 3],
    [7, 'Antalya', 4],
    [33, 'Mersin', 5],
    [61, 'Trabzon', 5],
    [25, 'Erzurum', 6],
    [65, 'Van', 7],
    [81, 'Düzce', 1],
  ])('plaka %d (%s) → %d. bölge', (code, _name, region) => {
    expect(resolveBonusRegion(code)).toBe(region)
  })

  it('İstanbul yakaya göre çözülür: Avrupa 3, Anadolu 2', () => {
    expect(resolveBonusRegion(34, 'avrupa')).toBe(3)
    expect(resolveBonusRegion(34, 'anadolu')).toBe(2)
  })

  it('Kocaeli Gebze ayrımıyla çözülür: Gebze 2, diğer 1', () => {
    expect(resolveBonusRegion(41, 'gebze')).toBe(2)
    expect(resolveBonusRegion(41, 'diger')).toBe(1)
  })

  it('alt-bölge seçilmeden İstanbul/Kocaeli fiyat bölgesi ÜRETMEZ (fail-closed)', () => {
    expect(resolveBonusRegion(34)).toBeNull()
    expect(resolveBonusRegion(34, null)).toBeNull()
    expect(resolveBonusRegion(41)).toBeNull()
  })

  it('bilinmeyen plaka ve geçersiz seçim null döner', () => {
    expect(resolveBonusRegion(99)).toBeNull()
    expect(resolveBonusRegion(0)).toBeNull()
    expect(resolveBonusRegion(6, 'gebze')).toBe(3) // alt-bölgesiz şehirde seçim yok sayılır
  })

  it('alt-bölge sorusu yalnız İstanbul ve Kocaeli için tanımlıdır', () => {
    expect(citySubRegionQuestion(34)?.question).toBe('yaka')
    expect(citySubRegionQuestion(41)?.question).toBe('gebze')
    expect(citySubRegionQuestion(6)).toBeNull()
  })
})

describe('golden fiyatlar — PDF sayfasından elle doğrulanmış', () => {
  it('iskonto sabiti %10', () => {
    expect(BONUS_DISCOUNT_PCT).toBe(10)
  })

  it('F 150 / 50 mm / 3. Bölge (İstanbul-Avrupa): liste 391,57 → taban 352,41', () => {
    expect(getBonusListPrice('bonus-premium-f-150', 50, 3)).toBe(391.57)
    expect(getBonusBasePrice('bonus-premium-f-150', 50, 3)).toBe(352.41)
  })

  it('F 120 / 30 mm / 1. Bölge: liste 201,57 → taban 181,41', () => {
    expect(getBonusListPrice('bonus-premium-f-120', 30, 1)).toBe(201.57)
    expect(getBonusBasePrice('bonus-premium-f-120', 30, 1)).toBe(181.41)
  })

  it('F 150 Pro / 150 mm / 7. Bölge: liste 1.365,94 → taban 1.229,35', () => {
    expect(getBonusListPrice('bonus-premium-f-150-pro', 150, 7)).toBe(1365.94)
    expect(getBonusBasePrice('bonus-premium-f-150-pro', 150, 7)).toBe(1229.35)
  })

  it('F 150 / 20 mm / 1. Bölge ve 7. Bölge uç değerleri', () => {
    expect(getBonusListPrice('bonus-premium-f-150', 20, 1)).toBe(220.54)
    expect(getBonusListPrice('bonus-premium-f-150', 20, 7)).toBe(265.26)
  })

  it('yarım kuruş durumu PostgreSQL ile aynı yuvarlanır: 224,75 × 0,90 = 202,28', () => {
    // Float sapması 202,27 üretir; tamsayı kuruş aritmetiği 202,28 vermelidir.
    expect(getBonusBasePrice('bonus-premium-f-150', 20, 2)).toBe(202.28)
  })

  it('listede olmayan kalınlık/bölge fiyat üretmez', () => {
    expect(getBonusListPrice('bonus-premium-f-150-pro', 90, 3)).toBeNull()
    expect(getBonusListPrice('bonus-premium-f-150', 50, 8)).toBeNull()
    expect(getBonusListPrice('bilinmeyen-urun', 50, 3)).toBeNull()
  })
})

describe('marka öncelikli marj — yalnız Bonus %5 kararı', () => {
  const materialRule = {
    slug: 'tasyunu',
    tier1_max_m2: null,
    tier1_margin_pct: null,
    tier2_max_m2: null,
    tier2_margin_pct: null,
    tier3_margin_pct: 10,
  }

  it('marka marjı doluysa malzeme kuralını ezer', () => {
    expect(resolveBrandMarginPctStrict(5, materialRule, 500)).toBe(5)
  })

  it('marka marjı boşsa malzeme kuralına düşer', () => {
    expect(resolveBrandMarginPctStrict(null, materialRule, 500)).toBe(10)
  })

  it('geçersiz marka marjı sessiz varsayıma düşmez', () => {
    expect(resolveBrandMarginPctStrict(150, materialRule, 500)).toBeNull()
    expect(resolveBrandMarginPctStrict(-1, materialRule, 500)).toBeNull()
  })

  it('uçtan uca müşteri fiyatı: F 150 / 5 cm / İstanbul-Avrupa + %5 = 370,03 TL/m² (KDV hariç)', () => {
    const region = resolveBonusRegion(34, 'avrupa')
    expect(region).toBe(3)
    const base = getBonusBasePrice('bonus-premium-f-150', 50, region!)
    expect(base).toBe(352.41)
    const marginPct = resolveBrandMarginPctStrict(5, materialRule, 500)
    expect(applyMargin(base!, marginPct!)).toBe(370.03)
  })
})

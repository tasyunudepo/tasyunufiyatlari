import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import {
  areaForVehicles,
  capacityForPlate,
  describeVehicles,
  fitVehicles,
} from '@/lib/quote/vehicleArea'

// Referans: 27 Temmuz 2026, Mahmut Balcı teklifi.
// Bonus F 150 Pro 4 cm → 1 TIR = 2.217,6 m², 3 TIR = 6.652,8 m².
const BONUS_4CM = { truckM2: 2217.6, lorryM2: 1108.8 }
// Genel taşyünü 4 cm (logistics_capacity, thickness=40) — BAŞKA sayılar.
const GENEL_4CM = { truckM2: 1872, lorryM2: 1008 }

describe('araç → metraj', () => {
  it('3 TIR Bonus 4 cm → 6.652,8 m² (gönderilen teklifin metrajı)', () => {
    expect(areaForVehicles(BONUS_4CM, 3, 0)).toBe(6652.8)
  })

  it('aynı kalınlıkta Bonus ve genel kapasite AYNI DEĞİL', () => {
    expect(areaForVehicles(BONUS_4CM, 3, 0)).not.toBe(areaForVehicles(GENEL_4CM, 3, 0))
    expect(areaForVehicles(GENEL_4CM, 3, 0)).toBe(5616)
  })

  it('TIR + kamyon karışımını toplar', () => {
    expect(areaForVehicles(BONUS_4CM, 2, 1)).toBe(5544)
  })

  it('kapasite bilinmiyorsa sayı uydurmaz', () => {
    expect(areaForVehicles({ truckM2: null, lorryM2: null }, 3, 0)).toBeNull()
    expect(areaForVehicles({ truckM2: null, lorryM2: 1000 }, 1, 0)).toBeNull()
  })

  it('sıfır araç sıfır metraj', () => {
    expect(areaForVehicles(BONUS_4CM, 0, 0)).toBe(0)
  })
})

describe('metraj → araç', () => {
  it('6.652,8 m² → 3 TIR', () => {
    const fit = fitVehicles(6652.8, BONUS_4CM)
    expect(fit).toMatchObject({ trucks: 3, lorries: 0, exact: true })
    expect(describeVehicles(fit)).toBe('3 TIR')
  })

  it('5.544 m² → 2 TIR + 1 kamyon', () => {
    const fit = fitVehicles(5544, BONUS_4CM)
    expect(fit).toMatchObject({ trucks: 2, lorries: 1, exact: true })
    expect(describeVehicles(fit)).toBe('2 TIR + 1 kamyon')
  })

  it('tam araca oturmayan metrajı ARAÇ DİYE ETİKETLEMEZ', () => {
    // 7.002 m² Bonus 4 cm kapasitesine tam oturmaz. "3 TIR" demek
    // gerçek bir sipariş hatası olurdu.
    const fit = fitVehicles(7002, BONUS_4CM)
    expect(fit?.exact).toBe(false)
    expect(describeVehicles(fit)).toBeNull()
  })

  it('kapasite yoksa null döner', () => {
    expect(fitVehicles(6652.8, { truckM2: null, lorryM2: null })).toBeNull()
  })

  it('sıfır veya negatif metrajda null döner', () => {
    expect(fitVehicles(0, BONUS_4CM)).toBeNull()
    expect(fitVehicles(-100, BONUS_4CM)).toBeNull()
  })
})

// 8 Ekim 2026: müşteri sitede EPS 4 cm için 1 kamyon = 1.680 m² teklif aldı
// (TY8417917). Ofiste aynı ürün için "1 kamyon" 1.008 m² yazdı ve iki teklif
// (TE-2026-000240, TE-2026-000241) 672 m² eksik çıktı.
//
// Kök neden: `logistics_capacity` tablosundaki hazır m² sütunları TAŞYÜNÜ
// paketine göre yazılmış (4 cm: 280 paket × 3,6 m² = 1.008). Araca sığan
// PAKET ADEDİ her malzemede aynı, ama EPS 4 cm paketi 6 m². Doğru hesap
// paket adedi × ürünün kendi paket m²'si — site (sihirbaz, ürün sayfası,
// /api/quotes) zaten böyle hesaplıyor.
const LOJISTIK_4CM = {
  lorryPackages: 280,
  truckPackages: 520,
  packageSizeM2: 3.6,
  lorryM2: 1008,
  truckM2: 1872,
}

describe('levhanın araç kapasitesi', () => {
  it('EPS 4 cm (paket 6 m²) → kamyon 1.680 m², TIR 3.120 m²', () => {
    expect(capacityForPlate(LOJISTIK_4CM, 6)).toEqual({ lorryM2: 1680, truckM2: 3120 })
  })

  it('taşyünü 4 cm (paket 3,6 m²) → tablodaki sayılar değişmez', () => {
    expect(capacityForPlate(LOJISTIK_4CM, 3.6)).toEqual({ lorryM2: 1008, truckM2: 1872 })
  })

  it('ürünün paket m²si yoksa tablonun genel paketine düşer', () => {
    expect(capacityForPlate(LOJISTIK_4CM, null)).toEqual({ lorryM2: 1008, truckM2: 1872 })
    expect(capacityForPlate(LOJISTIK_4CM, 0)).toEqual({ lorryM2: 1008, truckM2: 1872 })
  })

  it('kayan nokta artığı bırakmaz (224 paket × 2,5 m²)', () => {
    const cap = capacityForPlate(
      { lorryPackages: 224, truckPackages: 416, packageSizeM2: 1.8, lorryM2: 403.2, truckM2: 748.8 },
      2.5,
    )
    expect(cap).toEqual({ lorryM2: 560, truckM2: 1040 })
  })

  it('kalınlığın lojistik satırı yoksa sayı uydurmaz', () => {
    expect(capacityForPlate(null, 6)).toEqual({ lorryM2: null, truckM2: null })
  })

  it('1.680 m² EPS 4 cm kapasitesiyle "1 kamyon" diye etiketlenir', () => {
    const cap = capacityForPlate(LOJISTIK_4CM, 6)
    expect(describeVehicles(fitVehicles(1680, cap))).toBe('1 kamyon')
    expect(areaForVehicles(cap, 1, 0)).toBe(3120)
  })
})

describe('ofis kataloğu kapasiteyi ürün paketinden hesaplar', () => {
  const rota = readFileSync(
    fileURLToPath(new URL('../../app/api/admin/catalog-items/route.ts', import.meta.url)),
    'utf8',
  )

  it('genel levha dalı hazır m² sütununu doğrudan okumaz', () => {
    expect(rota).toContain('capacityForPlate(logisticsByMm.get(thickness * 10), packageM2)')
    expect(rota).not.toMatch(/truckM2:\s*logisticsByMm/)
    expect(rota).not.toMatch(/lorryM2:\s*logisticsByMm/)
  })
})

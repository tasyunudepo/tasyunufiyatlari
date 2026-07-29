import { describe, it, expect } from 'vitest'

import {
  areaForVehicles,
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

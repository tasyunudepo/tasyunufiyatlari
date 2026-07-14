import { describe, expect, it } from 'vitest'

import {
  buildBonusChallenge,
  getBonusChallengerModel,
  type SetOfferSummary,
} from '@/lib/pricing/comparison/bonusChallenge'

// Sprint 1.1 — hakem kuralları: eşleştirme yoğunluk bandından, fark
// yalnız aynı koşulda ve Bonus gerçekten düşükse üretilir (fail-closed).

describe('Bonus rakip eşleştirme (yoğunluk bandı)', () => {
  it('150 bandındaki Expert HD150 → Bonus F 150', () => {
    expect(getBonusChallengerModel('HD150')).toBe('F 150')
  })

  it('110-120 bandındaki Dalmaçyalı SW035 → Bonus F 120', () => {
    expect(getBonusChallengerModel('SW035')).toBe('F 120')
  })

  it('100-120 bandındaki Optimix TR7.5 → Bonus F 120', () => {
    expect(getBonusChallengerModel('TR7.5')).toBe('F 120')
  })

  it('Bonus modeli kendine rakip üretmez', () => {
    expect(getBonusChallengerModel('F 150')).toBeNull()
  })

  it('profili olmayan (çatı/endüstriyel) model rakip üretmez', () => {
    expect(getBonusChallengerModel('CS60')).toBeNull()
    expect(getBonusChallengerModel('VF80')).toBeNull()
  })
})

const base: SetOfferSummary = {
  pricePerM2ExVat: 663.65,
  orderM2: 806.4,
  totalExVat: 535_167,
  thicknessCm: 5,
  cityCode: 6,
  subChoice: null,
  accessoryBrandName: 'Optimix',
}

const bonusBase: SetOfferSummary = {
  pricePerM2ExVat: 563.65,
  orderM2: 967.68,
  totalExVat: 545_438,
  thicknessCm: 5,
  cityCode: 6,
  subChoice: null,
  accessoryBrandName: 'Optimix',
}

describe('Aynı-koşul fark hesabı', () => {
  it('koşullar aynı ve Bonus düşükse m² farkını üretir', () => {
    const result = buildBonusChallenge(base, bonusBase)
    expect(result).not.toBeNull()
    expect(result!.unitDiffTL).toBe(100)
    expect(result!.bonusOrderM2).toBe(967.68)
  })

  it('Bonus daha pahalıysa kart üretmez (özür kartı yok)', () => {
    const result = buildBonusChallenge(
      { ...base, pricePerM2ExVat: 500 },
      bonusBase,
    )
    expect(result).toBeNull()
  })

  it('kalınlık farklıysa fark üretmez (fail-closed)', () => {
    expect(buildBonusChallenge(base, { ...bonusBase, thicknessCm: 6 })).toBeNull()
  })

  it('şehir veya alt bölge farklıysa fark üretmez', () => {
    expect(buildBonusChallenge(base, { ...bonusBase, cityCode: 34 })).toBeNull()
    expect(
      buildBonusChallenge(
        { ...base, cityCode: 34, subChoice: 'avrupa' },
        { ...bonusBase, cityCode: 34, subChoice: 'anadolu' },
      ),
    ).toBeNull()
  })

  it('toz grubu markası farklıysa fark üretmez', () => {
    expect(
      buildBonusChallenge(base, { ...bonusBase, accessoryBrandName: 'TEKNO' }),
    ).toBeNull()
  })

  it('geçersiz sayılarda fark üretmez', () => {
    expect(buildBonusChallenge(base, { ...bonusBase, pricePerM2ExVat: 0 })).toBeNull()
    expect(buildBonusChallenge(base, { ...bonusBase, totalExVat: NaN })).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import {
  buildQuoteSurfacePricing,
  buildQuoteTotals,
} from '@/lib/pricing/quoteTotals'

describe('kanonik teklif toplamı', () => {
  it('KDV hariç toplamı ikinci kez 1,20’ye bölmez', () => {
    expect(buildQuoteTotals(1000, 0)).toEqual({
      priceWithoutVat: 1000,
      vatAmount: 200,
      totalPrice: 1200,
    })
  })

  it('nakliyeyi KDV matrahına bir kez ekler ve kuruşa yuvarlar', () => {
    expect(buildQuoteTotals(1000.005, 49.995)).toEqual({
      priceWithoutVat: 1050,
      vatAmount: 210,
      totalPrice: 1260,
    })
  })

  it('kart, PDF ve WhatsApp için aynı net m² ve toplam sözleşmesini üretir', () => {
    expect(buildQuoteSurfacePricing(263_514.995, 0, 806.4)).toEqual({
      priceWithoutVat: 263_515,
      vatAmount: 52_703,
      totalPrice: 316_218,
      pricePerM2WithoutVat: 326.78,
    })
  })

  it('metraj sıfırsa hatalı m² fiyatı üretmez', () => {
    expect(() => buildQuoteSurfacePricing(1000, 0, 0)).toThrow(
      'Teklif metrajı sıfırdan büyük olmalıdır.',
    )
  })
})

import { describe, expect, it } from 'vitest'

import { materialTypeRulesSchema } from '@/lib/schemas/materialTypeRules.schema'

const validEps = {
  min_order_m2: 400,
  tier1_max_m2: 800,
  tier1_margin_pct: 20,
  tier2_max_m2: 1000,
  tier2_margin_pct: 10,
  tier3_margin_pct: 5,
  full_vehicle_only: false,
  special_order_threshold_m2: null,
  special_order_note: null,
}

describe('material type marj kuralı', () => {
  it('EPS 400 / 800 / 1000 kuralını kabul eder', () => {
    expect(materialTypeRulesSchema.safeParse(validEps).success).toBe(true)
  })

  it('negatif minimum ve yüzde 100 üzeri marjı reddeder', () => {
    expect(
      materialTypeRulesSchema.safeParse({
        ...validEps,
        min_order_m2: -1,
        tier1_margin_pct: 120,
      }).success,
    ).toBe(false)
  })

  it('ikinci kademe sınırı birinciden büyük değilse reddeder', () => {
    expect(
      materialTypeRulesSchema.safeParse({
        ...validEps,
        tier1_max_m2: 1000,
        tier2_max_m2: 800,
      }).success,
    ).toBe(false)
  })
})

import { z } from 'zod'

const nullableNonNegative = z.number().finite().nonnegative().nullable()
const nullableMargin = z.number().finite().min(0).max(100).nullable()

export const materialTypeRulesSchema = z
  .object({
    min_order_m2: nullableNonNegative,
    tier1_max_m2: nullableNonNegative,
    tier1_margin_pct: nullableMargin,
    tier2_max_m2: nullableNonNegative,
    tier2_margin_pct: nullableMargin,
    tier3_margin_pct: nullableMargin,
    full_vehicle_only: z.boolean(),
    special_order_threshold_m2: nullableNonNegative,
    special_order_note: z.string().max(1000).nullable(),
  })
  .superRefine((rule, ctx) => {
    if (
      rule.tier1_max_m2 != null &&
      rule.tier2_max_m2 != null &&
      rule.tier1_max_m2 >= rule.tier2_max_m2
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['tier2_max_m2'],
        message: 'İkinci kademe üst sınırı birinci kademeden büyük olmalıdır.',
      })
    }

    const tier1Pair = rule.tier1_max_m2 == null === (rule.tier1_margin_pct == null)
    const tier2Pair = rule.tier2_max_m2 == null === (rule.tier2_margin_pct == null)
    if (!tier1Pair) {
      ctx.addIssue({
        code: 'custom',
        path: ['tier1_margin_pct'],
        message: 'Birinci kademe sınırı ve marjı birlikte tanımlanmalıdır.',
      })
    }
    if (!tier2Pair) {
      ctx.addIssue({
        code: 'custom',
        path: ['tier2_margin_pct'],
        message: 'İkinci kademe sınırı ve marjı birlikte tanımlanmalıdır.',
      })
    }
  })

export type MaterialTypeRules = z.infer<typeof materialTypeRulesSchema>

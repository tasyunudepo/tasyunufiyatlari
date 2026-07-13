import { describe, expect, it } from 'vitest'

import { applyMargin, resolveMarginPct } from '@/lib/pricing/margin'

describe('kanonik marj kuralı', () => {
  const epsRule = {
    slug: 'eps',
    tier1_max_m2: 800,
    tier1_margin_pct: 20,
    tier2_max_m2: 1000,
    tier2_margin_pct: 10,
    tier3_margin_pct: 5,
  }

  it.each([
    [400, 20],
    [800, 20],
    [801, 10],
    [1000, 10],
    [1001, 5],
  ])('%s m² için marjı %s seçer', (areaM2, expected) => {
    expect(resolveMarginPct(epsRule, areaM2)).toBe(expected)
  })

  it('taşyününde sabit tier3 marjını kullanır', () => {
    expect(
      resolveMarginPct(
        {
          slug: 'tasyunu',
          tier1_max_m2: null,
          tier1_margin_pct: null,
          tier2_max_m2: null,
          tier2_margin_pct: null,
          tier3_margin_pct: 5,
        },
        1344,
      ),
    ).toBe(5)
  })

  it('%10 yerine %5 marj uygulandığında satış fiyatını yaklaşık %4,55 düşürür', () => {
    const oldPrice = applyMargin(100, 10)
    const newPrice = applyMargin(100, 5)

    expect(oldPrice).toBe(110)
    expect(newPrice).toBe(105)
    expect(1 - newPrice / oldPrice).toBeCloseTo(0.04545, 4)
  })
})

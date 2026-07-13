export interface MarginRuleInput {
  slug: string
  tier1_max_m2: number | null
  tier1_margin_pct: number | null
  tier2_max_m2: number | null
  tier2_margin_pct: number | null
  tier3_margin_pct: number | null
}

const roundToKurus = (value: number) => Math.round(value * 100) / 100

const isValidMarginPct = (value: number | null): value is number =>
  value != null && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100

const isValidTier = (maxM2: number | null, marginPct: number | null): boolean => {
  if (maxM2 == null && marginPct == null) return true
  return (
    maxM2 != null &&
    Number.isFinite(Number(maxM2)) &&
    Number(maxM2) >= 0 &&
    isValidMarginPct(marginPct)
  )
}

/**
 * Fiyat gösteren yüzeyler için fail-closed marj çözümleyici.
 * Eksik veya tutarsız kuralda sessiz bir varsayıma düşmek yerine null döner.
 */
export function resolveMarginPctStrict(
  rule: MarginRuleInput | null | undefined,
  areaM2: number,
): number | null {
  if (!rule || !Number.isFinite(areaM2) || areaM2 <= 0) return null
  if (!isValidTier(rule.tier1_max_m2, rule.tier1_margin_pct)) return null
  if (!isValidTier(rule.tier2_max_m2, rule.tier2_margin_pct)) return null
  if (!isValidMarginPct(rule.tier3_margin_pct)) return null

  const tier1Max = rule.tier1_max_m2 == null ? null : Number(rule.tier1_max_m2)
  const tier2Max = rule.tier2_max_m2 == null ? null : Number(rule.tier2_max_m2)

  if (tier1Max != null && tier2Max != null && tier1Max > tier2Max) return null

  if (tier1Max != null && areaM2 <= tier1Max) {
    return Number(rule.tier1_margin_pct)
  }

  if (tier2Max != null && areaM2 <= tier2Max) {
    return Number(rule.tier2_margin_pct)
  }

  return Number(rule.tier3_margin_pct)
}

export function resolveMarginPct(
  rule: MarginRuleInput | null | undefined,
  areaM2: number,
  fallbackPct = 10,
): number {
  return resolveMarginPctStrict(rule, areaM2) ?? fallbackPct
}

export function applyMargin(netCost: number, marginPct: number): number {
  return roundToKurus(netCost * (1 + marginPct / 100))
}

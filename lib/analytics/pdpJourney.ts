export type PdpMeasuredSection =
  | 'package'
  | 'technical'
  | 'seller_payment_process'

export type PdpComparisonRoute = 'bonus_system' | 'all_products'

export type PdpElapsedBucket = '0_15s' | '16_45s' | '46_120s' | '120s_plus'
export type PdpScrollBucket = '0_24' | '25_49' | '50_74' | '75_89' | '90_100'

export interface PdpJourneySnapshot {
  seen_sections: string | null
  elapsed_ms_bucket: PdpElapsedBucket
  max_scroll_bucket: PdpScrollBucket
}

export function bucketElapsedMs(elapsedMs: number): PdpElapsedBucket {
  if (elapsedMs <= 15_000) return '0_15s'
  if (elapsedMs <= 45_000) return '16_45s'
  if (elapsedMs <= 120_000) return '46_120s'
  return '120s_plus'
}

export function bucketScrollPercent(scrollPercent: number): PdpScrollBucket {
  const bounded = Math.max(0, Math.min(100, scrollPercent))
  if (bounded < 25) return '0_24'
  if (bounded < 50) return '25_49'
  if (bounded < 75) return '50_74'
  if (bounded < 90) return '75_89'
  return '90_100'
}

export function serializeSeenSections(sections: Iterable<PdpMeasuredSection>): string | null {
  const serialized = Array.from(new Set(sections)).sort().join('|')
  return serialized || null
}

export function createComparisonSessionId(): string {
  return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

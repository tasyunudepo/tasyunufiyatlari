// ============================================================
// Bonus meydan okuma çekirdeği (Sprint 1.1) — "hakem"
//
// İki kural koyar:
//  1) EŞLEŞTİRME: bir Filli grubu modelinin Bonus rakibi, teknik
//     profillerdeki (föy/sözlü beyan) yoğunluk bandına göre seçilir —
//     elle liste tutulmaz, karşılaştırma-uygun olmayan (çatı/endüstriyel)
//     ürünler otomatik dışarıda kalır.
//  2) AYNI KOŞUL: fark ancak şehir + alt bölge + kalınlık + toz grubu
//     markası + kapsam (komple set) + KDV durumu birebir aynıysa üretilir.
//     Koşul eşitlenemiyorsa fark YOKTUR (fail-closed) — "yaklaşık"
//     gösterilmez. Sipariş metrajları araç kapasiteleri gereği farklı
//     olabilir; bu yüzden tek dürüst gösterge m² birim fiyat farkıdır.
//
// Bu modül FİYAT VERİSİ İÇERMEZ; yalnız çağıranın verdiği gerçek hesap
// sonuçlarını kıyaslar. Sabit "daha ucuz" iddiası üretmez.
// ============================================================

import { getAllProfiles, getProfileByModel } from '@/lib/technical-profiles'

// Eşitlikte tercih sırası: yaygın ürün önde; "Pro" otomatik üstünlük
// olarak pazarlanmaz (kilitli karar).
const BONUS_PREFERENCE_ORDER = ['F 150', 'F 120', 'F 150 Pro']

/**
 * Filli grubu modeli için yoğunluk bandı en yakın Bonus modelini döner.
 * Bonus modeli, karşılaştırmaya uygun olmayan model veya profili
 * bulunmayan model için null (kart hiç çıkmaz).
 */
export function getBonusChallengerModel(modelShortName: string): string | null {
  const profile = getProfileByModel(modelShortName)
  if (!profile) return null
  if (profile.brandName === 'Bonus') return null
  if (!profile.comparisonEligible) return null

  const sourceMid = (profile.density.minKgM3 + profile.density.maxKgM3) / 2

  const candidates = getAllProfiles().filter(
    (p) => p.brandName === 'Bonus' && p.wizardEligible && p.comparisonEligible,
  )
  if (candidates.length === 0) return null

  let best: { model: string; diff: number; pref: number } | null = null
  for (const c of candidates) {
    const mid = (c.density.minKgM3 + c.density.maxKgM3) / 2
    const diff = Math.abs(mid - sourceMid)
    const pref = BONUS_PREFERENCE_ORDER.indexOf(c.modelShortName)
    const prefRank = pref === -1 ? BONUS_PREFERENCE_ORDER.length : pref
    if (
      best === null ||
      diff < best.diff ||
      (diff === best.diff && prefRank < best.pref)
    ) {
      best = { model: c.modelShortName, diff, pref: prefRank }
    }
  }
  return best?.model ?? null
}

// ─── Aynı-koşul fark hesabı ─────────────────────────────────────

export interface SetOfferSummary {
  /** KDV hariç, nakliye dahil komple set m² fiyatı — GERÇEK hesap sonucu */
  pricePerM2ExVat: number
  /** Sipariş metrajı (kendi tam araç düzeninde) */
  orderM2: number
  /** KDV hariç set toplamı */
  totalExVat: number
  thicknessCm: number
  cityCode: number
  subChoice: string | null
  /** Toz grubu markası — kıyas ancak aynı tozla yapılır */
  accessoryBrandName: string
}

export interface BonusChallengeResult {
  /** m² başına fark (pozitif = Bonus daha düşük), KDV hariç */
  unitDiffTL: number
  bonusPricePerM2: number
  currentPricePerM2: number
  bonusOrderM2: number
  bonusTotalExVat: number
}

/**
 * Aynı koşullar sağlanıyorsa ve Bonus m² fiyatı gerçekten düşükse fark
 * döner; aksi her durumda null (kart gösterilmez). Meydan okuma kartı
 * özür kartı değildir: Bonus pahalıysa sessiz kalınır, iddia üretilmez.
 */
export function buildBonusChallenge(
  current: SetOfferSummary,
  bonus: SetOfferSummary,
): BonusChallengeResult | null {
  const sameConditions =
    current.thicknessCm === bonus.thicknessCm &&
    current.cityCode === bonus.cityCode &&
    (current.subChoice ?? null) === (bonus.subChoice ?? null) &&
    current.accessoryBrandName === bonus.accessoryBrandName
  if (!sameConditions) return null

  const values = [
    current.pricePerM2ExVat, bonus.pricePerM2ExVat,
    bonus.orderM2, bonus.totalExVat,
  ]
  if (values.some((v) => !Number.isFinite(v) || v <= 0)) return null

  const unitDiff = Math.round((current.pricePerM2ExVat - bonus.pricePerM2ExVat) * 100) / 100
  if (unitDiff <= 0) return null

  return {
    unitDiffTL: unitDiff,
    bonusPricePerM2: bonus.pricePerM2ExVat,
    currentPricePerM2: current.pricePerM2ExVat,
    bonusOrderM2: bonus.orderM2,
    bonusTotalExVat: bonus.totalExVat,
  }
}

/** Kartların altına yazılan koşul satırı — tek kaynaktan. */
export function sameConditionLabel(input: {
  cityName: string
  subLabel?: string | null
  thicknessCm: number
}): string {
  const sub = input.subLabel ? ` (${input.subLabel})` : ''
  return `Aynı şehir: ${input.cityName}${sub} · aynı kalınlık: ${input.thicknessCm} cm · aynı toz grubu · tam araç · KDV hariç`
}

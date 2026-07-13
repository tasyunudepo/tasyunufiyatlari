// ============================================================
// Bonus levha birim satış fiyatı — sunucu tarafı saf hesap
//
// satış = bölge liste fiyatı × 0,90 (taban) × (1 + marka marjı)
// Marka marjı DB'den (brands.margin_pct) gelir ve çağırana aittir;
// bu modül marjsız/bölgesiz durumda fiyat ÜRETMEZ (fail-closed).
//
// Karar 13 revizyonu (13 Temmuz 2026, Emrah): Bonus levha + harman toz
// grubu (Expert / Optimix / TEKNO) komple set fiyatı wizard'da verilir.
// Bu modül yine yalnız LEVHA birim fiyatı üretir; toz kalemleri paket
// motorunda diğer markalarla AYNI kod yolundan hesaplanır (tek marj).
// TEKNO tozlu pakette sevkiyat "ayrıca teyit" uyarısıyla sunulur.
// ============================================================

import { getProfileByModel } from '@/lib/technical-profiles'
import { applyMargin, resolveBrandMarginPctStrict } from '@/lib/pricing/margin'
import { getBonusBasePrice, getBonusPriceRow, resolveBonusRegion } from './regionPricing'
import { citySubRegionQuestion, type BonusSubRegionChoice } from './subRegions'

export type BonusSaleFailReason =
  | 'unknown_model'
  | 'not_bonus'
  | 'sub_region_required'
  | 'region_unresolved'
  | 'thickness_unavailable'
  | 'margin_unavailable'

export type BonusSaleResult =
  | {
      ok: true
      region: number
      thicknessMm: number
      /** KDV hariç, marj uygulanmış müşteri m² fiyatı */
      salePricePerM2: number
      packageM2: number
      packagePieces: number
      /** Kamyon yükleme kapasitesi (m²) — üretici listesindeki değer */
      kamyonM2: number
      /** TIR yükleme kapasitesi (m²) */
      tirM2: number
    }
  | { ok: false; reason: BonusSaleFailReason }

export type BonusCapacityFailReason =
  | 'unknown_model'
  | 'not_bonus'
  | 'thickness_unavailable'

export type BonusCapacityResult =
  | {
      ok: true
      thicknessMm: number
      packageM2: number
      packagePieces: number
      kamyonM2: number
      tirM2: number
    }
  | { ok: false; reason: BonusCapacityFailReason }

/**
 * Bonus model + kalınlık → paket/araç kapasiteleri. Fiyat, bölge ve
 * iskonto verisi İÇERMEZ; wizard metraj adımının tam araç önerileri
 * bu değerlerle kurulur (müşteri yüzeyine inmesi güvenlidir).
 */
export function computeBonusCapacity(input: {
  modelShortName: string
  thicknessCm: number
}): BonusCapacityResult {
  const profile = getProfileByModel(input.modelShortName)
  if (!profile) return { ok: false, reason: 'unknown_model' }
  if (profile.brandName !== 'Bonus') return { ok: false, reason: 'not_bonus' }

  const thicknessMm = Math.round(input.thicknessCm * 10)
  const row = getBonusPriceRow(profile.productKey, thicknessMm)
  if (!row) return { ok: false, reason: 'thickness_unavailable' }

  return {
    ok: true,
    thicknessMm,
    packageM2: row.packageM2,
    packagePieces: row.packagePieces,
    kamyonM2: row.truckM2,
    tirM2: row.trailerM2,
  }
}

export function computeBonusUnitSale(input: {
  modelShortName: string
  thicknessCm: number
  cityCode: number
  subChoice?: BonusSubRegionChoice | null
  /** brands.margin_pct — null/geçersizse fiyat üretilmez */
  brandMarginPct: number | null | undefined
}): BonusSaleResult {
  const profile = getProfileByModel(input.modelShortName)
  if (!profile) return { ok: false, reason: 'unknown_model' }
  if (profile.brandName !== 'Bonus') return { ok: false, reason: 'not_bonus' }

  const region = resolveBonusRegion(input.cityCode, input.subChoice)
  if (region == null) {
    return {
      ok: false,
      reason: citySubRegionQuestion(input.cityCode) ? 'sub_region_required' : 'region_unresolved',
    }
  }

  const thicknessMm = Math.round(input.thicknessCm * 10)
  const row = getBonusPriceRow(profile.productKey, thicknessMm)
  const basePrice = getBonusBasePrice(profile.productKey, thicknessMm, region)
  if (!row || basePrice == null) return { ok: false, reason: 'thickness_unavailable' }

  const marginPct = resolveBrandMarginPctStrict(input.brandMarginPct, null, 1)
  if (marginPct == null) return { ok: false, reason: 'margin_unavailable' }

  return {
    ok: true,
    region,
    thicknessMm,
    salePricePerM2: applyMargin(basePrice, marginPct),
    packageM2: row.packageM2,
    packagePieces: row.packagePieces,
    // Üretici tablosu: "Kamyon m²" / "Tır m²" — JSON alan adları truckM2
    // (kamyon) ve trailerM2 (TIR) olarak eşlenmiştir.
    kamyonM2: row.truckM2,
    tirM2: row.trailerM2,
  }
}

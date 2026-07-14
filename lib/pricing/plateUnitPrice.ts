// ============================================================
// Tam araç levha m² satış fiyatı — tek kaynaklı saf formül
//
// PDP fiyat paneli ve karşılaştırma merkezi aynı hesabı kullanır:
//   m² KDV hariç liste = (paket fiyatı / paket m²) [KDV dahilse /1,20]
//   satış = liste × (1 - bölge TIR iskontosu) × (1 - İSK2) × (1 + marj)
//
// Girdi eksik/geçersizse null döner (fail-closed) — fiyat uydurulmaz.
// ============================================================

import { applyMargin } from '@/lib/pricing/margin'

export interface PlateUnitPriceInput {
  /** plate_prices.base_price (paket fiyatı) */
  basePrice: number
  isKdvIncluded: boolean
  /** Kalınlığa özel paket m² (plate_prices.package_m2 ?? plates.package_m2) */
  packageM2: number
  /** Bölge iskontosu (tam araç: shipping_zones.discount_tir) */
  discount1Pct: number
  /** Bayi iskontosu (İSK2) */
  discount2Pct: number
  /** resolveMarginPctStrict sonucu — null ise fiyat üretilmez */
  marginPct: number | null
}

export function computeFullTruckPlateUnitPrice(input: PlateUnitPriceInput): number | null {
  const { basePrice, isKdvIncluded, packageM2, discount1Pct, discount2Pct, marginPct } = input
  if (
    !Number.isFinite(basePrice) || basePrice <= 0 ||
    !Number.isFinite(packageM2) || packageM2 <= 0 ||
    !Number.isFinite(discount1Pct) || discount1Pct < 0 || discount1Pct >= 100 ||
    !Number.isFinite(discount2Pct) || discount2Pct < 0 || discount2Pct >= 100 ||
    marginPct === null || !Number.isFinite(marginPct)
  ) {
    return null
  }
  const kdvHaricListe = isKdvIncluded ? basePrice / 1.2 : basePrice
  const perM2 = kdvHaricListe / packageM2
  const discounted = perM2 * (1 - discount1Pct / 100) * (1 - discount2Pct / 100)
  return applyMargin(discounted, marginPct)
}

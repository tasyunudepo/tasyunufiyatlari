// ============================================================
// Bonus bölge bazlı fiyat erişimi ve bölge çözümü
//
// Kaynak: bonus-region-prices.json — BONUS FİYAT LİSTESİ Haziran 2026
// PDF'inden sayfa görüntüleriyle doğrulanmış liste fiyatları (KDV hariç,
// tavsiye edilen satış fiyatı) ve taşyünü nakliye bölge haritası (s.83).
//
// Ticari kurallar (karar günlüğü Tur 4, 13 Temmuz 2026):
//   - Taban fiyat = liste × 0,90 (bayi iskontosu %10, tüm bölgelerde).
//   - Kâr marjı BU MODÜLDE UYGULANMAZ; brands.margin_pct üzerinden
//     canlı kuralla eklenir (yalnız Bonus %5 kararı).
//   - İstanbul yaka ayrımı: Avrupa → 3. Bölge, Anadolu → 2. Bölge.
//   - Kocaeli ayrımı: Gebze → 2. Bölge, diğer ilçeler → 1. Bölge.
//   - Bölge/fiyat çözülemezse null döner (fail-closed); kesin fiyat
//     uydurulmaz.
// ============================================================

import data from './bonus-region-prices.json'
import {
  SPECIAL_CITY_SUB_REGIONS,
  citySubRegionQuestion,
  type BonusSubRegionChoice,
} from './subRegions'

export { citySubRegionQuestion }
export type { BonusSubRegionChoice }

export interface BonusPriceRow {
  thicknessMm: number
  packagePieces: number
  packageM2: number
  truckPackages: number
  truckM2: number
  trailerPackages: number
  trailerM2: number
  listPricesByRegion: number[]
}

export const BONUS_DISCOUNT_PCT: number = data.discountPct

// Kuruş hassasiyeti tamsayı aritmetiğiyle korunur: 224,75 × 0,90 = 202,275
// float'ta 202,2749…'a düşer ve yanlış yuvarlanır; kuruş üzerinden hesap
// PostgreSQL round(numeric, 2) ile birebir aynı sonucu verir.
const discountedKurus = (listPrice: number, discountPct: number): number => {
  const listCents = Math.round(listPrice * 100)
  return Math.round((listCents * (100 - discountPct)) / 100) / 100
}

const REGIONS_BY_CITY: Record<string, number | null> =
  data.regionsByCityCode as Record<string, number | null>

const isValidRegion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7

/**
 * Şehir (+ gerekiyorsa alt-bölge seçimi) → Bonus nakliye bölgesi (1-7).
 * Alt-bölge gereken şehirde seçim yoksa null: kesin fiyat üretilmez.
 */
export function resolveBonusRegion(
  cityCode: number,
  subChoice?: BonusSubRegionChoice | null,
): number | null {
  const special = SPECIAL_CITY_SUB_REGIONS[cityCode]
  if (special) {
    if (!subChoice) return null
    const region = special.options[subChoice]
    return isValidRegion(region) ? region : null
  }
  const region = REGIONS_BY_CITY[String(cityCode)]
  return isValidRegion(region) ? region : null
}

export function getBonusProductKeys(): string[] {
  return data.products.map((p) => p.productKey)
}

export function getBonusPriceRows(productKey: string): BonusPriceRow[] | null {
  const product = data.products.find((p) => p.productKey === productKey)
  return product ? (product.rows as BonusPriceRow[]) : null
}

export function getBonusPriceRow(
  productKey: string,
  thicknessMm: number,
): BonusPriceRow | null {
  const rows = getBonusPriceRows(productKey)
  return rows?.find((r) => r.thicknessMm === thicknessMm) ?? null
}

/** KDV hariç bölge liste fiyatı (üretici tavsiye fiyatı). */
export function getBonusListPrice(
  productKey: string,
  thicknessMm: number,
  region: number,
): number | null {
  if (!isValidRegion(region)) return null
  const row = getBonusPriceRow(productKey, thicknessMm)
  const price = row?.listPricesByRegion[region - 1]
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null
}

/** Sisteme kaydedilen taban fiyat: liste × (1 - iskonto). KDV hariç, marjsız. */
export function getBonusBasePrice(
  productKey: string,
  thicknessMm: number,
  region: number,
): number | null {
  const list = getBonusListPrice(productKey, thicknessMm, region)
  if (list == null) return null
  return discountedKurus(list, BONUS_DISCOUNT_PCT)
}

// ============================================================
// Bonus ürün sayfası paket tablosu (yalnız sunucu)
//
// Emrah, 26 Ekim 2026: "Ürün sayfasında kalınlığa göre liste olsun, Bonus'a
// özel; diğerlerinde vardı." Paket içi adet, paket m², kamyon ve TIR paket
// adedi üretici fiyat listesinden gelir. FİYAT TAŞIMAZ: sayfa bileşenine
// yalnız bu düz satırlar geçer (bonus-price-privacy: components/** fiyat
// modülünü import edemez).
// ============================================================

import { getProfileByModel } from '@/lib/technical-profiles'
import { getBonusPriceRows } from './regionPricing'

export interface BonusPackageRow {
  thicknessCm: number
  packagePieces: number
  packageM2: number
  /** Kamyon (üretici tablosunda "Kamyon") */
  lorryPackages: number
  lorryM2: number
  /** TIR (üretici tablosunda "Tır") */
  truckPackages: number
  truckM2: number
}

/** Model kısa adı → kalınlık sıralı paket satırları; listede olmayan model atlanır. */
export function buildBonusPackageTable(modelShortNames: readonly string[]): Record<string, BonusPackageRow[]> {
  const table: Record<string, BonusPackageRow[]> = {}
  for (const model of modelShortNames) {
    const profile = getProfileByModel(model)
    const rows = profile ? getBonusPriceRows(profile.productKey) : null
    if (!rows || rows.length === 0) continue
    table[model] = rows
      .map((row) => ({
        thicknessCm: row.thicknessMm / 10,
        packagePieces: row.packagePieces,
        packageM2: row.packageM2,
        // JSON alan adları: truckM2 = kamyon, trailerM2 = TIR (sale.ts ile aynı eşleme).
        lorryPackages: row.truckPackages,
        lorryM2: row.truckM2,
        truckPackages: row.trailerPackages,
        truckM2: row.trailerM2,
      }))
      .sort((a, b) => a.thicknessCm - b.thicknessCm)
  }
  return table
}

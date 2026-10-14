// Karşılaştırma tablosunda 1 kamyon ve 1 TIR fiyatı (Emrah kararı, 14 Ekim 2026).
//
// NEDEN: tablo önce yalnız TIR iskontosuyla, 1.000 m² kâr kademesiyle tek bir m² fiyatı gösteriyordu;
// ürün sayfası ise 1 kamyonu kendi metrajıyla (ör. SW035 10 cm 403,2 m², kamyon iskontosu) fiyatlıyor.
// En az sipariş 1 tam kamyon olduğu için tablo ana fiyat olarak 1 kamyon m² fiyatını gösterir; TIR ikinci
// satırdadır. Hesap ProductPricePanel'deki calcPrice ile aynıdır: liste / paket m² → kamyon ya da TIR
// iskontosu → ikinci iskonto → o aracın metrajındaki kâr kademesi. Kâr ve iskonto oranı ekrana çıkmaz.

import { computeFullTruckPlateUnitPrice } from '@/lib/pricing/plateUnitPrice'
import { resolveMarginPctStrict, type MarginRuleInput } from '@/lib/pricing/margin'

export interface VehiclePrice {
  /** Aracın taşıdığı metraj, m² (0,1'e yuvarlı — ürün sayfasıyla aynı). */
  m2: number
  /** KDV hariç m² fiyatı (kuruşa yuvarlı). */
  unit: number
  /** 1 aracın KDV hariç toplamı (TL'ye yuvarlı). */
  total: number
}

export interface VehiclePrices {
  kamyon: VehiclePrice | null
  tir: VehiclePrice | null
}

const roundM2 = (value: number) => Math.round(value * 10) / 10

export interface PlateVehicleInput {
  basePrice: number
  isKdvIncluded: boolean
  /** Bu kalınlığın paket m²'si (plate_prices.package_m2; yoksa logistics_capacity.package_size_m2). */
  packageM2: number
  /** Levhanın ikinci iskontosu, % (plates.discount_2; yoksa 8 — ürün sayfasıyla aynı). */
  discount2Pct: number
  discountKamyonPct: number
  discountTirPct: number
  lorryPackages: number | null
  truckPackages: number | null
  marginRule: MarginRuleInput | null | undefined
}

function vehicle(input: PlateVehicleInput, packages: number | null, discount1Pct: number): VehiclePrice | null {
  if (packages === null || !Number.isFinite(packages) || packages <= 0) return null
  const m2 = roundM2(packages * input.packageM2)
  const marginPct = resolveMarginPctStrict(input.marginRule, m2)
  const unit = computeFullTruckPlateUnitPrice({
    basePrice: input.basePrice,
    isKdvIncluded: input.isKdvIncluded,
    packageM2: input.packageM2,
    discount1Pct,
    discount2Pct: input.discount2Pct,
    marginPct,
  })
  return unit === null ? null : { m2, unit, total: Math.round(unit * m2) }
}

export function plateVehiclePrices(input: PlateVehicleInput): VehiclePrices {
  return {
    kamyon: vehicle(input, input.lorryPackages, input.discountKamyonPct),
    tir: vehicle(input, input.truckPackages, input.discountTirPct),
  }
}

/** Bonus: bölge fiyatı tek m² fiyatıdır (araç tipine göre değişmez); kapasite Bonus'un kendi kaydından gelir. */
export function bonusVehiclePrices(unit: number, kamyonM2: number | null, tirM2: number | null): VehiclePrices {
  const make = (m2: number | null): VehiclePrice | null =>
    m2 !== null && Number.isFinite(m2) && m2 > 0 ? { m2: roundM2(m2), unit, total: Math.round(unit * roundM2(m2)) } : null
  return { kamyon: make(kamyonM2), tir: make(tirM2) }
}

// Karşılaştırma tablosunda 1 kamyon ve 1 TIR fiyatı (Emrah kararı, 14 Ekim 2026).
//
// NEDEN: tablo önce yalnız TIR iskontosuyla, 1.000 m² kâr kademesiyle tek bir m² fiyatı gösteriyordu;
// ürün sayfası ise 1 kamyonu kendi metrajıyla (ör. SW035 10 cm 403,2 m², kamyon iskontosu) fiyatlıyor.
// En az sipariş 1 tam kamyon olduğu için tablo ana fiyat olarak 1 kamyon m² fiyatını gösterir; TIR ikinci
// satırdadır. Hesap ProductPricePanel'deki calcPrice ile aynıdır: liste / paket m² → kamyon ya da TIR
// iskontosu → ikinci iskonto → o aracın metrajındaki kâr kademesi. Kâr ve iskonto oranı ekrana çıkmaz.

import { computeFullTruckPlateUnitPrice } from '@/lib/pricing/plateUnitPrice'
import { resolveMarginPctStrict, type MarginRuleInput } from '@/lib/pricing/margin'
import type { BonusSubRegionChoice } from '@/lib/pricing/bonus/subRegions'
import { buildBonusPlateOrder } from '@/lib/pricing/bonus/packageAssembly'

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

/**
 * Bonus: bölge fiyatı tek m² fiyatıdır (araç tipine göre değişmez); kapasite Bonus'un kendi kaydından gelir.
 * Metraj ve tutar ürün sayfasıyla aynı fonksiyondan: araç kapasitesi paket adedine oturtulur (paket × paket m²),
 * tutar kuruşa (buildBonusPlateOrder). Örn. F 150 5 cm: 967,7 m² kayıt → 336 × 2,88 = 967,68 m², 358.070,63 ₺.
 */
export function bonusVehiclePrices(unit: number, packageM2: number, kamyonM2: number | null, tirM2: number | null): VehiclePrices {
  const make = (m2: number | null): VehiclePrice | null => {
    if (m2 === null || !Number.isFinite(m2) || m2 <= 0) return null
    const order = buildBonusPlateOrder({ salePricePerM2: unit, packageM2 }, m2)
    return order ? { m2: order.orderM2, unit, total: order.totalExVat } : null
  }
  return { kamyon: make(kamyonM2), tir: make(tirM2) }
}

// ─── Filli/diğer markalar: katalog satırlarından tek ürünün araç fiyatları ───
// Karşılaştırma tablosu (tarayıcı) ve hub sayfaları (sunucu, derleme anı) aynı hesabı kullanır.

export interface LogisticsRow {
  /** milimetre (5 cm → 50) */
  thickness: number
  lorry_capacity_packages: number | null
  truck_capacity_packages: number | null
  package_size_m2: number | null
}

type Num = number | string | null | undefined

export interface PlateCatalogData {
  plates: Array<{ id: number; short_name: string | null; brand_id: number | null; discount_2?: Num }>
  platePrices: Array<{ plate_id: number; thickness: number; base_price: Num; is_kdv_included?: boolean | null; package_m2?: Num; discount_2?: Num }>
  zone: { discount_kamyon?: Num; discount_tir?: Num } | null
  marginRule: MarginRuleInput | null | undefined
  logistics: LogisticsRow[]
}

/** null = bu ürün bu kalınlıkta / koşulda fiyatlanamaz. */
export function platePricesForModel(data: PlateCatalogData, modelShortName: string, thicknessCm: number): VehiclePrices | null {
  if (!data.zone || !data.marginRule) return null
  const plate = data.plates.find((pl) => pl.short_name === modelShortName && pl.brand_id != null)
  if (!plate) return null
  const pp = data.platePrices.find((row) => row.plate_id === plate.id && row.thickness === thicknessCm)
  if (!pp) return null
  // Ürün sayfasıyla aynı: paket m² önce kalınlık satırından, yoksa lojistik kaydından; araç metrajı
  // paket adedi × paket m²; kâr kademesi o aracın metrajıyla seçilir.
  const lc = data.logistics.find((row) => row.thickness === thicknessCm * 10) ?? null
  if (!lc) return null
  const prices = plateVehiclePrices({
    basePrice: Number(pp.base_price),
    isKdvIncluded: pp.is_kdv_included ?? false,
    packageM2: Number(pp.package_m2 ?? lc.package_size_m2 ?? 0),
    discount2Pct: Number(pp.discount_2 ?? plate.discount_2 ?? 8),
    discountKamyonPct: Number(data.zone.discount_kamyon ?? 0),
    discountTirPct: Number(data.zone.discount_tir ?? 0),
    lorryPackages: lc.lorry_capacity_packages != null ? Number(lc.lorry_capacity_packages) : null,
    truckPackages: lc.truck_capacity_packages != null ? Number(lc.truck_capacity_packages) : null,
    marginRule: data.marginRule,
  })
  return prices.kamyon ? prices : null
}

/** Hub sayfasının derleme anı fiyat fotoğrafı (varsayılan koşul: İstanbul, ilk yaka, 1 kamyon). */
export interface ComparisonSnapshot {
  cityCode: number
  cityName: string
  subChoice: BonusSubRegionChoice | null
  thicknessCm: number
  /** productKey → fiyat (null: bu kalınlıkta yok) */
  prices: Record<string, VehiclePrices | null>
  /** modelShortName → ürün sayfası slug'ı */
  slugs: Record<string, string>
}

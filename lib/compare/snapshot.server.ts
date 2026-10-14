// Hub sayfaları için derleme anında fiyat fotoğrafı (Emrah onayı, 14 Ekim 2026 — hub planı Faz 2).
//
// NEDEN: karşılaştırma tablosunun fiyatları tarayıcıda doluyordu; Google sayfayı fiyatsız görüyordu.
// Hub sayfası (ör. "10 cm taş yünü fiyatları") varsayılan koşulda (İstanbul, Avrupa Yakası, 1 kamyon)
// fiyatları sunucu HTML'ine koyar; tablo açıldıktan sonra canlı veriyle yeniden hesaplar. Hesap,
// tablonun ve ürün sayfasının kullandığı fonksiyonlarla aynıdır. Kâr ve iskonto oranı dışarı çıkmaz:
// yalnız nihai m² fiyatı, araç metrajı ve araç toplamı taşınır.

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { computeBonusUnitSale } from '@/lib/pricing/bonus/sale'
import { citySubRegionQuestion, type BonusSubRegionChoice } from '@/lib/pricing/bonus/subRegions'
import { getComparisonProfiles, type ComparisonProfile } from '@/lib/technical-profiles'
import {
  bonusVehiclePrices,
  platePricesForModel,
  type ComparisonSnapshot,
  type LogisticsRow,
  type PlateCatalogData,
  type VehiclePrices,
} from './vehiclePrices'

export type { ComparisonSnapshot }

export const SNAPSHOT_CITY_CODE = 34

export function defaultSubChoiceFor(cityCode: number): BonusSubRegionChoice | null {
  const info = citySubRegionQuestion(cityCode)
  if (!info) return null
  return (Object.keys(info.options) as BonusSubRegionChoice[])[0] ?? null
}

export async function getComparisonSnapshots(
  thicknesses: readonly number[],
  cityCode = SNAPSHOT_CITY_CODE,
  profiles: ComparisonProfile[] = getComparisonProfiles(),
): Promise<Map<number, ComparisonSnapshot>> {
  const supabase = createServerSupabaseClient()
  const [platesRes, ppRes, zoneRes, mtRes, lcRes, brandRes] = await Promise.all([
    supabase.from('plates').select('*').eq('is_active', true),
    supabase.from('plate_prices').select('*'),
    supabase.from('shipping_zones').select('city_code, city_name, discount_kamyon, discount_tir').eq('city_code', cityCode).maybeSingle(),
    supabase.from('material_types').select('*').eq('slug', 'tasyunu').maybeSingle(),
    supabase.from('logistics_capacity').select('thickness, lorry_capacity_packages, truck_capacity_packages, package_size_m2'),
    supabase.from('brands').select('margin_pct').eq('name', 'Bonus').maybeSingle(),
  ])
  const failed = [platesRes, ppRes, zoneRes, mtRes, lcRes, brandRes].find((r) => r.error)
  if (failed?.error) throw new Error(`Karşılaştırma fiyat fotoğrafı alınamadı: ${failed.error.message}`)

  const data: PlateCatalogData = {
    plates: platesRes.data ?? [],
    platePrices: ppRes.data ?? [],
    zone: zoneRes.data ?? null,
    marginRule: mtRes.data ?? null,
    logistics: (lcRes.data ?? []) as LogisticsRow[],
  }
  const subChoice = defaultSubChoiceFor(cityCode)
  const slugs: Record<string, string> = {}
  for (const plate of (platesRes.data ?? []) as Array<{ short_name: string | null; slug?: string | null }>) {
    if (plate.short_name && plate.slug && !slugs[plate.short_name]) slugs[plate.short_name] = plate.slug
  }

  const out = new Map<number, ComparisonSnapshot>()
  for (const thicknessCm of thicknesses) {
    const prices: Record<string, VehiclePrices | null> = {}
    for (const profile of profiles) {
      if (profile.brandName === 'Bonus') {
        const sale = computeBonusUnitSale({
          modelShortName: profile.modelShortName,
          thicknessCm,
          cityCode,
          subChoice,
          brandMarginPct: brandRes.data?.margin_pct ?? null,
        })
        const vehicle = sale.ok ? bonusVehiclePrices(sale.salePricePerM2, sale.kamyonM2 ?? null, sale.tirM2 ?? null) : null
        prices[profile.productKey] = vehicle?.kamyon ? vehicle : null
      } else {
        prices[profile.productKey] = platePricesForModel(data, profile.modelShortName, thicknessCm)
      }
    }
    out.set(thicknessCm, {
      cityCode,
      cityName: zoneRes.data?.city_name ?? 'İstanbul',
      subChoice,
      thicknessCm,
      prices,
      slugs,
    })
  }
  return out
}

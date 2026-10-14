// Merkez (hub) sayfalarının adresleri ve kapsamı (Emrah onayı, 14 Ekim 2026 — hub planı).
//
// NEDEN: "10 cm taş yünü fiyatları", "5 cm 150 yoğunluk taş yünü m² fiyatı" gibi aramalar tek bir ürün
// sayfasına düşüyordu (8 ürünün başlığı aynı kalıptaydı). Her kalınlık ve yoğunluk için o aramayla aynı
// başlayan bir sayfa vardır; sayfa yalnız kapsamındaki ürünleri gösterir, tek ürüne ve set hesabına dağıtır.

import { formatThicknessSegment } from '@/lib/catalog/thickness-url'
import type { ComparisonProfile } from '@/lib/technical-profiles'

/** Karşılaştırma tablosunun kalınlık seçenekleriyle aynı. */
export const HUB_THICKNESSES = [3, 4, 5, 6, 7, 8, 10, 12, 15] as const

export const COMPARISON_PATH = '/tasyunu-karsilastir'
export const DENSITY_150_PATH = '/tasyunu-yogunluk/150-kg-m3'
export const DENSITY_120_PATH = '/tasyunu-yogunluk/120-kg-m3'

export function thicknessHubPath(thicknessCm: number): string {
  return `/tasyunu-fiyatlari/${formatThicknessSegment(thicknessCm)}`
}

export function density150HubPath(thicknessCm?: number | null): string {
  return thicknessCm == null ? DENSITY_150_PATH : `${DENSITY_150_PATH}/${formatThicknessSegment(thicknessCm)}`
}

/** Föy beyanıyla 150 kg/m³ (sözlü beyan bu sınıfa girmez). */
export function isDensity150(profile: ComparisonProfile): boolean {
  return profile.density.sourceType === 'datasheet' && profile.density.minKgM3 >= 150
}

/** 120 sınıfı (Emrah, 14 Ekim 2026): 150'lik değil ve beyan edilen üst değer en az 120 (F 120, LD125, SW035 sözlü 110–120). */
export function isDensity120Class(profile: ComparisonProfile): boolean {
  return !isDensity150(profile) && profile.density.maxKgM3 >= 120
}

/** 100–110 sınıfı: 120'ye ulaşmayanlar (Optimix ve Expert Premium, sözlü beyan) — 120 sayfasında "alternatif". */
export function isDensity100To110(profile: ComparisonProfile): boolean {
  return profile.density.maxKgM3 < 120
}

/** 150/kalınlık hub'ı yalnız o kalınlıkta en az iki 150'liğin fiyatı varsa açılır (tek ürün karşılaştırma değildir). */
export const MIN_PRODUCTS_PER_DENSITY_HUB = 2

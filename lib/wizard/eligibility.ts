// ============================================================
// Mantolama wizard model uygunluğu — tek karar noktası
//
// FR-002 / FR-007 (docs/verification/bonus-yogunluk-karsilastirma-prd.md):
// wizard yalnız sıvalı dış cephe mantolamasına uygun levhaları gösterir;
// çatı, ara bölme, giydirme cephe ve endüstriyel levhalar katalogda kalır.
//
// Taşyünü uygunluğu teknik profil verisinden gelir (wizard_eligible).
// EPS mantolama modelleri ayrı listededir: teknik profil havuzu şimdilik
// taşyünü yoğunluk çalışmasını kapsıyor; EPS profilleri ayrı iş kalemidir.
// ============================================================

import { isWizardEligibleModel as isTasyunuMantolamaModel } from '@/lib/technical-profiles'

export type WizardMalzeme = 'tasyunu' | 'eps'

export const EPS_MANTOLAMA_MODELLER: readonly string[] = [
  'İdeal Carbon',
  'Double Carbon',
  'EPS Karbonlu',
  'EPS Beyaz',
  'EPS 035 Beyaz',
  // Optimix Karbonlu (marka ayrı alanda; 16 Ekim 2026'ya kadar short_name
  // "Optimix Karbonlu" idi).
  'Karbonlu',
]

export function isMantolamaWizardModel(
  malzeme: string | null | undefined,
  modelShortName: string | null | undefined,
): boolean {
  if (!modelShortName) return false
  if (malzeme === 'tasyunu') return isTasyunuMantolamaModel(modelShortName)
  if (malzeme === 'eps') return EPS_MANTOLAMA_MODELLER.includes(modelShortName)
  return false
}

export function filterMantolamaWizardModels(
  malzeme: string | null | undefined,
  models: readonly string[],
): string[] {
  return models.filter((model) => isMantolamaWizardModel(malzeme, model))
}

// Hesaplayıcıda gösterilmeyen toz grubu markaları (Emrah, 24 Ekim 2026):
// TEKNO setinde hazır toz seti tam kurulmuyor, fiyatı ve nakliyesi
// netleşmiyor. Kayıtlar veritabanında durur; ofis teklif ekranı etkilenmez.
export const WIZARD_HIDDEN_ACCESSORY_BRANDS: readonly string[] = ['TEKNO']

export function isWizardAccessoryBrandHidden(brandName: string | null | undefined): boolean {
  if (!brandName) return false
  return WIZARD_HIDDEN_ACCESSORY_BRANDS.includes(brandName.trim().toLocaleUpperCase('tr-TR'))
}

/** Toz grubu markası gizli olan paket tanımlarını çıkarır. */
export function filterWizardPackageDefinitions<T extends { accessory_brand_id: number | null }>(
  definitions: readonly T[],
  brands: ReadonlyArray<{ id: number; name: string | null }>,
): T[] {
  const hiddenIds = new Set(
    brands.filter((brand) => isWizardAccessoryBrandHidden(brand.name)).map((brand) => brand.id),
  )
  return definitions.filter(
    (definition) => definition.accessory_brand_id == null || !hiddenIds.has(definition.accessory_brand_id),
  )
}

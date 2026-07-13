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
  'Optimix Karbonlu',
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

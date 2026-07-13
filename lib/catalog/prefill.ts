// ============================================================
// Wizard prefill üretimi — yalnız mantolama-uygun levhalar için
//
// FR-007 / AC-007: çatı, ara bölme, giydirme cephe veya endüstriyel
// bir levhanın ürün sayfası mantolama wizard'ına prefill üretmez.
// Uygunluk kararı lib/wizard/eligibility üzerinden verilir; burada
// ikinci bir liste tutulmaz.
// ============================================================

import { isMantolamaWizardModel } from '@/lib/wizard/eligibility'
import type { WizardPrefill } from '@/lib/catalog/types'

export interface WizardPrefillInput {
  plateId: number
  plateName: string
  shortName: string | null
  materialSlug: string | null
  brandId: number | null
  brandName: string | null
  kalinlik: number | null
}

export function buildWizardPrefill(input: WizardPrefillInput): WizardPrefill | null {
  const model = input.shortName ?? input.plateName

  if (!isMantolamaWizardModel(input.materialSlug, model)) return null

  return {
    levhaTipi: input.materialSlug as WizardPrefill['levhaTipi'],
    markaId: input.brandId,
    markaAdi: input.brandName,
    modelId: input.plateId,
    modelAdi: model,
    kalinlik: input.kalinlik,
  }
}

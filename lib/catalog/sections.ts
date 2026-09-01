// ============================================================
// Taşyünü katalog bölümleri — kullanım alanına göre gruplama
//
// Karar (Emrah, 21 Temmuz 2026 — Faz 1): tasyunu-levha listesi düz
// ızgara yerine kullanım alanı bölümleriyle sunulur; mantolama
// müşterisi ile gemi/endüstriyel müşterisi aynı listede boğulmaz.
// Bölüm bilgisi teknik profillerdeki applicationScope'tan türetilir;
// profili olmayan teklif-üzerine modeller (Marin, Desibel, Panel,
// Kapı Paneli) elle eşlenir. Faz 2'de bu bölümler ayrı SEO
// sayfalarına taşınacak — sıralama ve anahtar adları o güne kadar
// URL üretmeye uygun (kebab-case) tutulur.
// ============================================================

import {
  DENSITY_SOURCE_LABELS,
  getProfileByModel,
  type ApplicationScope,
} from '@/lib/technical-profiles'
import { getBonusFamily } from '@/lib/pricing/bonus/families'

export type TasyunuSectionKey =
  | 'mantolama'
  | 'giydirme-cephe'
  | 'cati'
  | 'kat-arasi-tesisat'
  | 'endustriyel'
  | 'gemi-marin'
  | 'bolme-panel'

export interface TasyunuSection {
  key: TasyunuSectionKey
  title: string
  /** Bölüm başlığı altındaki 1-2 cümlelik açıklama (SEO metni) */
  desc: string
}

export const TASYUNU_SECTIONS: readonly TasyunuSection[] = [
  {
    key: 'mantolama',
    title: 'Mantolama Levhaları',
    desc:
      'Sıvalı dış cephe ısı yalıtımı için taşyünü levhalar. Komple set (levha + yapıştırıcı, sıva, dübel, file) fiyatı hesap makinesinden alınır.',
  },
  {
    key: 'giydirme-cephe',
    title: 'Giydirme Cephe Levhaları',
    desc:
      'Havalandırmalı ve havalandırmasız giydirme cephe sistemleri için cam tüllü, folyolu ve kaplamasız taşyünü levhalar.',
  },
  {
    key: 'cati',
    title: 'Çatı Levhaları',
    desc:
      'Teras çatı, endüstriyel çatı ve üzerinde gezilen çatılar için yüksek basma dayanımlı taşyünü levhalar.',
  },
  {
    key: 'kat-arasi-tesisat',
    title: 'Kat Arası & Tesisat',
    desc:
      'Kat aralarında darbe sesi yalıtımı ve klima/havalandırma kanallarının yalıtımı için taşyünü levhalar.',
  },
  {
    key: 'endustriyel',
    title: 'Endüstriyel Yalıtım',
    desc:
      'Kazan, tesisat ve egzoz boruları, bacalar ve çelik konstrüksiyon için endüstriyel levha ve rabitz telli şilte.',
  },
  {
    key: 'gemi-marin',
    title: 'Gemi & Marin',
    desc:
      'Tersane ve gemi uygulamaları için marin sertifikalı taşyünü levha ve şilte serisi; makine dairesi, boru ve baca sarımları.',
  },
  {
    key: 'bolme-panel',
    title: 'Bölme Duvar & Panel',
    desc:
      'Ara bölme ve komşu duvarlar için alçı kaplı kompozit levha ile yangın dayanımlı kapı ve sandviç panel dolguları.',
  },
]

// Profili olmayan teklif-üzerine modeller (fiyat listesinde fiyatı yok,
// teknik profil havuzuna alınmadılar) — elle eşleme.
const MODEL_SECTION_OVERRIDES: Record<string, TasyunuSectionKey> = {
  Marin: 'gemi-marin',
  Desibel: 'bolme-panel',
  'Kapı Paneli': 'bolme-panel',
  Panel: 'bolme-panel',
}

const SCOPE_TO_SECTION: Record<ApplicationScope, TasyunuSectionKey> = {
  sivali_dis_cephe_mantolama: 'mantolama',
  giydirme_cephe: 'giydirme-cephe',
  cati: 'cati',
  kat_arasi_doseme: 'kat-arasi-tesisat',
  tesisat: 'kat-arasi-tesisat',
  endustriyel: 'endustriyel',
}

/**
 * Model → bölüm anahtarı. Profilsiz ve eşlemesiz modeller mantolamaya
 * düşer (mevcut katalog çekirdeği mantolama ürünüdür; yeni kapsam
 * eklendiğinde profil de eklenir).
 */
export function resolveTasyunuSection(modelShortName: string | null): TasyunuSectionKey {
  if (modelShortName) {
    const override = MODEL_SECTION_OVERRIDES[modelShortName]
    if (override) return override
    const scope = getProfileByModel(modelShortName)?.applicationScope
    if (scope) return SCOPE_TO_SECTION[scope]
  }
  return 'mantolama'
}

/**
 * Kart yoğunluk rozeti. Aile PDP'lerinde (Gold Plus vb.) tüm
 * varyantların beyan yoğunlukları birleştirilir; tekil üründe föy
 * beyanı metni aynen kullanılır. Beyan yoksa rozet çıkmaz — değer
 * uydurulmaz (Premium F/R kuralı).
 */
export function getDensityBadge(modelShortName: string | null): string | null {
  if (!modelShortName) return null
  const family = getBonusFamily(modelShortName)
  if (family) {
    const values = family.variants
      .map((v) => getProfileByModel(v.modelShortName)?.density?.minKgM3)
      .filter((v): v is number => typeof v === 'number')
    if (values.length === 0) return null
    return `${[...new Set(values)].sort((a, b) => a - b).join('/')} kg/m³`
  }
  return getProfileByModel(modelShortName)?.density?.display ?? null
}

/** Yoğunluk rozetinin müşteri yüzeyinde gösterilecek doğrulanmış kaynağı. */
export function getDensitySourceLabel(modelShortName: string | null): string | null {
  if (!modelShortName) return null
  const family = getBonusFamily(modelShortName)
  const sourceTypes = family
    ? family.variants
        .map((variant) => getProfileByModel(variant.modelShortName)?.density?.sourceType)
        .filter((value): value is keyof typeof DENSITY_SOURCE_LABELS => Boolean(value))
    : [getProfileByModel(modelShortName)?.density?.sourceType]
        .filter((value): value is keyof typeof DENSITY_SOURCE_LABELS => Boolean(value))

  const unique = [...new Set(sourceTypes)]
  if (unique.length !== 1) return null
  return DENSITY_SOURCE_LABELS[unique[0]]
}

/** "2–15 cm · 13 kalınlık" biçiminde tek satır özet (TR ondalık virgül). */
export function formatThicknessSummary(
  options: readonly number[] | null,
): string | null {
  if (!options || options.length === 0) return null
  const sorted = [...options].sort((a, b) => a - b)
  const fmt = (n: number) => String(n).replace('.', ',')
  if (sorted.length === 1) return `${fmt(sorted[0])} cm`
  return `${fmt(sorted[0])}–${fmt(sorted[sorted.length - 1])} cm · ${sorted.length} kalınlık`
}

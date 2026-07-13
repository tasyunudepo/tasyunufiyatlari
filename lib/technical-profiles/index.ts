// ============================================================
// Teknik profil — sıvalı dış cephe mantolama levhaları
//
// Karar kaynağı: bonus-karsilastirma-fikir-turlari.md (Tur 2 föy
// doğrulaması + Tur 3 Emrah kararı) ve
// docs/verification/bonus-yogunluk-karsilastirma-prd.md.
//
// İki kaynak türü vardır ve müşteri yüzeyinde ayrımı zorunludur:
//   - datasheet          → "Föy beyanı" (belge + indirme tarihi)
//   - manufacturer_verbal → "Üretici sözlü beyanı — değişken"
//
// Sözlü bildirimi yapan kişi/kanal bilgisi bu modülde TUTULMAZ;
// yalnız DB'deki plate_technical_profile_private_notes tablosunda
// durur (migration-v18) ve anon/public erişime kapalıdır.
// ============================================================

export type DensitySourceType = 'datasheet' | 'manufacturer_verbal'

export const DENSITY_SOURCE_LABELS: Record<DensitySourceType, string> = {
  datasheet: 'Föy beyanı',
  manufacturer_verbal: 'Üretici sözlü beyanı — değişken',
}

export interface TechnicalProfile {
  /** DB product_key ile birebir aynı, kalıcı kimlik */
  productKey: string
  brandName: string
  /** plates.short_name — wizard model chip'i bu adla eşleşir */
  modelShortName: string
  displayName: string
  applicationScope: 'sivali_dis_cephe_mantolama'
  wizardEligible: boolean
  comparisonEligible: boolean
  density: {
    /** kg/m³; tek değer beyan edildiyse min === max */
    minKgM3: number
    maxKgM3: number
    /** Müşteri ekranındaki değer metni, föydeki beyan biçimiyle */
    display: string
    sourceType: DensitySourceType
    /** ISO tarih: föy indirme veya sözlü bildirim tarihi */
    sourceDate: string
  }
  /** λD — föy beyanı; Bonus föyleri kalınlığa göre aralık verir */
  lambdaDisplay: string
  /** Yüzeye dik çekme — föydeki beyan biçimiyle */
  tensileDisplay: string
  /** TS EN 1607 sınıfı (varsa). TR7.5 üründe adın kaynağıdır; yoğunluk değildir. */
  tensileClass: string | null
  /** %10 deformasyonda basma — NPD notu dahil */
  compressiveDisplay: string
  fireClass: 'A1'
  thicknessMmMin: number
  thicknessMmMax: number
  /** Kaynak belge (yerel arşiv yolu) */
  datasheetRef: string
}

const PROFILES: readonly TechnicalProfile[] = [
  {
    productKey: 'bonus-premium-f-150',
    brandName: 'Bonus',
    modelShortName: 'F 150',
    displayName: 'Bonus Premium F 150',
    applicationScope: 'sivali_dis_cephe_mantolama',
    wizardEligible: true,
    comparisonEligible: true,
    density: {
      minKgM3: 150,
      maxKgM3: 150,
      display: '150 kg/m³ (±%10)',
      sourceType: 'datasheet',
      sourceDate: '2026-07-13',
    },
    lambdaDisplay: '0,036–0,040 W/mK (kalınlığa göre)',
    tensileDisplay: '15 kPa',
    tensileClass: null,
    compressiveDisplay: '40–70 kPa (kalınlığa göre; ince kalınlıkta NPD)',
    fireClass: 'A1',
    thicknessMmMin: 20,
    thicknessMmMax: 130,
    datasheetRef: '_audit/teknik-foyler/2026-07/bonus-premium-f-150.pdf',
  },
  {
    productKey: 'bonus-premium-f-150-pro',
    brandName: 'Bonus',
    modelShortName: 'F 150 Pro',
    displayName: 'Bonus Premium F 150 Pro',
    applicationScope: 'sivali_dis_cephe_mantolama',
    wizardEligible: true,
    comparisonEligible: true,
    density: {
      minKgM3: 150,
      maxKgM3: 150,
      display: '150 kg/m³ (±%10)',
      sourceType: 'datasheet',
      sourceDate: '2026-07-13',
    },
    lambdaDisplay: '0,036–0,038 W/mK (kalınlığa göre)',
    tensileDisplay: '10 kPa',
    tensileClass: null,
    compressiveDisplay: '35–50 kPa (ince kalınlıkta NPD)',
    fireClass: 'A1',
    thicknessMmMin: 30,
    thicknessMmMax: 120,
    datasheetRef: '_audit/teknik-foyler/2026-07/bonus-premium-f-150-pro.pdf',
  },
  {
    productKey: 'expert-hd150',
    brandName: 'Expert',
    modelShortName: 'HD150',
    displayName: 'Expert HD150 Taşyünü',
    applicationScope: 'sivali_dis_cephe_mantolama',
    wizardEligible: true,
    comparisonEligible: true,
    density: {
      minKgM3: 150,
      maxKgM3: 150,
      display: '≥150 kg/m³',
      sourceType: 'datasheet',
      sourceDate: '2026-07-13',
    },
    lambdaDisplay: '0,038 W/mK',
    tensileDisplay: '≥15 kPa',
    tensileClass: 'TR15',
    compressiveDisplay: '≥40 kPa — CS(10)40 (30 mm için föy notu: değer farklılaşabilir)',
    fireClass: 'A1',
    thicknessMmMin: 30,
    thicknessMmMax: 150,
    datasheetRef: 'docs/ExpertTaşyünüHD150IsiYalitimLevhasiTDS.pdf',
  },
  {
    productKey: 'bonus-premium-f-120',
    brandName: 'Bonus',
    modelShortName: 'F 120',
    displayName: 'Bonus Premium F 120',
    applicationScope: 'sivali_dis_cephe_mantolama',
    wizardEligible: true,
    comparisonEligible: true,
    density: {
      minKgM3: 120,
      maxKgM3: 120,
      display: '120 kg/m³ (±%10)',
      sourceType: 'datasheet',
      sourceDate: '2026-07-13',
    },
    lambdaDisplay: '0,036–0,038 W/mK (kalınlığa göre)',
    tensileDisplay: '10 kPa',
    tensileClass: null,
    compressiveDisplay: '35–50 kPa (ince kalınlıkta NPD)',
    fireClass: 'A1',
    thicknessMmMin: 30,
    thicknessMmMax: 130,
    datasheetRef: '_audit/teknik-foyler/2026-07/bonus-premium-f-120.pdf',
  },
  {
    productKey: 'expert-ld125',
    brandName: 'Expert',
    modelShortName: 'LD125',
    displayName: 'Expert LD125 Taşyünü',
    applicationScope: 'sivali_dis_cephe_mantolama',
    wizardEligible: true,
    comparisonEligible: true,
    density: {
      minKgM3: 125,
      maxKgM3: 125,
      display: '≥125 kg/m³',
      sourceType: 'datasheet',
      sourceDate: '2026-07-13',
    },
    lambdaDisplay: '0,037 W/mK',
    tensileDisplay: '≥7,5 kPa',
    tensileClass: 'TR7.5',
    compressiveDisplay: '≥30 kPa — CS(10)30 (30 mm için föy notu: değer farklılaşabilir)',
    fireClass: 'A1',
    thicknessMmMin: 30,
    thicknessMmMax: 150,
    datasheetRef: 'docs/6.ExpertTaşyünüLD125IsiYalitimLevhasiTDS.pdf',
  },
  {
    productKey: 'dalmacyali-sw035',
    brandName: 'Dalmaçyalı',
    modelShortName: 'SW035',
    displayName: 'Dalmaçyalı Stonewool SW035',
    applicationScope: 'sivali_dis_cephe_mantolama',
    wizardEligible: true,
    comparisonEligible: true,
    density: {
      minKgM3: 110,
      maxKgM3: 120,
      display: '110–120 kg/m³',
      sourceType: 'manufacturer_verbal',
      sourceDate: '2026-07-13',
    },
    lambdaDisplay: '0,035 W/mK',
    tensileDisplay: '≥10 kPa',
    tensileClass: 'TR10',
    compressiveDisplay: '≥30 kPa — CS(10)30 (30 mm için föy notu: değer farklılaşabilir)',
    fireClass: 'A1',
    thicknessMmMin: 30,
    thicknessMmMax: 100,
    datasheetRef: 'docs/dalmacyali_stonewool_sw_035_tasyuenue_isi_yalitim_levhasi_68f039f652.pdf',
  },
  {
    productKey: 'expert-tasyunu-premium',
    brandName: 'Expert',
    modelShortName: 'Premium',
    displayName: 'Expert Taşyünü Premium',
    applicationScope: 'sivali_dis_cephe_mantolama',
    wizardEligible: true,
    comparisonEligible: true,
    density: {
      minKgM3: 100,
      maxKgM3: 110,
      display: '100–110 kg/m³',
      sourceType: 'manufacturer_verbal',
      sourceDate: '2026-07-13',
    },
    lambdaDisplay: '0,035 W/mK',
    tensileDisplay: '≥7,5 kPa',
    tensileClass: 'TR7.5',
    compressiveDisplay: '≥25 kPa — CS(10)25 (30 mm için föy notu: değer farklılaşabilir)',
    fireClass: 'A1',
    thicknessMmMin: 30,
    thicknessMmMax: 100,
    datasheetRef: 'docs/4-1ExpertTaşyünüPremiumIsiYalitimLevhasiTDS_Rev.pdf',
  },
  {
    productKey: 'fawori-optimix-tr75',
    brandName: 'Optimix',
    modelShortName: 'TR7.5',
    displayName: 'Fawori Optimix TR7.5',
    applicationScope: 'sivali_dis_cephe_mantolama',
    wizardEligible: true,
    comparisonEligible: true,
    density: {
      minKgM3: 100,
      maxKgM3: 120,
      display: '100–120 kg/m³',
      sourceType: 'manufacturer_verbal',
      sourceDate: '2026-07-13',
    },
    lambdaDisplay: '0,035 W/mK',
    tensileDisplay: '≥7,5 kPa',
    tensileClass: 'TR7.5',
    compressiveDisplay: '≥25 kPa — CS(10)25',
    fireClass: 'A1',
    thicknessMmMin: 40,
    thicknessMmMax: 150,
    datasheetRef: 'docs/Fawori_Tasyuenue_TR_7_5_Isi_Yalitim_Levhasi_TDS_4b4e64b7ab.pdf',
  },
]

export function getComparisonProfiles(): TechnicalProfile[] {
  // Karar: 150 föy beyanlı üç ürün önde; kalanlar yoğunluk azalan sırada.
  return [...PROFILES]
    .filter((p) => p.comparisonEligible)
    .sort((a, b) => {
      const aPinned = a.density.sourceType === 'datasheet' && a.density.minKgM3 >= 150 ? 1 : 0
      const bPinned = b.density.sourceType === 'datasheet' && b.density.minKgM3 >= 150 ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      return b.density.maxKgM3 - a.density.maxKgM3
    })
}

export function getProfileByModel(modelShortName: string): TechnicalProfile | null {
  return PROFILES.find((p) => p.modelShortName === modelShortName) ?? null
}

export function getProfileByKey(productKey: string): TechnicalProfile | null {
  return PROFILES.find((p) => p.productKey === productKey) ?? null
}

/** Wizard yalnız mantolamaya uygun taşyünü modellerini gösterebilir (FR-002). */
export function isWizardEligibleModel(modelShortName: string): boolean {
  const profile = getProfileByModel(modelShortName)
  return profile !== null && profile.wizardEligible
}

export function densitySourceLabel(profile: TechnicalProfile): string {
  return DENSITY_SOURCE_LABELS[profile.density.sourceType]
}

/** Müşteri ekranı için değer + zorunlu kaynak etiketi tek parça. */
export function densityWithSourceLabel(profile: TechnicalProfile): string {
  return `${profile.density.display} · ${densitySourceLabel(profile)}`
}

export function getAllProfiles(): readonly TechnicalProfile[] {
  return PROFILES
}

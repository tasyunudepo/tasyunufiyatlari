// ============================================================
// Teknik profil — taşyünü ürün havuzu (tüm kullanım alanları)
//
// Karar kaynağı: bonus-karsilastirma-fikir-turlari.md (Tur 2 föy
// doğrulaması + Tur 3 Emrah kararı) ve
// docs/verification/bonus-yogunluk-karsilastirma-prd.md.
// 2026-07-20 genişletmesi: Bonus'un mantolama dışı taşyünü aileleri
// (giydirme cephe, çatı, kat arası, tesisat, endüstriyel) eklendi;
// kaynak _audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf
// teknik özellik sayfalarıdır. Wizard kapsamı DEĞİŞMEDİ: yalnız
// applicationScope='sivali_dis_cephe_mantolama' + wizardEligible=true.
//
// İki kaynak türü vardır ve müşteri yüzeyinde ayrımı zorunludur:
//   - datasheet          → "Föy beyanı" (belge + indirme tarihi)
//   - manufacturer_verbal → "Üretici sözlü beyanı — değişken"
//
// Föy yoğunluk beyan etmiyorsa density=null tutulur; değer UYDURULMAZ
// (Premium F, Premium R, Premium R 150 — ad model adıdır, beyan değildir).
//
// Sözlü bildirimi yapan kişi/kanal bilgisi bu modülde TUTULMAZ;
// yalnız DB'deki plate_technical_profile_private_notes tablosunda
// durur (migration-v18) ve anon/public erişime kapalıdır.
// ============================================================

export type DensitySourceType = 'datasheet' | 'manufacturer_verbal'

export type ApplicationScope =
  | 'sivali_dis_cephe_mantolama'
  | 'giydirme_cephe'
  | 'cati'
  | 'kat_arasi_doseme'
  | 'tesisat'
  | 'endustriyel'

export const APPLICATION_SCOPE_LABELS: Record<ApplicationScope, string> = {
  sivali_dis_cephe_mantolama: 'Sıvalı dış cephe mantolama',
  giydirme_cephe: 'Giydirme cephe',
  cati: 'Çatı',
  kat_arasi_doseme: 'Kat arası / döşeme',
  tesisat: 'Tesisat / havalandırma',
  endustriyel: 'Endüstriyel',
}

export const DENSITY_SOURCE_LABELS: Record<DensitySourceType, string> = {
  datasheet: 'Föy beyanı',
  manufacturer_verbal: 'Üretici sözlü beyanı — değişken',
}

export interface DensityDeclaration {
  /** kg/m³; tek değer beyan edildiyse min === max */
  minKgM3: number
  maxKgM3: number
  /** Müşteri ekranındaki değer metni, föydeki beyan biçimiyle */
  display: string
  sourceType: DensitySourceType
  /** ISO tarih: föy indirme veya sözlü bildirim tarihi */
  sourceDate: string
}

export interface TechnicalProfile {
  /** DB product_key ile birebir aynı, kalıcı kimlik */
  productKey: string
  brandName: string
  /** plates.short_name — wizard model chip'i bu adla eşleşir */
  modelShortName: string
  displayName: string
  applicationScope: ApplicationScope
  wizardEligible: boolean
  comparisonEligible: boolean
  /** null = föyde yoğunluk beyanı yok (değer uydurulmaz) */
  density: DensityDeclaration | null
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
  /** Müşteri yüzeyi için teknik föyden editoryal olarak türetilmiş kısa içerik. */
  editorial?: {
    summary: string
    highlights: readonly string[]
    boardSize: string
  }
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
    editorial: {
      summary: 'Bazalt mineral liflerinden üretilen, kaplamasız bir dış cephe ısı yalıtım levhasıdır. Sıvalı dış cephe mantolama sistemlerinde ısı, ses ve yangın yalıtımına katkı sağlamak üzere kullanılır.',
      highlights: [
        '1200 × 600 mm levha ölçüsünde üretilir.',
        'Föyde 20–130 mm kalınlık aralığı beyan edilir.',
        'A1 yangına tepki sınıfındadır.',
      ],
      boardSize: '1200 × 600 mm',
    },
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
    editorial: {
      summary: 'Bazalt mineral liflerinden üretilen, kaplamasız ve sıvalı dış cephe uygulamalarına yönelik taşyünü levhadır. Mantolama sisteminde ısı, ses ve yangın yalıtımına katkı sağlar.',
      highlights: [
        '1200 × 600 mm levha ölçüsünde üretilir.',
        'Föyde 30–120 mm kalınlık aralığı beyan edilir.',
        'A1 yangına tepki sınıfındadır.',
      ],
      boardSize: '1200 × 600 mm',
    },
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
    editorial: {
      summary: 'Volkanik kayaçlardan elde edilen inorganik liflerle üretilmiş, sıvalı dış cephe mantolama uygulamalarına yönelik taşyünü ısı yalıtım levhasıdır.',
      highlights: [
        '600 × 1000 mm levha ölçüsünde üretilir.',
        'Föyde 30–150 mm kalınlık aralığı beyan edilir.',
        'TR15 çekme ve CS(10)40 basma sınıfı beyanına sahiptir.',
      ],
      boardSize: '600 × 1000 mm',
    },
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
    editorial: {
      summary: 'Bazalt mineral liflerinden üretilen, kaplamasız bir mantolama levhasıdır. Sıvalı dış cephe sistemlerinde ısı, ses ve yangın yalıtımına katkı sağlamak üzere kullanılır.',
      highlights: [
        '1200 × 600 mm levha ölçüsünde üretilir.',
        'Föyde 30–130 mm kalınlık aralığı beyan edilir.',
        'A1 yangına tepki sınıfındadır.',
      ],
      boardSize: '1200 × 600 mm',
    },
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
    editorial: {
      summary: 'Volkanik kayaçlardan elde edilen inorganik liflerle üretilmiş, sıvalı dış cephe mantolama uygulamalarına yönelik taşyünü ısı yalıtım levhasıdır.',
      highlights: [
        '600 × 1000 mm levha ölçüsünde üretilir.',
        'Föyde 30–150 mm kalınlık aralığı beyan edilir.',
        'TR7.5 çekme ve CS(10)30 basma sınıfı beyanına sahiptir.',
      ],
      boardSize: '600 × 1000 mm',
    },
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
    editorial: {
      summary: 'Sıvalı dış cephe mantolama sistemlerinde kullanılmak üzere geliştirilmiş taşyünü ısı yalıtım levhasıdır. Teknik föyünde ısı iletkenliği, mekanik dayanım ve A1 yangına tepki değerleri birlikte beyan edilir.',
      highlights: [
        '600 × 1000 mm levha ölçüsünde üretilir.',
        'Föyde 30–100 mm kalınlık aralığı beyan edilir.',
        'TR10 çekme ve CS(10)30 basma sınıfı beyanına sahiptir.',
      ],
      boardSize: '600 × 1000 mm',
    },
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
    editorial: {
      summary: 'Sıvalı dış cephe mantolama sistemlerinde kullanılmak üzere geliştirilmiş taşyünü ısı yalıtım levhasıdır. Teknik seçimde ısı iletkenliği ile yüzeye dik çekme ve basma dayanımı birlikte değerlendirilir.',
      highlights: [
        '600 × 1000 mm levha ölçüsünde üretilir.',
        'Föyde 30–100 mm kalınlık aralığı beyan edilir.',
        'TR7.5 çekme ve CS(10)25 basma sınıfı beyanına sahiptir.',
      ],
      boardSize: '600 × 1000 mm',
    },
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
    editorial: {
      summary: 'Sıvalı dış cephe mantolama uygulamalarına yönelik taşyünü ısı yalıtım levhasıdır. Teknik föyünde ısı iletkenliği, çekme dayanımı, basma dayanımı ve A1 yangına tepki sınıfı beyan edilir.',
      highlights: [
        '600 × 1000 mm levha ölçüsünde üretilir.',
        'Föyde 40–150 mm kalınlık aralığı beyan edilir.',
        'TR7.5 çekme ve CS(10)25 basma sınıfı beyanına sahiptir.',
      ],
      boardSize: '600 × 1000 mm',
    },
  },
  // ── 2026-07-20 genişletmesi — Bonus mantolama dışı aileler ──
  // Kaynak: bonus-fiyat-listesi-haziran-2026.pdf teknik özellik sayfaları
  // (Gold s.46, Premium F s.56, Premium R s.62, Platin s.65, Private s.67,
  // Endüstriyel Levha s.69, Endüstriyel Şilte s.72). Satılabilir kalınlık
  // kaynağı fiyat listesidir; thicknessMmMin/Max föy beyanıdır.
  ...bonusGoldFamily(),
  {
    productKey: 'bonus-premium-f',
    brandName: 'Bonus',
    modelShortName: 'Premium F',
    displayName: 'Bonus Premium F',
    applicationScope: 'sivali_dis_cephe_mantolama',
    // Yoğunluk föyde beyan edilmediği için yoğunluk-karşılaştırma
    // matrisine ve wizard'a alınmaz (FR-002 gerekçesi: matris föy
    // beyanı üzerine kuruludur).
    wizardEligible: false,
    comparisonEligible: false,
    density: null,
    lambdaDisplay: '0,035 W/mK',
    tensileDisplay: '≥7,5 kPa',
    tensileClass: 'TR7.5',
    compressiveDisplay: 'Aranmaz',
    fireClass: 'A1',
    thicknessMmMin: 40,
    thicknessMmMax: 120,
    datasheetRef: '_audit/teknik-foyler/2026-07/bonus-premium-f.pdf',
  },
  {
    productKey: 'bonus-premium-r',
    brandName: 'Bonus',
    modelShortName: 'Premium R',
    displayName: 'Bonus Premium R',
    applicationScope: 'cati',
    wizardEligible: false,
    comparisonEligible: false,
    density: null,
    lambdaDisplay: '0,037 W/mK',
    tensileDisplay: 'Aranmaz',
    tensileClass: null,
    compressiveDisplay: '≥35 kPa',
    fireClass: 'A1',
    thicknessMmMin: 40,
    thicknessMmMax: 150,
    datasheetRef: '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s62',
  },
  {
    productKey: 'bonus-premium-r-150',
    brandName: 'Bonus',
    modelShortName: 'Premium R 150',
    displayName: 'Bonus Premium R 150',
    applicationScope: 'cati',
    wizardEligible: false,
    comparisonEligible: false,
    density: null,
    lambdaDisplay: '0,038 W/mK',
    tensileDisplay: 'Aranmaz',
    tensileClass: null,
    compressiveDisplay: '≥50 kPa',
    fireClass: 'A1',
    thicknessMmMin: 30,
    thicknessMmMax: 150,
    datasheetRef: '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s62',
  },
  {
    productKey: 'bonus-platin-110',
    brandName: 'Bonus',
    modelShortName: 'Platin 110',
    displayName: 'Bonus Platin 110',
    applicationScope: 'kat_arasi_doseme',
    wizardEligible: false,
    comparisonEligible: false,
    density: {
      minKgM3: 110,
      maxKgM3: 110,
      display: '110 kg/m³',
      sourceType: 'datasheet',
      sourceDate: '2026-07-20',
    },
    lambdaDisplay: '0,036 W/mK',
    tensileDisplay: 'Aranmaz',
    tensileClass: null,
    compressiveDisplay: '5 kPa (20–40 mm), 20 kPa (50 mm)',
    fireClass: 'A1',
    thicknessMmMin: 20,
    thicknessMmMax: 50,
    datasheetRef: '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s65',
  },
  {
    productKey: 'bonus-private-70',
    brandName: 'Bonus',
    modelShortName: 'Private 70',
    displayName: 'Bonus Private 70 (Alüminyum Kaplı)',
    applicationScope: 'tesisat',
    wizardEligible: false,
    comparisonEligible: false,
    density: {
      minKgM3: 70,
      maxKgM3: 70,
      display: '70 kg/m³',
      sourceType: 'datasheet',
      sourceDate: '2026-07-20',
    },
    lambdaDisplay: '0,036 W/mK',
    tensileDisplay: 'Aranmaz',
    tensileClass: null,
    compressiveDisplay: 'Aranmaz',
    fireClass: 'A1',
    thicknessMmMin: 25,
    thicknessMmMax: 50,
    datasheetRef: '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s67',
  },
  ...bonusEndustriyelFamily(),
]

/** Gold ailesi — giydirme cephe; 50/70/90 kg/m³, λ 0,035, T4, A1 (s.46). */
function bonusGoldFamily(): TechnicalProfile[] {
  const variants: Array<{
    key: string
    short: string
    display: string
    density: number
    thicknessMin: number
    thicknessMax: number
  }> = [
    { key: 'bonus-gold-plus-50', short: 'Gold Plus 50', display: 'Bonus Gold Plus 50', density: 50, thicknessMin: 30, thicknessMax: 200 },
    { key: 'bonus-gold-black-50', short: 'Gold Black 50', display: 'Bonus Gold Black 50', density: 50, thicknessMin: 50, thicknessMax: 150 },
    { key: 'bonus-gold-yellow-50', short: 'Gold Yellow 50', display: 'Bonus Gold Yellow 50', density: 50, thicknessMin: 50, thicknessMax: 150 },
    { key: 'bonus-gold-alu-50', short: 'Gold Alu 50', display: 'Bonus Gold Alu 50', density: 50, thicknessMin: 50, thicknessMax: 150 },
    { key: 'bonus-gold-plus-70', short: 'Gold Plus 70', display: 'Bonus Gold Plus 70', density: 70, thicknessMin: 30, thicknessMax: 150 },
    { key: 'bonus-gold-black-70', short: 'Gold Black 70', display: 'Bonus Gold Black 70', density: 70, thicknessMin: 30, thicknessMax: 150 },
    { key: 'bonus-gold-yellow-70', short: 'Gold Yellow 70', display: 'Bonus Gold Yellow 70', density: 70, thicknessMin: 30, thicknessMax: 150 },
    { key: 'bonus-gold-plus-90', short: 'Gold Plus 90', display: 'Bonus Gold Plus 90', density: 90, thicknessMin: 30, thicknessMax: 150 },
    { key: 'bonus-gold-black-90', short: 'Gold Black 90', display: 'Bonus Gold Black 90', density: 90, thicknessMin: 30, thicknessMax: 150 },
  ]
  return variants.map((v) => ({
    productKey: v.key,
    brandName: 'Bonus',
    modelShortName: v.short,
    displayName: v.display,
    applicationScope: 'giydirme_cephe' as const,
    wizardEligible: false,
    comparisonEligible: false,
    density: {
      minKgM3: v.density,
      maxKgM3: v.density,
      display: `${v.density} kg/m³`,
      sourceType: 'datasheet' as const,
      sourceDate: '2026-07-20',
    },
    lambdaDisplay: '0,035 W/mK',
    tensileDisplay: 'Aranmaz',
    tensileClass: null,
    compressiveDisplay: 'Aranmaz',
    fireClass: 'A1' as const,
    thicknessMmMin: v.thicknessMin,
    thicknessMmMax: v.thicknessMax,
    datasheetRef: '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46',
  }))
}

/**
 * Endüstriyel aile — levha (s.69) ve rabitz telli şilte (s.72).
 * λ endüstriyel üründe servis sıcaklığına bağlıdır; müşteri yüzeyinde
 * yalnız 50 °C föy değeri gösterilir, uydurma aralık verilmez.
 */
function bonusEndustriyelFamily(): TechnicalProfile[] {
  const variants: Array<{
    key: string
    short: string
    display: string
    density: number
    lambda50: string
    thicknessMin: number
    thicknessMax: number
    page: string
  }> = [
    { key: 'bonus-endustriyel-levha-70', short: 'Endüstriyel Levha 70', display: 'Bonus Endüstriyel Levha 70', density: 70, lambda50: '0,040', thicknessMin: 25, thicknessMax: 120, page: 's69' },
    { key: 'bonus-endustriyel-levha-110', short: 'Endüstriyel Levha 110', display: 'Bonus Endüstriyel Levha 110', density: 110, lambda50: '0,040', thicknessMin: 25, thicknessMax: 120, page: 's69' },
    { key: 'bonus-endustriyel-silte-650', short: 'Endüstriyel Şilte 650', display: 'Bonus Endüstriyel Şilte 650 (Rabitz Telli)', density: 80, lambda50: '0,039', thicknessMin: 50, thicknessMax: 120, page: 's72' },
    { key: 'bonus-endustriyel-silte-700', short: 'Endüstriyel Şilte 700', display: 'Bonus Endüstriyel Şilte 700 (Rabitz Telli)', density: 90, lambda50: '0,039', thicknessMin: 50, thicknessMax: 120, page: 's72' },
    { key: 'bonus-endustriyel-silte-720', short: 'Endüstriyel Şilte 720', display: 'Bonus Endüstriyel Şilte 720 (Rabitz Telli)', density: 100, lambda50: '0,038', thicknessMin: 50, thicknessMax: 120, page: 's72' },
    { key: 'bonus-endustriyel-silte-750', short: 'Endüstriyel Şilte 750', display: 'Bonus Endüstriyel Şilte 750 (Rabitz Telli)', density: 125, lambda50: '0,037', thicknessMin: 50, thicknessMax: 120, page: 's72' },
  ]
  return variants.map((v) => ({
    productKey: v.key,
    brandName: 'Bonus',
    modelShortName: v.short,
    displayName: v.display,
    applicationScope: 'endustriyel' as const,
    wizardEligible: false,
    comparisonEligible: false,
    density: {
      minKgM3: v.density,
      maxKgM3: v.density,
      display: `${v.density} kg/m³`,
      sourceType: 'datasheet' as const,
      sourceDate: '2026-07-20',
    },
    lambdaDisplay: `${v.lambda50} W/mK (50 °C; servis sıcaklığıyla artar)`,
    tensileDisplay: 'Aranmaz',
    tensileClass: null,
    compressiveDisplay: 'Aranmaz',
    fireClass: 'A1' as const,
    thicknessMmMin: v.thicknessMin,
    thicknessMmMax: v.thicknessMax,
    datasheetRef: `_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#${v.page}`,
  }))
}

/** Karşılaştırma matrisi üyesi: yoğunluk beyanı zorunlu. */
export type ComparisonProfile = TechnicalProfile & { density: DensityDeclaration }

export function getComparisonProfiles(): ComparisonProfile[] {
  // Karar: 150 föy beyanlı üç ürün önde; kalanlar yoğunluk azalan sırada.
  // Yoğunluk beyanı olmayan ürün matrise giremez (comparisonEligible
  // zaten false; filtre tip güvenliği için de gereklidir).
  return PROFILES.filter(
    (p): p is ComparisonProfile => p.comparisonEligible && p.density !== null,
  ).sort((a, b) => {
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
  if (!profile.density) return 'Föyde yoğunluk beyanı yok'
  return DENSITY_SOURCE_LABELS[profile.density.sourceType]
}

/** Müşteri ekranı için değer + zorunlu kaynak etiketi tek parça. */
export function densityWithSourceLabel(profile: TechnicalProfile): string {
  if (!profile.density) return 'Yoğunluk: föyde beyan edilmemiş'
  return `${profile.density.display} · ${densitySourceLabel(profile)}`
}

export function getAllProfiles(): readonly TechnicalProfile[] {
  return PROFILES
}

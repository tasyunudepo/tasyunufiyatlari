// ============================================================
// Bonus aile-PDP yoğunluk varyantları (client-güvenli)
//
// Karar (Emrah, 20 Temmuz 2026): Gold ailesi ve endüstriyel ürünler
// yoğunluk varyantı başına ayrı PDP açmaz; aile başına tek PDP +
// yoğunluk seçici kullanılır. Bu modül SADECE varyant kimliği ve
// satılabilir kalınlık listesi taşır — fiyat, iskonto, liste verisi
// TAŞIMAZ (bonus-price-privacy kontratı: components/** fiyat JSON'unu
// import edemez; fiyat her zaman /api/bonus-price'tan iner).
//
// Kalınlık listeleri Haziran 2026 fiyat listesindeki satılabilir
// kalınlıklardır; varyantlar arasında fark vardır (ör. Gold Plus 50
// 20 cm'e kadar çıkar, 70/90 çıkmaz). Seçici varyant değiştirince
// kalınlık uyumsuzsa fiyat API'si fail-closed cevap verir.
// ============================================================

export interface BonusFamilyVariant {
  /** plates.short_name / teknik profil modelShortName ile birebir */
  modelShortName: string
  /** Seçici çipinde görünen etiket */
  label: string
  /** Satılabilir kalınlıklar (cm) — fiyat listesi kaynaklı */
  thicknessCmOptions: number[]
}

export interface BonusFamily {
  /** Aile PDP başlığında kullanılabilir kısa ad */
  familyLabel: string
  /** Seçici üst başlığı */
  selectorTitle: string
  variants: BonusFamilyVariant[]
}

const GOLD_50_THICKNESS = [5, 6, 7, 8, 10, 12, 15]
const GOLD_STD_THICKNESS = [3, 4, 5, 6, 7, 8, 10, 12, 15]
const END_LEVHA_THICKNESS = [2.5, 3, 4, 5, 6, 7, 8, 10, 12]
const SILTE_THICKNESS = [3, 4, 5, 6, 7, 8, 10, 12]

const FAMILIES: BonusFamily[] = [
  {
    familyLabel: 'Gold Plus',
    selectorTitle: 'Yoğunluk',
    variants: [
      { modelShortName: 'Gold Plus 50', label: '50 kg/m³', thicknessCmOptions: [3, 4, 5, 6, 7, 8, 10, 12, 15, 20] },
      { modelShortName: 'Gold Plus 70', label: '70 kg/m³', thicknessCmOptions: GOLD_STD_THICKNESS },
      { modelShortName: 'Gold Plus 90', label: '90 kg/m³', thicknessCmOptions: GOLD_STD_THICKNESS },
    ],
  },
  {
    familyLabel: 'Gold Black',
    selectorTitle: 'Yoğunluk',
    variants: [
      { modelShortName: 'Gold Black 50', label: '50 kg/m³', thicknessCmOptions: GOLD_50_THICKNESS },
      { modelShortName: 'Gold Black 70', label: '70 kg/m³', thicknessCmOptions: GOLD_STD_THICKNESS },
      { modelShortName: 'Gold Black 90', label: '90 kg/m³', thicknessCmOptions: GOLD_STD_THICKNESS },
    ],
  },
  {
    familyLabel: 'Gold Yellow',
    selectorTitle: 'Yoğunluk',
    variants: [
      { modelShortName: 'Gold Yellow 50', label: '50 kg/m³', thicknessCmOptions: GOLD_50_THICKNESS },
      { modelShortName: 'Gold Yellow 70', label: '70 kg/m³', thicknessCmOptions: GOLD_STD_THICKNESS },
    ],
  },
  {
    familyLabel: 'Endüstriyel Levha',
    selectorTitle: 'Yoğunluk',
    variants: [
      { modelShortName: 'Endüstriyel Levha 70', label: '70 kg/m³', thicknessCmOptions: END_LEVHA_THICKNESS },
      { modelShortName: 'Endüstriyel Levha 110', label: '110 kg/m³', thicknessCmOptions: END_LEVHA_THICKNESS },
    ],
  },
  {
    familyLabel: 'Endüstriyel Şilte',
    selectorTitle: 'Şilte tipi',
    variants: [
      { modelShortName: 'Endüstriyel Şilte 650', label: '650 · 80 kg/m³', thicknessCmOptions: SILTE_THICKNESS },
      { modelShortName: 'Endüstriyel Şilte 700', label: '700 · 90 kg/m³', thicknessCmOptions: SILTE_THICKNESS },
      { modelShortName: 'Endüstriyel Şilte 720', label: '720 · 100 kg/m³', thicknessCmOptions: SILTE_THICKNESS },
      { modelShortName: 'Endüstriyel Şilte 750', label: '750 · 125 kg/m³', thicknessCmOptions: [3, 4, 5, 6, 7, 8, 10] },
    ],
  },
]

// Üretici fiyat listesinde fiyatı olmayan modeller ("Bölge yöneticisi ile
// iletişime geçiniz"): canlı bölge fiyat kartı hiç render edilmez, PDP
// statik "Teklif ile belirlenir" akışında kalır.
const UNPRICED_MODELS: readonly string[] = ['Desibel', 'Kapı Paneli', 'Panel', 'Marin']

export function isUnpricedBonusModel(modelShortName: string): boolean {
  return UNPRICED_MODELS.includes(modelShortName)
}

/** Modelin üyesi olduğu aileyi döner; ailesiz (tekil) modelde null. */
export function getBonusFamily(modelShortName: string): BonusFamily | null {
  return (
    FAMILIES.find((f) =>
      f.variants.some((v) => v.modelShortName === modelShortName),
    ) ?? null
  )
}

export function getBonusFamilyVariant(
  modelShortName: string,
): BonusFamilyVariant | null {
  for (const family of FAMILIES) {
    const variant = family.variants.find((v) => v.modelShortName === modelShortName)
    if (variant) return variant
  }
  return null
}

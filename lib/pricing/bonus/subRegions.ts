// ============================================================
// İstanbul / Kocaeli alt-bölge sorusu — PUBLIC modül
//
// Bu dosya client bundle'ına girer (WizardStep3 kullanır); bu yüzden
// fiyat, iskonto veya taban değer İÇERMEZ. Bölge numaraları üreticinin
// herkese açık fiyat listesindeki nakliye haritasından gelir (s.83).
// Fiyat verisi yalnız sunucu tarafındaki regionPricing modülündedir.
// ============================================================

export type BonusSubRegionChoice = 'avrupa' | 'anadolu' | 'gebze' | 'diger'

export interface CitySubRegionInfo {
  cityName: string
  question: 'yaka' | 'gebze'
  options: Partial<Record<BonusSubRegionChoice, number>>
}

// Karar günlüğü Tur 4: İstanbul Avrupa → 3. Bölge, Anadolu → 2. Bölge;
// Kocaeli Gebze → 2. Bölge, diğer ilçeler → 1. Bölge.
export const SPECIAL_CITY_SUB_REGIONS: Record<number, CitySubRegionInfo> = {
  34: { cityName: 'İstanbul', question: 'yaka', options: { avrupa: 3, anadolu: 2 } },
  41: { cityName: 'Kocaeli', question: 'gebze', options: { gebze: 2, diger: 1 } },
}

export function citySubRegionQuestion(cityCode: number): CitySubRegionInfo | null {
  return SPECIAL_CITY_SUB_REGIONS[cityCode] ?? null
}

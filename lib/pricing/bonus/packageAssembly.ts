// ============================================================
// Bonus paket montajı — istemci tarafı saf yardımcılar
//
// Bu modül FİYAT VERİSİ TAŞIMAZ ve fiyat HESAPLAMAZ; sunucunun
// /api/bonus-price yanıtındaki satış fiyatını OLDUĞU GİBİ kaleme
// çevirir. Marj sunucuda bir kez uygulanmıştır; burada tekrar marj,
// iskonto veya KDV dönüşümü uygulanması yasaktır (çifte marj kilidi:
// tests/pricing/bonus-package-assembly.test.ts).
// ============================================================

const roundToKurus = (value: number): number => Math.round(value * 100) / 100

export interface BonusPlateQuote {
  /** /api/bonus-price yanıtı: marjlı, KDV hariç m² satış fiyatı */
  salePricePerM2: number
  packageM2: number
}

export interface BonusPlateOrder {
  packageCount: number
  orderM2: number
  unitPricePerM2: number
  totalExVat: number
}

/**
 * Kullanıcı metrajını paket adedine yuvarlar ve levha kalem tutarını
 * sunucu fiyatıyla (değiştirmeden) hesaplar.
 */
export function buildBonusPlateOrder(
  quote: BonusPlateQuote,
  areaM2: number,
): BonusPlateOrder | null {
  if (
    !Number.isFinite(quote.salePricePerM2) || quote.salePricePerM2 <= 0 ||
    !Number.isFinite(quote.packageM2) || quote.packageM2 <= 0 ||
    !Number.isFinite(areaM2) || areaM2 <= 0
  ) {
    return null
  }

  // Üretici araç kapasiteleri paket katının yuvarlanmış hali olabilir
  // (örn. TIR 1.774,1 m² ≈ 616 × 2,88 = 1.774,08). Yarım m² içinde
  // pakete oturt; aksi halde ihtiyacı karşılayan en küçük kata yükselt.
  const SNAP_TOLERANCE_M2 = 0.5
  const nearestCount = Math.round(areaM2 / quote.packageM2)
  const snapDiff = Math.abs(nearestCount * quote.packageM2 - areaM2)
  const packageCount = nearestCount > 0 && snapDiff <= SNAP_TOLERANCE_M2
    ? nearestCount
    : Math.ceil(areaM2 / quote.packageM2)
  const orderM2 = roundToKurus(packageCount * quote.packageM2)

  return {
    packageCount,
    orderM2,
    unitPricePerM2: quote.salePricePerM2,
    totalExVat: roundToKurus(quote.salePricePerM2 * orderM2),
  }
}

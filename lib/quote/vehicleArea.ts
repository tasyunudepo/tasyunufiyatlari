import { roundToKurus } from '@/lib/pricing/quoteTotals'

// Araç ↔ metraj dönüşümü.
//
// NEDEN: operatör ve müşteri "3 TIR" diye konuşuyor, sistem m² istiyor.
// 27 Temmuz 2026'da 3 TIR'ın 6.652,8 m² ettiği elle hesaplandı ve teklife
// öyle yazıldı. Kapasite levhaya göre değiştiği için (Bonus 4 cm'de TIR
// 2.217,6 m², genel taşyünü 4 cm'de 1.872 m²) bu hesap kafadan yapılamaz.

export interface VehicleCapacity {
  /** Tam TIR kapasitesi, m². */
  truckM2: number | null
  /** Tam kamyon kapasitesi, m². */
  lorryM2: number | null
}

/** Verilen araç sayılarının toplam metrajı. Kapasite yoksa null. */
export function areaForVehicles(
  cap: VehicleCapacity,
  trucks: number,
  lorries: number,
): number | null {
  const tir = cap.truckM2 ?? 0
  const kamyon = cap.lorryM2 ?? 0
  if (trucks < 0 || lorries < 0) return null
  if (trucks > 0 && !(tir > 0)) return null
  if (lorries > 0 && !(kamyon > 0)) return null
  if (trucks === 0 && lorries === 0) return 0
  return roundToKurus(trucks * tir + lorries * kamyon)
}

export interface VehicleFit {
  trucks: number
  lorries: number
  /** Araçların taşıdığı toplam metraj. */
  areaM2: number
  /** Metrajın araç dolusuna tam oturup oturmadığı. */
  exact: boolean
}

/**
 * Bir metrajın en yakın tam araç karşılığı — "6.652,8 m² = 3 TIR" bilgisini
 * operatöre geri söylemek için.
 *
 * Önce TIR'la doldurur, artan kamyona bakar. Tam oturmuyorsa `exact: false`
 * döner ve o zaman metraj ekranda araç cinsinden ETİKETLENMEZ; yanlış
 * "3 TIR" demek gerçek bir sipariş hatasına yol açardı.
 */
export function fitVehicles(areaM2: number, cap: VehicleCapacity): VehicleFit | null {
  const tir = cap.truckM2 ?? 0
  const kamyon = cap.lorryM2 ?? 0
  if (!(areaM2 > 0)) return null
  if (!(tir > 0) && !(kamyon > 0)) return null

  // Kuruş/ondalık gürültüsüne karşı küçük tolerans (kapasiteler .6, .4 gibi
  // ondalıklar taşıyor); ölçü m² olduğu için 0,01 m² fazlasıyla yeterli.
  const TOLERANS = 0.01

  // Aynı metraj birden fazla araç bileşimine oturabilir — 5.544 m² hem
  // "5 kamyon" hem "2 TIR + 1 kamyon" eder. EN AZ ARAÇLI bileşim seçilir;
  // eşitlikte TIR ağırlıklı olan tercih edilir (nakliyede doğal karşılık).
  const adaylar: VehicleFit[] = []
  const enFazlaTir = tir > 0 ? Math.floor(areaM2 / tir + 1) : 0

  for (let t = enFazlaTir; t >= 0; t -= 1) {
    const kalan = areaM2 - t * tir
    if (kalan < -TOLERANS) continue

    if (Math.abs(kalan) <= TOLERANS) {
      if (t > 0) adaylar.push({ trucks: t, lorries: 0, areaM2: roundToKurus(t * tir), exact: true })
      continue
    }
    if (!(kamyon > 0)) continue

    const k = Math.round(kalan / kamyon)
    if (k > 0 && Math.abs(t * tir + k * kamyon - areaM2) <= TOLERANS) {
      adaylar.push({
        trucks: t,
        lorries: k,
        areaM2: roundToKurus(t * tir + k * kamyon),
        exact: true,
      })
    }
  }

  if (adaylar.length === 0) return { trucks: 0, lorries: 0, areaM2, exact: false }

  adaylar.sort((a, b) => {
    const toplamFark = a.trucks + a.lorries - (b.trucks + b.lorries)
    return toplamFark !== 0 ? toplamFark : b.trucks - a.trucks
  })
  return adaylar[0]
}

/** "3 TIR", "2 TIR + 1 kamyon" — tam oturmuyorsa null. */
export function describeVehicles(fit: VehicleFit | null): string | null {
  if (!fit || !fit.exact) return null
  const parcalar: string[] = []
  if (fit.trucks > 0) parcalar.push(`${fit.trucks} TIR`)
  if (fit.lorries > 0) parcalar.push(`${fit.lorries} kamyon`)
  return parcalar.length > 0 ? parcalar.join(' + ') : null
}

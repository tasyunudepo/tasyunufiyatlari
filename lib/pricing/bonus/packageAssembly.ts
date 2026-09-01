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

export interface BonusVehiclePlan {
  tir: number
  kamyon: 0 | 1
  /** Ham kapasite toplamı — /api/quotes tam-araç doğrulaması bu değeri bekler */
  planM2: number
  label: string
  /** Saf plan araç tipi; karışık planda null (API'ye null gider) */
  vehicleType: 'lorry' | 'truck' | null
}

export interface BonusVehicleAdjustment {
  plan: BonusVehiclePlan
  shortfallM2: number
}

function createBonusVehiclePlan(
  tir: number,
  kamyon: 0 | 1,
  kamyonM2: number,
  tirM2: number,
): BonusVehiclePlan {
  const planM2 = roundToKurus(tir * tirM2 + kamyon * kamyonM2)
  const parts: string[] = []
  if (tir > 0) parts.push(`${tir} TIR`)
  if (kamyon > 0) parts.push('1 Kamyon')
  return {
    tir,
    kamyon,
    planM2,
    label: parts.join(' + '),
    vehicleType: kamyon === 0 ? 'truck' : tir === 0 ? 'lorry' : null,
  }
}

/**
 * Metraj → tam araç planları (karar: Emrah, 20 Temmuz 2026).
 *
 * Formül: metraj kamyona sığıyorsa 1 Kamyon; değilse tam TIR'lara
 * bölünür, kalan kamyona sığıyorsa "N TIR + 1 Kamyon", sığmıyorsa bir
 * üst tam TIR'a yuvarlanır. Birden fazla kamyon ASLA önerilmez.
 * Varsayılan (ilk eleman) her zaman yukarı tam-TIR yuvarlamasıdır;
 * kamyonlu kombinasyon varsa alternatif olarak ikinci sırada döner.
 */
export function buildBonusVehiclePlans(
  neededM2: number,
  kamyonM2: number,
  tirM2: number,
): BonusVehiclePlan[] {
  if (
    !Number.isFinite(neededM2) || neededM2 <= 0 ||
    !Number.isFinite(kamyonM2) || kamyonM2 <= 0 ||
    !Number.isFinite(tirM2) || tirM2 <= 0
  ) {
    return []
  }

  const plan = (tir: number, kamyon: 0 | 1): BonusVehiclePlan =>
    createBonusVehiclePlan(tir, kamyon, kamyonM2, tirM2)

  if (neededM2 <= kamyonM2) {
    // Küçük metraj: 1 Kamyon yeter; 1 TIR alternatif olarak sunulur.
    return [plan(0, 1), plan(1, 0)]
  }

  const tirFloor = Math.floor(neededM2 / tirM2)
  const kalan = neededM2 - tirFloor * tirM2
  if (kalan <= 1e-9) return [plan(tirFloor, 0)]

  const plans: BonusVehiclePlan[] = [plan(tirFloor + 1, 0)]
  if (kalan <= kamyonM2) plans.push(plan(tirFloor, 1))
  return plans
}

/**
 * İhtiyacı karşılamayan fakat kurala uygun en yakın alt araç kapasitesini
 * bulur. Bu sonuç sipariş planı değildir; kullanıcı ancak proje metrajını
 * açıkça bu kapasiteye indirirse geçerli plana dönüşür.
 */
export function findNearestLowerBonusVehiclePlan(
  neededM2: number,
  kamyonM2: number,
  tirM2: number,
): BonusVehicleAdjustment | null {
  if (
    !Number.isFinite(neededM2) || neededM2 <= 0 ||
    !Number.isFinite(kamyonM2) || kamyonM2 <= 0 ||
    !Number.isFinite(tirM2) || tirM2 <= 0
  ) {
    return null
  }

  const epsilon = 1e-9
  const candidates: BonusVehiclePlan[] = []
  const maxTir = Math.floor(neededM2 / tirM2)

  for (let tir = 0; tir <= maxTir; tir += 1) {
    for (const kamyon of [0, 1] as const) {
      if (tir === 0 && kamyon === 0) continue
      const candidate = createBonusVehiclePlan(tir, kamyon, kamyonM2, tirM2)
      if (Math.abs(candidate.planM2 - neededM2) <= epsilon) return null
      if (candidate.planM2 < neededM2) candidates.push(candidate)
    }
  }

  const plan = candidates.sort((a, b) => b.planM2 - a.planM2)[0]
  if (!plan) return null

  return {
    plan,
    shortfallM2: roundToKurus(neededM2 - plan.planM2),
  }
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

export type ShippingMode =
  | 'included_in_sale_price'
  | 'buyer_pays'
  | 'separate_quote_required'

export type ShippingDecision = {
  mode: ShippingMode
  separateShippingCharge: number | null
  isPriceFinal: boolean
  customerMessage: string
}

export function getShippingPresentation(mode: ShippingMode) {
  if (mode === 'included_in_sale_price') {
    return {
      isIncluded: true,
      heroLabel: 'NAKLİYE DAHİL M² MALİYETİ',
      statusLabel: 'DAHİL',
      termsLabel: 'FİYATA DAHİLDİR',
      footerLabel: 'DAHİL',
    }
  }

  if (mode === 'separate_quote_required') {
    return {
      isIncluded: false,
      heroLabel: 'ÜRÜN M² MALİYETİ',
      statusLabel: 'SATIŞ GÖRÜŞMESİNDE NETLEŞİR',
      termsLabel: 'SATIŞ GÖRÜŞMESİNDE NETLEŞİR',
      footerLabel: 'TEYİT GEREKİR',
    }
  }

  return {
    isIncluded: false,
    heroLabel: 'M² MALİYETİ · NAKLİYE HARİÇ',
    statusLabel: 'ALICIYA AİT',
    termsLabel: 'ALICIYA AİTTİR',
    footerLabel: 'HARİÇ',
  }
}

export function validateMinimumOrder(areaM2: number, minimumM2: number) {
  return areaM2 < minimumM2
    ? { ok: false as const, minimumM2 }
    : { ok: true as const }
}

const VEHICLE_AREA_DECIMALS = 2
const DISPLAY_ROUNDING_TOLERANCE_M2 = 0.05

const roundVehicleArea = (value: number): number =>
  Math.round((value + Number.EPSILON) * 10 ** VEHICLE_AREA_DECIMALS)
  / 10 ** VEHICLE_AREA_DECIMALS

/** HTML number inputuna kapasiteyi kayan nokta artığı olmadan yazar. */
export function formatVehicleAreaInput(value: number): string {
  return Number.isFinite(value) ? String(roundVehicleArea(value)) : ''
}

/**
 * İhtiyacı karşılayan en yakın tam araç seçeneklerini üretir.
 * Birden fazla kamyon teknik olarak geçerli olsa da ticari öneride TIR ve
 * en fazla bir kamyonlu kombinasyon önceliklendirilir.
 */
export function buildFullVehicleSuggestions(input: {
  requestedAreaM2: number
  lorryCapacityM2: number
  truckCapacityM2: number
}): { m2: number; label: string }[] {
  const { requestedAreaM2, lorryCapacityM2, truckCapacityM2 } = input
  if (
    !Number.isFinite(requestedAreaM2)
    || !Number.isFinite(lorryCapacityM2)
    || !Number.isFinite(truckCapacityM2)
    || requestedAreaM2 <= 0
    || lorryCapacityM2 <= 0
    || truckCapacityM2 <= 0
  ) return []

  const candidates: { m2: number; label: string }[] = []
  const fullTruckCount = Math.max(
    1,
    Math.ceil((requestedAreaM2 - DISPLAY_ROUNDING_TOLERANCE_M2) / truckCapacityM2),
  )
  candidates.push({
    m2: roundVehicleArea(fullTruckCount * truckCapacityM2),
    label: `${fullTruckCount} TIR`,
  })

  const baseTruckCount = Math.floor(
    (requestedAreaM2 + DISPLAY_ROUNDING_TOLERANCE_M2) / truckCapacityM2,
  )
  if (baseTruckCount > 0) {
    const mixedAreaM2 = roundVehicleArea(
      baseTruckCount * truckCapacityM2 + lorryCapacityM2,
    )
    if (mixedAreaM2 + DISPLAY_ROUNDING_TOLERANCE_M2 >= requestedAreaM2) {
      candidates.push({
        m2: mixedAreaM2,
        label: `${baseTruckCount} TIR + 1 Kamyon`,
      })
    }
  }

  const roundedLorryM2 = roundVehicleArea(lorryCapacityM2)
  if (roundedLorryM2 + DISPLAY_ROUNDING_TOLERANCE_M2 >= requestedAreaM2) {
    candidates.push({ m2: roundedLorryM2, label: '1 Kamyon' })
  }

  const unique = new Map<string, { m2: number; label: string }>()
  for (const candidate of candidates) {
    const key = formatVehicleAreaInput(candidate.m2)
    if (!unique.has(key)) unique.set(key, candidate)
  }

  return [...unique.values()]
    .filter(option => option.m2 + DISPLAY_ROUNDING_TOLERANCE_M2 >= requestedAreaM2)
    .sort((a, b) => a.m2 - b.m2)
    .slice(0, 3)
}

export function isValidFullVehicleArea(input: {
  areaM2: number
  lorryCapacityM2: number
  truckCapacityM2: number
  packageSizeM2: number
}): boolean {
  const {
    areaM2,
    lorryCapacityM2,
    truckCapacityM2,
    packageSizeM2,
  } = input

  if (
    !Number.isFinite(areaM2)
    || !Number.isFinite(lorryCapacityM2)
    || !Number.isFinite(truckCapacityM2)
    || !Number.isFinite(packageSizeM2)
    || areaM2 <= 0
    || lorryCapacityM2 <= 0
    || truckCapacityM2 <= 0
    || packageSizeM2 <= 0
  ) {
    return false
  }

  // Metrajı "yakın tam araç" olarak kabul etmiyoruz. Yalnızca kayan nokta
  // hesabının üretebileceği çok küçük sapmaya izin verilir; örneğin 806,4 m²
  // kamyon için 804 m² teklif oluşturamaz.
  const tolerance = Math.max(1e-6, packageSizeM2 * 1e-9)
  const maxTrucks = Math.ceil(areaM2 / truckCapacityM2) + 1
  for (let truckCount = 0; truckCount <= maxTrucks; truckCount += 1) {
    const remainder = areaM2 - truckCount * truckCapacityM2
    if (remainder < -tolerance) break
    if (Math.abs(remainder) <= tolerance) return true

    const lorryCount = Math.round(remainder / lorryCapacityM2)
    if (
      lorryCount >= 0
      && Math.abs(remainder - lorryCount * lorryCapacityM2) <= tolerance
    ) {
      return true
    }
  }

  return false
}

export function resolveVehicleTypeFromPackages(input: {
  packageCount: number
  lorryCapacityPackages: number
  truckCapacityPackages: number
}): 'none' | 'lorry' | 'truck' | 'multiple' {
  if (input.packageCount > input.truckCapacityPackages) return 'multiple'
  if (input.packageCount >= input.truckCapacityPackages) return 'truck'
  if (input.packageCount >= input.lorryCapacityPackages) return 'lorry'
  return 'none'
}

export function resolveEpsShippingDecision(input: {
  saleMode: 'complete_set' | 'plate_only'
  areaM2: number
  minimumSetM2: number
  requiredAccessoriesComplete: boolean
  isFullVehicle: boolean
  requiresSeparateShipping: boolean
}): ShippingDecision {
  if (input.requiresSeparateShipping) {
    return {
      mode: 'separate_quote_required',
      separateShippingCharge: null,
      isPriceFinal: false,
      customerMessage: 'Nakliye koşulu sipariş öncesi teyit edilir.',
    }
  }

  if (input.saleMode === 'plate_only') {
    return input.isFullVehicle
      ? {
          mode: 'included_in_sale_price',
          separateShippingCharge: 0,
          isPriceFinal: true,
          customerMessage: 'Tam araç siparişinde nakliye fiyata dahildir.',
        }
      : {
          mode: 'buyer_pays',
          separateShippingCharge: null,
          isPriceFinal: false,
          customerMessage: 'Tam araç altındaki yalnız levha siparişinde nakliye alıcıya aittir.',
        }
  }

  if (
    input.areaM2 < input.minimumSetM2 ||
    !input.requiredAccessoriesComplete
  ) {
    return {
      mode: 'separate_quote_required',
      separateShippingCharge: null,
      isPriceFinal: false,
      customerMessage: 'Komple set koşulları tamamlanmadan kesin teklif oluşturulamaz.',
    }
  }

  return {
    mode: 'included_in_sale_price',
    separateShippingCharge: 0,
    isPriceFinal: true,
    customerMessage: 'Komple EPS setinde nakliye fiyata dahildir.',
  }
}

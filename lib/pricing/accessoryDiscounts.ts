export interface AccessoryCityDiscounts {
  eps_toz_region_discount?: number | null
  optimix_toz_discount?: number | null
}

interface ResolveAccessoryDiscountsInput {
  accessoryBrandName: string
  discount1: number | null | undefined
  discount2: number | null | undefined
  city: AccessoryCityDiscounts | null | undefined
}

function finiteDiscount(value: number | null | undefined): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? numeric : 0
}

function positiveCityDiscount(value: number | null | undefined): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 && numeric <= 100 ? numeric : null
}

/**
 * Toz grubu bölge iskontosunu aksesuar markasına göre çözer.
 *
 * Üretici tablosundaki sıra:
 *   İSK1 = şehrin marka haritasındaki bölge iskontosu
 *   İSK2 = ürün/bayi iskontosu (`accessories.discount_2`)
 *
 * Ana yalıtım malzemesinin EPS veya taşyünü olması bu kuralı değiştirmez;
 * yalnız sarfiyatı ve seçilecek dübel tipini değiştirir.
 */
export function resolveAccessoryDiscounts(
  input: ResolveAccessoryDiscountsInput,
): { isk1: number; isk2: number } {
  let isk1 = finiteDiscount(input.discount1)
  const isk2 = finiteDiscount(input.discount2)

  if (!input.city) return { isk1, isk2 }

  const normalizedBrand = input.accessoryBrandName.toLocaleLowerCase('tr-TR')
  const isOptimix = normalizedBrand.includes('optimix')
  const isFilliGroup =
    normalizedBrand.includes('dalmaçyalı') || normalizedBrand.includes('expert')

  const cityDiscount = isOptimix
    ? positiveCityDiscount(input.city.optimix_toz_discount)
    : isFilliGroup
      ? positiveCityDiscount(input.city.eps_toz_region_discount)
      : null

  if (cityDiscount != null) isk1 = cityDiscount

  return { isk1, isk2 }
}

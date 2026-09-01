import type { CatalogProductView } from './types'

export interface ProductLogisticsCapacity {
  thickness: number
  lorry_capacity_m2: string | number
  truck_capacity_m2: string | number
  package_size_m2: string | number
  lorry_capacity_packages: number
  truck_capacity_packages: number
  items_per_package: number | null
  is_popular: boolean
  notes: string | null
}

export interface PlatePackageDetail {
  thicknessCm: number
  packageM2: number
  itemsPerPackage: number | null
  boardSizeLabel: string | null
  lorryPackages: number
  truckPackages: number
  isPopular: boolean
}

function finiteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * logistics_capacity.notes içindeki doğrulanmış levha ölçüsünü kullanıcıya
 * okunur santimetre biçiminde çıkarır. Serbest metin eşleşmezse ölçü uydurmaz.
 */
export function parseBoardSizeLabel(notes: string | null | undefined): string | null {
  if (!notes) return null
  const match = notes.match(/Levha boyutu:\s*(\d+)\s*[×xX]\s*(\d+)\s*mm/i)
  if (!match) return null

  const widthMm = Number(match[1])
  const lengthMm = Number(match[2])
  if (!Number.isFinite(widthMm) || !Number.isFinite(lengthMm)) return null

  return `${widthMm / 10} × ${lengthMm / 10} cm`
}

export function resolvePlatePackageDetail(
  product: CatalogProductView,
  logisticsCapacity: ProductLogisticsCapacity[],
  thicknessCm: number | null,
): PlatePackageDetail | null {
  if (thicknessCm === null) return null

  const logistics = logisticsCapacity.find((row) => row.thickness === thicknessCm * 10)
  if (!logistics) return null

  const productPackageM2 = product.thickness_prices
    ?.find((row) => row.thickness === thicknessCm)
    ?.package_m2
  const packageM2 = finiteNumber(productPackageM2 ?? logistics.package_size_m2)
  if (packageM2 === null) return null

  return {
    thicknessCm,
    packageM2,
    itemsPerPackage: finiteNumber(logistics.items_per_package),
    boardSizeLabel: parseBoardSizeLabel(logistics.notes),
    lorryPackages: logistics.lorry_capacity_packages,
    truckPackages: logistics.truck_capacity_packages,
    isPopular: logistics.is_popular,
  }
}

export function buildPlatePackageDetails(
  product: CatalogProductView,
  logisticsCapacity: ProductLogisticsCapacity[],
): PlatePackageDetail[] {
  return (product.thickness_options ?? [])
    .map((thickness) => resolvePlatePackageDetail(product, logisticsCapacity, thickness))
    .filter((detail): detail is PlatePackageDetail => detail !== null)
}

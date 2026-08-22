import { buildQuoteSurfacePricing } from '@/lib/pricing/quoteTotals'
import type { CalculatedPackage } from '@/lib/types'

const normalize = (value: string): string =>
  value.trim().toLocaleLowerCase('tr-TR')

const packageTotalWithVat = (pkg: CalculatedPackage): number =>
  buildQuoteSurfacePricing(
    pkg.totalProductCost || 0,
    pkg.shippingCost || 0,
    1,
  ).totalPrice

const isSameBrandRecipe = (pkg: CalculatedPackage): boolean => {
  const brands = pkg.items
    .map(item => normalize(item.brandName || ''))
    .filter(Boolean)

  return brands.length > 0 && new Set(brands).size === 1
}

export function getTierGridClass(availableTierCount: number): string {
  if (availableTierCount === 2) return 'grid-cols-2'
  if (availableTierCount >= 3) return 'grid-cols-1 sm:grid-cols-3'
  return 'grid-cols-1'
}

export function getPackageTierDescriptor(
  pkg: CalculatedPackage,
  availablePackages: CalculatedPackage[],
): string {
  const name = normalize(pkg.definition.name)
  const tier = normalize(pkg.definition.tier)

  if (name.includes('dengeli') || tier === 'performance' || tier === 'balanced') {
    return 'Fiyat / performans kombinasyonu'
  }

  if (name.includes('orijinal') && isSameBrandRecipe(pkg)) {
    return 'Aynı marka sistem bütünlüğü'
  }

  if (name.includes('ekonomik') || tier === 'eco' || tier === 'economic') {
    const availableTotals = availablePackages.map(packageTotalWithVat)
    const minimumTotal = Math.min(...availableTotals)
    if (Math.abs(packageTotalWithVat(pkg) - minimumTotal) < 0.01) {
      return 'En düşük toplam maliyet'
    }
  }

  return pkg.definition.description.trim() || 'Komple mantolama sistemi'
}

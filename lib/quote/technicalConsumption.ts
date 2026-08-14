import type { TechnicalConsumptionUnit } from '@/lib/types'

const ACCESSORY_CONSUMPTION_UNITS: Record<string, TechnicalConsumptionUnit> = {
  yapistirici: 'kg/m²',
  siva: 'kg/m²',
  dubel: 'adet/m²',
  file: 'm²/m²',
  'fileli-kose': 'mt/m²',
  astar: 'kg/m²',
  kaplama: 'kg/m²',
}

/** Aksesuar tipindeki sayısal sarfiyatın fiziksel birimini verir. */
export function technicalConsumptionUnitForSlug(
  accessoryTypeSlug: string,
): TechnicalConsumptionUnit | undefined {
  return ACCESSORY_CONSUMPTION_UNITS[accessoryTypeSlug]
}

/** Eski/test satırlarında slug yoksa tip adından güvenli birim fallback'i verir. */
export function technicalConsumptionUnitForAccessoryType(
  accessoryTypeSlug: string | null | undefined,
  accessoryTypeName: string,
): TechnicalConsumptionUnit | undefined {
  const fromSlug = accessoryTypeSlug
    ? technicalConsumptionUnitForSlug(accessoryTypeSlug)
    : undefined
  if (fromSlug) return fromSlug

  const normalizedName = accessoryTypeName.trim().toLocaleLowerCase('tr-TR')
  const byName: Record<string, TechnicalConsumptionUnit> = {
    yapıştırıcı: 'kg/m²',
    sıva: 'kg/m²',
    dübel: 'adet/m²',
    file: 'm²/m²',
    'fileli köşe': 'mt/m²',
    astar: 'kg/m²',
    kaplama: 'kg/m²',
  }

  return byName[normalizedName]
}

/** PDF'de teknik sarfiyatı sayı ve birimi ayrılmayacak biçimde gösterir. */
export function formatTechnicalConsumption(
  rate: number,
  unit?: TechnicalConsumptionUnit,
): string {
  if (!Number.isFinite(rate) || rate <= 0) return '—'

  const formattedRate = rate.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  return unit ? `${formattedRate} ${unit}` : formattedRate
}

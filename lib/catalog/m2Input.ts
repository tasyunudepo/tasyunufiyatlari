export function parseLocalizedM2Input(value: string): number | null {
  const compact = value.trim().replace(/\s/g, '')
  if (!compact) return null

  const normalized = compact.includes(',') && compact.includes('.')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact.replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function formatLocalizedM2Input(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded.toLocaleString('tr-TR', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

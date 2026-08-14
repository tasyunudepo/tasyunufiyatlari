type MaterialType = 'tasyunu' | 'eps'

export interface SelectableAccessory {
  accessory_type_id: number | null
  is_for_eps: boolean | null
  is_for_tasyunu: boolean | null
  dowel_length?: number | null
  unit_content: number | null
}

export interface SelectableAccessoryType {
  id: number
  name: string
  slug?: string | null
}

/**
 * Üretim verisindeki eski TEKNO satırları 115/155 (mm), diğer markalar
 * 11.5/15.5 (cm) tutuyor. Karşılaştırma tek bir cm standardında yapılır.
 */
export function normalizeDowelLengthCm(value: number | null | undefined): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return numeric > 50 ? numeric / 10 : numeric
}

/**
 * Tedarikçi set kuralı:
 * - taşyünü 3–6 cm → en az 11,5 cm; 7–10 cm → en az 15,5 cm çelik dübel
 * - EPS 3–6 cm → en az 9,5 cm; 7–10 cm → en az 11,5 cm plastik dübel
 *
 * Kalınlık yoksa geriye dönük çağrılar için `undefined`, tanımlı aralığın
 * dışındaysa yanlış/eksik dübel üretmemek için `null` döner.
 */
export function requiredDowelLengthCm(
  materialType: MaterialType,
  plateThicknessCm: number | null | undefined,
): number | null | undefined {
  if (plateThicknessCm == null) return undefined

  const thickness = Number(plateThicknessCm)
  if (!Number.isFinite(thickness) || thickness < 3 || thickness > 10) return null

  if (materialType === 'tasyunu') return thickness <= 6 ? 11.5 : 15.5
  return thickness <= 6 ? 9.5 : 11.5
}

function isDowelType(type: SelectableAccessoryType): boolean {
  const slug = (type.slug ?? '').toLocaleLowerCase('tr-TR')
  const name = type.name.toLocaleLowerCase('tr-TR')
  return slug === 'dubel' || name.includes('dübel') || name.includes('dubel')
}

/**
 * Normal aksesuar tiplerinde sorgu sırasındaki ilk ürünü korur. Dübelde ise
 * levha kalınlığının gerektirdiği minimum boyu karşılayan en kısa, paket
 * içeriği tanımlı ürünü seçer. Böylece aynı boydaki sonradan eklenmiş beton/
 * tuğla satırları, mevcut asıl paket ürününün önüne geçmez.
 */
export function selectAccessoryForSet<T extends SelectableAccessory>(input: {
  accessories: T[]
  type: SelectableAccessoryType
  materialType: MaterialType
  plateThicknessCm?: number | null
}): T | null {
  const { accessories, type, materialType, plateThicknessCm } = input
  const isEps = materialType === 'eps'
  const candidates = accessories.filter(
    (accessory) =>
      accessory.accessory_type_id === type.id &&
      (isEps ? accessory.is_for_eps : accessory.is_for_tasyunu),
  )

  if (!isDowelType(type)) return candidates[0] ?? null

  const requiredLength = requiredDowelLengthCm(materialType, plateThicknessCm)
  // Kalınlık taşımayan eski/bağımsız çağrılarda mevcut sıra davranışı korunur.
  if (requiredLength === undefined) return candidates[0] ?? null
  // Tanımlı kalınlık aralığı dışındaysa yanlış dübel seçmek yerine set eksik kalır.
  if (requiredLength === null) return null

  let selected: T | null = null
  let selectedLength = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (Number(candidate.unit_content ?? 0) <= 0) continue
    const length = normalizeDowelLengthCm(candidate.dowel_length)
    if (length == null || length < requiredLength || length >= selectedLength) continue
    selected = candidate
    selectedLength = length
  }

  return selected
}

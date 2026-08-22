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
 * Teknik seçim kuralı: duvarda yaklaşık 4–5 cm tutunma payı hedeflenir.
 * Alt sınır levha + 4 cm'dir; katalogdaki bu sınırı karşılayan en kısa boy
 * seçilir. Örneğin 10 cm levhada alt sınır 14 cm, mevcut uygun ürün 15,5 cm'dir.
 *
 * Kalınlık yoksa geriye dönük çağrılar için `undefined`, geçersiz bir değer
 * geldiyse yanlış/eksik dübel üretmemek için `null` döner.
 */
export function requiredDowelLengthCm(
  _materialType: MaterialType,
  plateThicknessCm: number | null | undefined,
): number | null | undefined {
  if (plateThicknessCm == null) return undefined

  const thickness = Number(plateThicknessCm)
  if (!Number.isFinite(thickness) || thickness <= 0) return null

  return Number((thickness + 4).toFixed(2))
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
  // Kalınlık geçersizse yanlış dübel seçmek yerine set eksik kalır.
  if (requiredLength === null) return null

  let selected: T | null = null
  let selectedLength = Number.POSITIVE_INFINITY
  let selectedUnitContent = 0

  for (const candidate of candidates) {
    const unitContent = Number(candidate.unit_content ?? 0)
    if (unitContent <= 0) continue
    const length = normalizeDowelLengthCm(candidate.dowel_length)
    if (length == null || length < requiredLength) continue

    // Aynı boyda standart 600'lük plastik dübel ile 200'lük tuğla ürünü
    // birlikte bulunabiliyor. Toz grubu setinde daha büyük standart paket
    // tercih edilir; sorgu sırası değişse bile özel amaçlı küçük kutu sete
    // sessizce giremez.
    const dahaIyi =
      length < selectedLength ||
      (length === selectedLength && unitContent > selectedUnitContent)
    if (!dahaIyi) continue

    selected = candidate
    selectedLength = length
    selectedUnitContent = unitContent
  }

  return selected
}

// En az sipariş = seçilen ürün ve kalınlıkta 1 tam kamyon (Emrah kararı, 14 Ekim 2026).
//
// NEDEN: 14 Ekim gece herkese açık telefon/WhatsApp açılınca 25 m²'lik talepler geri geldi.
// En az metraj; ana sayfadaki şeritte, hesaplayıcıda ve iletişim sayfasındaki arama
// penceresinde aynı sayıyı söyler. Sayı hesaplayıcının ve ürün sayfasının kullandığı
// kamyon kapasitesinden gelir (paket adedi × ürünün paket m²'si), elle yazılmaz.

export interface MinimumOrderSelection {
  /** Ürün ve kalınlık, ör. "Bonus F 150 Pro · 5 cm". */
  label: string
  thicknessCm: number
  /** 1 tam kamyonun metrajı, m². */
  minimumM2: number
}

export const MINIMUM_ORDER_EVENT = 'tf:minimum-order'
export const MINIMUM_ORDER_STORAGE_KEY = 'tasyunu_minimum_order_v1'

export function formatMinimumM2(value: number): string {
  return Math.round(value).toLocaleString('tr-TR')
}

function isSelection(value: unknown): value is MinimumOrderSelection {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.label === 'string' &&
    v.label.length > 0 &&
    typeof v.thicknessCm === 'number' &&
    typeof v.minimumM2 === 'number' &&
    Number.isFinite(v.minimumM2) &&
    v.minimumM2 > 0
  )
}

/** Hesaplayıcı ve ürün sayfası seçimi yayınlar; şerit ve iletişim penceresi okur. */
export function publishMinimumOrder(selection: MinimumOrderSelection): void {
  if (typeof window === 'undefined' || !isSelection(selection)) return
  try {
    window.sessionStorage.setItem(MINIMUM_ORDER_STORAGE_KEY, JSON.stringify(selection))
  } catch {
    // Depolama kapalıysa yalnız aynı sayfadaki şerit güncellenir.
  }
  window.dispatchEvent(new CustomEvent<MinimumOrderSelection>(MINIMUM_ORDER_EVENT, { detail: selection }))
}

export function readMinimumOrder(): MinimumOrderSelection | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(MINIMUM_ORDER_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSelection(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** İletişim sayfasındaki kalınlık tablosu: genel taşyünü paketiyle 1 kamyon. */
export interface MinimumOrderRow {
  thicknessCm: number
  minimumM2: number
}

/** Tablo için yaygın kalınlıklar; kapasitesi tanımlı olmayan kalınlık atlanır. */
export const MINIMUM_TABLE_THICKNESSES_CM = [5, 8, 10, 12, 15] as const

export function buildMinimumOrderRows(
  capacities: { thickness: number; lorry_capacity_m2: number | null }[],
): MinimumOrderRow[] {
  return MINIMUM_TABLE_THICKNESSES_CM.flatMap((cm) => {
    // logistics_capacity.thickness milimetre tutulur (5 cm → 50).
    const row = capacities.find((c) => c.thickness === cm * 10)
    const m2 = row?.lorry_capacity_m2 ?? null
    return m2 != null && m2 > 0 ? [{ thicknessCm: cm, minimumM2: m2 }] : []
  })
}

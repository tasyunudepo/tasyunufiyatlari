// Karşılaştırma sayfalarına giden bağlantılarda giriş bilgisi (14 Ekim 2026, Emrah onayı).
//
// NEDEN: sitedeki her bağlantı karşılaştırmaya `?entry=…&kalinlik=…&focus=…` ile gidiyordu; Google bu
// sayfaları Temmuz'dan beri hiç tanımadı ("URL Google tarafından bilinmiyor"). Bağlantı adresi artık temiz;
// nereden gelindiği (Karsilastirma_Acildi.entry_placement), seçili kalınlık ve işaretli ürün tıklamada
// sekme hafızasına yazılır, varış sayfası bir kez okur ve siler. Adresle gelen eski bağlantılar da çalışır.

export const COMPARISON_ENTRY_STORAGE_KEY = 'comparison_entry_v1'
const MAX_AGE_MS = 10 * 60 * 1000

export interface ComparisonEntry {
  entry: string
  thicknessCm?: number | null
  focus?: string | null
  /** Bağlantının gittiği yol; varış sayfası yalnız kendi yoluna yazılmış girişi okur. */
  path: string
  at: number
}

export function rememberComparisonEntry(value: Omit<ComparisonEntry, 'at'>): void {
  try {
    window.sessionStorage.setItem(COMPARISON_ENTRY_STORAGE_KEY, JSON.stringify({ ...value, at: Date.now() }))
  } catch {
    // Gizli sekme / kapalı depolama: giriş "direct" sayılır, sayfa yine çalışır.
  }
}

/** Bu yola yazılmış taze girişi bir kez okur (okuyunca siler). */
export function takeComparisonEntry(path: string, now = Date.now()): ComparisonEntry | null {
  try {
    const raw = window.sessionStorage.getItem(COMPARISON_ENTRY_STORAGE_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(COMPARISON_ENTRY_STORAGE_KEY)
    const parsed = JSON.parse(raw) as Partial<ComparisonEntry>
    if (typeof parsed.entry !== 'string' || typeof parsed.path !== 'string' || typeof parsed.at !== 'number') return null
    if (parsed.path !== path || now - parsed.at > MAX_AGE_MS || parsed.at > now) return null
    return {
      entry: parsed.entry,
      thicknessCm: typeof parsed.thicknessCm === 'number' ? parsed.thicknessCm : null,
      focus: typeof parsed.focus === 'string' ? parsed.focus : null,
      path: parsed.path,
      at: parsed.at,
    }
  } catch {
    return null
  }
}

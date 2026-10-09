import { dailyTasks, type OfficeData, type OfficeProject, type OfficeTask } from '@/lib/admin/officeModel'
import { istanbulDate } from '@/lib/admin/officeCalendar'
import { INTERACTION_LABELS, INTERACTION_RESULT_LABELS } from '@/lib/admin/quoteSemantics'

// Genel Bakış'ın alt bölümleri için türetilmiş görünümler.
//
// Hepsi panelin zaten yüklediği kayıtlardan hesaplanır; yeni tablo, kolon
// ya da uç nokta istemez. Ekrana maket sayısı yazılmaz: kayıt yoksa bölüm
// boş durumunu gösterir.

/** `quotes.source_channel` değerlerinin ekrandaki adı. */
export const SOURCE_LABELS: Record<string, string> = {
  wizard: 'Site teklif sihirbazı',
  catalog: 'Ürün sayfası',
  comparison: 'Karşılaştırma sayfası',
  ofis: 'Ofis (telefon, yüz yüze)',
  bilinmiyor: 'Kaynağı kayıtlı değil',
}

export interface SourceQuote {
  project_id?: string | number | null
  source_channel?: string | null
  created_at: string
}

export interface SourceRow {
  source: string
  label: string
  /** Bu kaynaktan gelen TEKİL proje sayısı. */
  projects: number
  won: number
  lost: number
  /** Kazanılan / tekil proje, yüzde. */
  winRate: number | null
}

/**
 * Talep kaynakları: dönemde açılan tekil projeler, ilk tekliflerinin
 * kaynağına göre.
 *
 * Birim PROJEDİR, teklif değil: aynı projeye sonradan eklenen ofis
 * alternatifi kaynağı değiştirmez ve sayıyı çoğaltmaz. Projeye bağlanmamış
 * teklifler tabloya girmez, ayrıca bildirilir.
 */
export function sourceSummary(
  projects: readonly OfficeProject[],
  quotes: readonly SourceQuote[],
  asOf: string,
  days = 30,
) {
  const from = Date.parse(asOf) - days * 86400000
  const firstSource = new Map<string, { at: number; source: string }>()
  let unlinkedQuotes = 0

  for (const q of quotes) {
    const at = Date.parse(q.created_at)
    if (q.project_id == null) {
      if (at >= from) unlinkedQuotes += 1
      continue
    }
    const key = String(q.project_id)
    const prev = firstSource.get(key)
    if (!prev || at < prev.at) firstSource.set(key, { at, source: q.source_channel || 'bilinmiyor' })
  }

  const rows = new Map<string, SourceRow>()
  let total = 0
  for (const p of projects) {
    if (Date.parse(p.created_at) < from) continue
    total += 1
    const source = firstSource.get(String(p.id))?.source ?? 'bilinmiyor'
    const row = rows.get(source) ?? { source, label: SOURCE_LABELS[source] ?? source, projects: 0, won: 0, lost: 0, winRate: null }
    row.projects += 1
    if (p.status === 'completed') row.won += 1
    if (p.status === 'rejected') row.lost += 1
    rows.set(source, row)
  }

  const sorted = [...rows.values()]
    .map((r) => ({ ...r, winRate: r.projects > 0 ? Math.round((r.won / r.projects) * 100) : null }))
    .sort((a, b) => b.projects - a.projects || a.label.localeCompare(b.label, 'tr-TR'))

  return { rows: sorted, total, unlinkedQuotes, from: new Date(from).toISOString(), days }
}

export interface PlanRow {
  id: string
  dueAt: string
  owner: string
  projectId: string
  projectName: string
  kind: OfficeTask['kind']
  state: 'late' | 'waiting' | 'done' | 'cancelled'
}

function planRow(task: OfficeTask, data: OfficeData, state: PlanRow['state']): PlanRow {
  return {
    id: task.id,
    dueAt: task.due_at,
    owner: task.owner,
    projectId: task.project_id,
    projectName: data.projects.find((p) => p.id === task.project_id)?.name ?? 'Proje bulunamadı',
    kind: task.kind,
    state,
  }
}

/**
 * Bugünkü ekip planı — günlük sayaçla AYNI görev kümesi (dailyTasks):
 * açık gecikmiş işler, bugün hedeflenenler ve bugün tamamlanan ya da iptal
 * edilenler. İki ayrı küme olsaydı sayaç ile tablo birbirini tutmazdı.
 */
export function teamPlan(data: OfficeData): PlanRow[] {
  const daily = dailyTasks(data.tasks, data.asOf)
  const now = Date.parse(data.asOf)
  return [
    ...daily.open.map((t) => planRow(t, data, Date.parse(t.due_at) < now ? 'late' : 'waiting')),
    ...daily.done.map((t) => planRow(t, data, 'done')),
    ...daily.cancelled.map((t) => planRow(t, data, 'cancelled')),
  ].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.id.localeCompare(b.id))
}

/** Yarının (İstanbul günü) açık işleri. */
export function tomorrowPlan(data: OfficeData): PlanRow[] {
  const start = Date.parse(istanbulDate(data.asOf) + 'T00:00:00+03:00') + 86400000
  const end = start + 86400000
  return data.tasks
    .filter((t) => t.status === 'open' && Date.parse(t.due_at) >= start && Date.parse(t.due_at) < end)
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at) || a.id.localeCompare(b.id))
    .map((t) => planRow(t, data, 'waiting'))
}

export interface ActivityQuote {
  id: string | number
  quote_code?: string | null
  customer_name?: string | null
  quoted_by?: string | null
  created_at: string
  package_items?: { manual?: { revisions?: { no?: number; at?: string; by?: string }[] } } | null
}

export interface ActivityRow {
  at: string
  by: string
  text: string
}

/** Son işlemler: görüşme kayıtları, yeni teklifler ve revizyonlar; en yeni üstte. */
export function recentActivity(data: OfficeData, quotes: readonly ActivityQuote[], limit = 6): ActivityRow[] {
  const rows: ActivityRow[] = []

  for (const i of data.interactions) {
    const project = data.projects.find((p) => p.id === i.project_id)
    const kind = INTERACTION_LABELS[i.kind] ?? i.kind
    const outcome = i.outcome ? INTERACTION_RESULT_LABELS[i.outcome] ?? i.outcome : null
    rows.push({
      at: i.occurred_at,
      by: i.created_by || 'Kayıtlı değil',
      text: `${project?.name ?? 'Projesiz kayıt'}: ${kind}${outcome ? `, ${outcome}` : ''}`,
    })
  }

  for (const q of quotes) {
    const ad = q.quote_code ?? `#${q.id}`
    rows.push({ at: q.created_at, by: q.quoted_by || 'Site', text: `${ad} teklifi oluşturuldu (${q.customer_name ?? 'müşteri yok'})` })
    for (const r of q.package_items?.manual?.revisions ?? []) {
      if (r.at) rows.push({ at: r.at, by: r.by || q.quoted_by || 'Kayıtlı değil', text: `${ad} revize edildi (Revizyon ${r.no ?? '?'})` })
    }
  }

  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit)
}

export interface ProductQuote {
  created_at: string
  material_type?: string | null
  thickness_cm?: number | null
  brand_name?: string | null
  price_per_m2?: number | null
}

export interface PopularProduct {
  key: string
  label: string
  count: number
  /** Dönemdeki tekliflerin KDV hariç birim fiyat ortancası. */
  unitPrice: number | null
}

/** Dönemde en çok teklif verilen ürünler; fiyat liste fiyatı DEĞİL, teklif edilen fiyattır. */
export function popularProducts(quotes: readonly ProductQuote[], asOf: string, days = 30, limit = 4): PopularProduct[] {
  const from = Date.parse(asOf) - days * 86400000
  const groups = new Map<string, { label: string; prices: number[]; count: number }>()

  for (const q of quotes) {
    if (Date.parse(q.created_at) < from) continue
    const thickness = Number(q.thickness_cm ?? 0)
    if (!(thickness > 0)) continue
    const material = q.material_type === 'eps' ? 'EPS' : 'Taşyünü'
    const brand = q.brand_name && q.brand_name !== '—' ? q.brand_name : 'Marka kayıtlı değil'
    const key = `${material}|${thickness}|${brand}`
    const g = groups.get(key) ?? { label: `${material} ${thickness} cm · ${brand}`, prices: [], count: 0 }
    g.count += 1
    const price = Number(q.price_per_m2 ?? 0)
    if (price > 0) g.prices.push(price)
    groups.set(key, g)
  }

  return [...groups.entries()]
    .map(([key, g]) => {
      const sorted = [...g.prices].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length === 0 ? null : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      return { key, label: g.label, count: g.count, unitPrice: median == null ? null : Math.round(median * 100) / 100 }
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr-TR'))
    .slice(0, limit)
}

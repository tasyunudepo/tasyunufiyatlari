import { describe, expect, it } from 'vitest'

import {
  popularProducts,
  recentActivity,
  sourceSummary,
  teamPlan,
  tomorrowPlan,
} from '@/lib/admin/officeOverview'
import type { OfficeData } from '@/lib/admin/officeModel'

// Genel Bakış'ın alt bölümleri kayıtlardan hesaplanır; maketteki örnek
// sayılar ekrana yazılmaz (9 Ekim 2026 kullanıcı kararı: "gerçek veriyle").
// asOf: 9 Ekim 2026 Cuma 10:00 İstanbul.
const AS_OF = '2026-10-09T07:00:00.000Z'

const proje = (id: string, status: string | null, created = '2026-10-05T09:00:00+03:00') => ({
  id, name: `Proje ${id}`, customer_id: null, owner: 'Ayşe Yılmaz', status, created_at: created,
  valuation_quote_id: null, valuation_revision: null, valuation_net_amount: null, valuation_selected_at: null,
})
const gorev = (id: string, project: string, due: string, status: 'open' | 'done' | 'cancelled' = 'open', extra = {}) => ({
  id, project_id: project, kind: 'followup' as const, due_at: due, owner: 'Ayşe Yılmaz', status,
  completed_at: null, cancelled_at: null, ...extra,
})

function veri(parca: Partial<OfficeData>): OfficeData {
  return { asOf: AS_OF, truncated: false, projects: [], quotes: [], tasks: [], interactions: [], calendar: null, legacyCutoff: null, ...parca }
}

describe('talep kaynakları', () => {
  const projects = [proje('p1', 'completed'), proje('p2', 'rejected'), proje('p3', 'quoted'), proje('p4', 'completed'), proje('eski', 'completed', '2026-08-01T09:00:00+03:00')]
  const quotes = [
    { id: 'q1', project_id: 'p1', source_channel: 'wizard', created_at: '2026-10-05T09:00:00+03:00' },
    // Aynı projenin sonradan eklenen ofis alternatifi kaynağı DEĞİŞTİRMEZ.
    { id: 'q1b', project_id: 'p1', source_channel: 'ofis', created_at: '2026-10-06T09:00:00+03:00' },
    { id: 'q2', project_id: 'p2', source_channel: 'wizard', created_at: '2026-10-05T10:00:00+03:00' },
    { id: 'q3', project_id: 'p3', source_channel: 'catalog', created_at: '2026-10-05T11:00:00+03:00' },
    { id: 'q4', project_id: 'p4', source_channel: 'ofis', created_at: '2026-10-05T12:00:00+03:00' },
    { id: 'q5', project_id: null, source_channel: 'wizard', created_at: '2026-10-08T12:00:00+03:00' },
    { id: 'qe', project_id: 'eski', source_channel: 'wizard', created_at: '2026-08-01T09:00:00+03:00' },
  ]

  it('tekil projeyi ilk teklifinin kaynağına yazar ve dönem dışını saymaz', () => {
    const ozet = sourceSummary(projects, quotes, AS_OF)
    expect(ozet.total).toBe(4)
    // Çok projeli kaynak üstte; eşitlikte ekrandaki ada göre alfabetik.
    expect(ozet.rows.map((r) => [r.source, r.projects, r.won])).toEqual([
      ['wizard', 2, 1],
      ['ofis', 1, 1],
      ['catalog', 1, 0],
    ])
  })

  it('kazanma oranı kazanılan / tekil projedir', () => {
    const ozet = sourceSummary(projects, quotes, AS_OF)
    expect(ozet.rows.find((r) => r.source === 'wizard')?.winRate).toBe(50)
    expect(ozet.rows.find((r) => r.source === 'catalog')?.winRate).toBe(0)
  })

  it('projeye bağlanmamış teklifi proje saymaz, ayrı bildirir', () => {
    expect(sourceSummary(projects, quotes, AS_OF).unlinkedQuotes).toBe(1)
  })

  it('satırların toplamı tekil proje sayısına eşittir', () => {
    const ozet = sourceSummary(projects, quotes, AS_OF)
    expect(ozet.rows.reduce((t, r) => t + r.projects, 0)).toBe(ozet.total)
  })
})

describe('bugünkü ekip planı ve yarın', () => {
  const data = veri({
    projects: [proje('p1', 'quoted'), proje('p2', 'quoted'), proje('p3', 'quoted'), proje('p4', 'quoted')],
    tasks: [
      gorev('gecikmis', 'p1', '2026-10-08T14:00:00+03:00'),
      gorev('bugun', 'p2', '2026-10-09T15:00:00+03:00'),
      gorev('bitti', 'p3', '2026-10-09T09:30:00+03:00', 'done', { completed_at: '2026-10-09T09:40:00+03:00' }),
      gorev('yarin', 'p4', '2026-10-10T11:00:00+03:00'),
      gorev('haftaya', 'p4', '2026-10-16T11:00:00+03:00'),
    ],
  })

  it('bugünün planı günlük sayaçla aynı görev kümesidir', () => {
    const plan = teamPlan(data)
    expect(plan.map((r) => [r.id, r.state])).toEqual([
      ['gecikmis', 'late'],
      ['bitti', 'done'],
      ['bugun', 'waiting'],
    ])
    expect(plan[0].projectName).toBe('Proje p1')
  })

  it('yarın yalnız yarının açık işlerini gösterir', () => {
    expect(tomorrowPlan(data).map((r) => r.id)).toEqual(['yarin'])
  })
})

describe('son işlemler ve popüler ürünler', () => {
  const data = veri({
    projects: [proje('p1', 'quoted')],
    interactions: [
      { id: 1, quote_id: 'q1', project_id: 'p1', kind: 'arama_giden', outcome: 'ulasildi', occurred_at: '2026-10-09T09:00:00+03:00', created_by: 'Ayşe Yılmaz' },
      { id: 2, quote_id: 'q1', project_id: 'p1', kind: 'not', outcome: null, occurred_at: '2026-10-08T16:00:00+03:00', created_by: 'Mehmet Demir', body: 'Şartname bekleniyor.' },
    ],
  })
  const quotes = [
    { id: 'q1', quote_code: 'TE-2026-000001', customer_name: 'Deneme Yapı', quoted_by: 'Ayşe Yılmaz', created_at: '2026-10-09T08:00:00+03:00', material_type: 'eps', thickness_cm: 4, brand_name: 'Optimix', price_per_m2: 130.8 },
    { id: 'q2', quote_code: 'TE-2026-000002', customer_name: 'Başka Yapı', quoted_by: 'Ayşe Yılmaz', created_at: '2026-10-07T08:00:00+03:00', material_type: 'eps', thickness_cm: 4, brand_name: 'Optimix', price_per_m2: 128 },
    { id: 'q3', quote_code: 'TE-2026-000003', customer_name: 'Üçüncü', quoted_by: 'Ayşe Yılmaz', created_at: '2026-10-06T08:00:00+03:00', material_type: 'tasyunu', thickness_cm: 8, brand_name: 'Dalmaçyalı', price_per_m2: 400 },
    { id: 'q0', quote_code: 'TE-2026-000000', customer_name: 'Eski', quoted_by: 'Ayşe Yılmaz', created_at: '2026-07-01T08:00:00+03:00', material_type: 'tasyunu', thickness_cm: 8, brand_name: 'Dalmaçyalı', price_per_m2: 350 },
  ]

  it('son işlemler en yeniden eskiye sıralanır ve kimin yaptığını taşır', () => {
    const akis = recentActivity(data, quotes, 3)
    expect(akis.map((a) => a.by)).toEqual(['Ayşe Yılmaz', 'Ayşe Yılmaz', 'Mehmet Demir'])
    expect(akis[0].text).toContain('Proje p1')
    expect(akis[0].text).toContain('Ulaşıldı')
    expect(akis[1].text).toContain('TE-2026-000001')
  })

  it('popüler ürün son 30 günün tekliflerinden sayılır; birim fiyat tekliflerin ortancasıdır', () => {
    const urunler = popularProducts(quotes, AS_OF)
    expect(urunler[0]).toMatchObject({ label: 'EPS 4 cm · Optimix', count: 2, unitPrice: 129.4 })
    expect(urunler[1]).toMatchObject({ label: 'Taşyünü 8 cm · Dalmaçyalı', count: 1, unitPrice: 400 })
  })
})

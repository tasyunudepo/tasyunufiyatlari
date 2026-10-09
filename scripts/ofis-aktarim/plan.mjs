// İlk aktarım planı — saf işlev, yan etkisi yok.
//
// NEDEN: taşımadan sonra iş sırası boş açılır (0 proje, 0 görev); mevcut
// teklifler kendiliğinden işe dönüşmez. Son günlerin açık teklifleri bir
// kereye mahsus projeye çevrilir ki panel ilk gün dolu açılsın
// (9 Ekim 2026 kullanıcı kararı).
//
// KURALLAR
//  · Yalnız son `days` takvim gününün kapanmamış teklifleri.
//  · Aynı MÜŞTERİ KAYDININ (customer_id) teklifleri tek projedir; kayıt
//    v24'te telefonun birebir eşleşmesiyle kurulur. Ad ya da telefon
//    BENZERLİĞİYLE birleştirme yapılmaz; müşteri kaydı olmayan teklif tek
//    başına proje olur.
//  · Proje ilk gelen teklifle açılır (ilk temas hedefi müşterinin ilk yazdığı
//    ana göre hesaplanır); diğerleri alternatif olarak bağlanır.
//  · Proje değeri en son verilen tekliften seçilir.
//  · Proje aşaması, müşterinin tekliflerindeki en ileri aşamadır (bir teklifi
//    onaylanmış müşterinin projesi, sonradan yeni talep geldi diye "bekliyor"a
//    dönmez).
//  · Aktarılan her projenin tek bir sıradaki işi olur:
//      – temas kaydı yok, ofis teklifi yazılmamış → ilk temas işi;
//      – söz verilmiş takip tarihi var → o güne takip işi;
//      – temas kaydı var ya da ofis teklif yazmış, tarih yok → aktarım gününün
//        mesai sonuna takip işi (`defaultFollowUpAt`).
//    Ofisin elle teklif yazdığı müşteriyle zaten görüşülmüştür; ona "ilk temas
//    gecikti" demek yanlış alarm olur (canlı veride TE-2026-000240/241).
//  · Müşterinin bir teklifi zaten projedeyse yeni proje açılmaz, kalanlar o
//    projeye bağlanır. Teklifleri birden fazla projeye dağılmışsa karar
//    operatöre bırakılır (`manual`).
import { createHash } from 'node:crypto'

const CLOSED = new Set(['completed', 'rejected'])
const STAGES = ['pending', 'contacted', 'quoted', 'approved']

/** Sabit, UUIDv5 biçimli işlem anahtarı: aynı aktarım yeniden koşulursa aynı kayıt. */
export function seedKey(op, id) {
  const h = createHash('sha1').update(`ofis-ilk-aktarim:${op}:${id}`).digest('hex')
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** `now` anından sonraki ilk mesai kapanışı (İstanbul). Takvim yoksa null. */
export function closingTime(calendar, now) {
  if (!calendar) return null
  const t = Date.parse(now)
  for (let i = 0; i < 8; i++) {
    const day = new Date(t + i * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
    const close = Date.parse(`${day}T${calendar.closes}:00+03:00`)
    if (calendar.weekdays.includes(new Date(`${day}T12:00:00+03:00`).getUTCDay()) && close > t) return new Date(close).toISOString()
  }
  return null
}

/**
 * @param {Array<Record<string, any>>} quotes  /api/admin/quotes satırları
 * @param {{ now: string, days?: number, defaultOwner: string, followUpTime?: string, defaultFollowUpAt?: string | null }} options
 */
export function planSeed(quotes, { now, days = 14, defaultOwner, followUpTime = '09:00', defaultFollowUpAt = null }) {
  // Pencere takvim günüyle sayılır (İstanbul): "son 14 gün" 14 gün önceki günün
  // başından başlar; o gün öğleden sonra gelen teklif saat farkıyla dışarıda kalmaz.
  const fromDay = new Date(Date.parse(now) - days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
  const from = Date.parse(`${fromDay}T00:00:00+03:00`)
  const skipped = { old: 0, closed: 0, linked: 0 }
  const byCustomer = new Map()

  for (const q of quotes) {
    if (CLOSED.has(q.status)) { skipped.closed += 1; continue }
    if (Date.parse(q.created_at) < from) { skipped.old += 1; continue }
    if (q.project_id) skipped.linked += 1
    const key = q.customer_id != null ? `c:${q.customer_id}` : `q:${q.id}`
    if (!byCustomer.has(key)) byCustomer.set(key, [])
    byCustomer.get(key).push(q)
  }

  const groups = [], settled = [], manual = []
  for (const [key, list] of byCustomer) {
    list.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || String(a.id).localeCompare(String(b.id)))
    const open = list.filter((q) => !q.project_id)
    const projectIds = [...new Set(list.filter((q) => q.project_id).map((q) => String(q.project_id)))]
    const first = list[0], latest = list[list.length - 1]
    // Temas ve takip bilgisi müşterinin bağlı teklifleri dahil hepsinden okunur.
    const contacted = list.some((q) => q.contact_attempted_at)
    const officeQuote = list.some((q) => q.request_type === 'manual_quote')
    const engaged = contacted || officeQuote
    const followUp = list.map((q) => q.follow_up_date).filter(Boolean).sort().at(-1) ?? null
    const named = [...list].reverse().find((q) => (q.customer_company ?? '').trim()) ?? latest
    const existingProjectId = projectIds[0] ?? null
    const anchorQuoteId = existingProjectId ? null : String(first.id)
    const linkQuoteIds = open.filter((q) => String(q.id) !== anchorQuoteId).map((q) => String(q.id))

    const group = {
      key,
      name: `${(named.customer_company ?? '').trim() || named.customer_name} · ${latest.city_name ?? '—'}`.slice(0, 200),
      owner: [...list].reverse().map((q) => (q.quoted_by ?? '').trim()).find(Boolean) || defaultOwner,
      existingProjectId,
      anchorQuoteId,
      linkQuoteIds,
      valuationQuoteId: String(latest.id),
      valuationRevision: latest.package_items?.manual?.revisions?.length ?? 0,
      stage: STAGES[Math.max(0, ...list.map((q) => STAGES.indexOf(q.status)))],
      hasContact: contacted,
      engaged,
      cancelReason: contacted ? 'İlk aktarım: temas kaydı zaten var' : officeQuote ? 'İlk aktarım: ofis teklifi yazılmış' : null,
      followUpAt: !engaged ? null : followUp ? `${String(followUp).slice(0, 10)}T${followUpTime}:00+03:00` : defaultFollowUpAt,
      followUpSource: !engaged ? null : followUp ? 'kayıt' : 'aktarım günü',
      firstArrival: first.created_at,
      quoteCodes: list.map((q) => q.quote_code ?? `#${q.id}`),
      keys: {
        create: seedKey('create', first.id),
        link: Object.fromEntries(linkQuoteIds.map((id) => [id, seedKey('link', id)])),
        valuation: seedKey('valuation', latest.id),
        stage: seedKey('stage', first.id),
        cancel: seedKey('cancel', first.id),
        followUp: seedKey('followup', first.id),
      },
    }
    if (projectIds.length > 1) manual.push(group)
    else if (open.length === 0) settled.push(group)
    else groups.push(group)
  }

  const order = (a, b) => Date.parse(a.firstArrival) - Date.parse(b.firstArrival) || a.key.localeCompare(b.key)
  return { groups: groups.sort(order), settled: settled.sort(order), manual: manual.sort(order), skipped, from: new Date(from).toISOString(), days }
}

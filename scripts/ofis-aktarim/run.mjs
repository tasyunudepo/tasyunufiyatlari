// İlk aktarım — operatörün kullandığı uçlar üzerinden (GET /api/admin/quotes,
// GET /api/admin/office, POST /api/admin/office/operations). Veritabanına
// doğrudan yazmaz; panelde elle yapılan işlemin aynısını sırayla gönderir.
//
// Varsayılan KURU çalışmadır: yalnız okur ve planı yazar. Kayıt için --uygula.
//
// Kullanım:
//   OFIS_AKTARIM_USER=… OFIS_AKTARIM_PASSWORD=… node scripts/ofis-aktarim/run.mjs \
//     --taban https://www.tasyunufiyatlari.com [--sorumlu ad] [--gun 14] [--uygula]
//
// Yeniden koşulabilir: işlem anahtarları sabittir, sunucu aynı anahtarı ikinci
// kez yazmaz. Yarıda kalan aktarım kaldığı yerden tamamlanır. Operatörün
// üzerinde çalışmaya başladığı projeye dokunulmaz; o müşterinin sonradan gelen
// teklifini projeye bağlama kararı da operatöründür.
import { closingTime, planSeed } from './plan.mjs'

const arg = (name, fallback = null) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : fallback }
const UYGULA = process.argv.includes('--uygula')
const user = process.env.OFIS_AKTARIM_USER, password = process.env.OFIS_AKTARIM_PASSWORD
const taban = arg('taban'), sorumlu = arg('sorumlu', user), gun = Number(arg('gun', '14'))
if (!taban || !user || !password || !Number.isFinite(gun) || gun <= 0) {
  console.error('Eksik: --taban ve OFIS_AKTARIM_USER / OFIS_AKTARIM_PASSWORD ortam değişkenleri gerekli; --gun pozitif sayı olmalı.')
  process.exit(2)
}
const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64')

class IstekHatasi extends Error { constructor(message, status) { super(message); this.status = status } }

/** 5xx ve ağ hatasında aynı anahtarla yeniden dener; 4xx kesin cevaptır. */
async function iste(yol, { method = 'GET', body, key } = {}) {
  let son
  for (let deneme = 0; deneme < 4; deneme++) {
    if (deneme) await new Promise((r) => setTimeout(r, 800 * deneme))
    try {
      const res = await fetch(taban + yol, { method, headers: { authorization: auth, ...(body ? { 'content-type': 'application/json' } : {}), ...(key ? { 'idempotency-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.ok) return json
      son = new IstekHatasi(`${method} ${yol} → HTTP ${res.status}: ${json?.error ?? 'yanıt okunamadı'}`, res.status)
      if (res.status < 500) throw son
    } catch (e) {
      if (e instanceof IstekHatasi && e.status < 500) throw e
      son = e
    }
  }
  throw son
}
const islem = (key, body) => iste('/api/admin/office/operations', { method: 'POST', key, body })

const { quotes } = await iste('/api/admin/quotes')
// Projelerin o anki hâli ve mesai takvimi. Taşımadan önce bu uç kapalıdır;
// kuru çalışma o durumda yalnız tekliflerle plan çıkarır.
const masa = await iste('/api/admin/office').catch((e) => { if (UYGULA) throw e; return null })
if (UYGULA && !masa.calendar) { console.error('Mesai takvimi tanımlı değil (OFIS_WORK_CALENDAR). Hiçbir kayıt yazılmadı.'); process.exit(2) }
const simdi = new Date().toISOString()
const plan = planSeed(quotes, { now: simdi, days: gun, defaultOwner: sorumlu, defaultFollowUpAt: closingTime(masa?.calendar ?? null, simdi) })
const ASAMA = { pending: 'bekliyor', contacted: 'görüşüldü', quoted: 'teklif verildi', approved: 'onaylandı' }
const gunSaat = (iso) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const isAdi = (g) => (!g.engaged ? 'ilk temas' : g.followUpAt ? 'takip ' + gunSaat(g.followUpAt) : 'takip (aktarım günü mesai sonu)')

console.log(`${quotes.length} teklif okundu · son ${plan.days} gün (${new Date(plan.from).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })} ve sonrası)`)
console.log(`kapsam dışı: ${plan.skipped.old} eski · ${plan.skipped.closed} kapanmış · zaten projede: ${plan.skipped.linked}`)
const yeni = plan.groups.filter((g) => !g.existingProjectId)
console.log(`açılacak proje: ${yeni.length} · projeye bağlanacak teklif: ${yeni.reduce((t, g) => t + 1 + g.linkQuoteIds.length, 0)} · projesi olan müşteriden yeni gelen teklif: ${plan.groups.filter((g) => g.existingProjectId).reduce((t, g) => t + g.linkQuoteIds.length, 0)}`)
console.log(`ilk temas işi: ${yeni.filter((g) => !g.engaged).length} · kayıtlı tarihe takip: ${yeni.filter((g) => g.followUpSource === 'kayıt').length} · aktarım gününe takip (temas kaydı ya da ofis teklifi var, tarih yok): ${yeni.filter((g) => g.followUpSource === 'aktarım günü').length}`)
if (plan.manual.length) console.log(`elle karar gereken müşteri (teklifleri birden fazla projede): ${plan.manual.map((g) => g.name).join(' | ')}`)
console.table(plan.groups.map((g) => ({
  proje: g.name, teklif: g.quoteCodes.length, sorumlu: g.owner, aşama: ASAMA[g.stage], iş: isAdi(g),
  ilkGeliş: gunSaat(g.firstArrival),
  değerTeklifi: g.quoteCodes.at(-1), durum: g.existingProjectId ? 'projesi var' : 'yeni',
})))

if (!UYGULA) { console.log('KURU ÇALIŞMA: hiçbir kayıt yazılmadı. Uygulamak için --uygula ekleyin.'); process.exit(0) }

// Yarıda kalan aktarımı tamamlamak ve operatörün başladığı işe dokunmamak için.
function projeDurumu(projectId) {
  const proje = masa.projects.find((p) => p.id === projectId)
  const isler = masa.tasks.filter((t) => t.project_id === projectId)
  const tek = isler.length === 1 && isler[0].kind === 'initial_contact' ? isler[0] : null
  const aktarimIptali = tek?.status === 'cancelled' && String(tek.cancellation_reason).startsWith('İlk aktarım:')
  // "Taze": açıldığı andaki hâliyle duran ya da aktarımın yarıda bıraktığı proje.
  const taze = Boolean(proje) && Boolean(tek) && (tek.status === 'open' || aktarimIptali) && !masa.interactions.some((i) => i.project_id === projectId)
  return { taze, degerYok: proje?.valuation_quote_id == null, asamaYok: proje?.status === 'pending', acikIlkTemas: taze && tek.status === 'open' ? tek.id : null }
}

const sayac = { proje: 0, baglanan: 0, deger: 0, asama: 0, ilkTemas: 0, takip: 0, iptal: 0, dokunulmayan: 0 }
const uyarilar = []
for (const g of [...plan.groups, ...plan.settled]) {
  let adim = 'proje', yazilan = 0
  // Sunucunun daha önce kaydettiği işlem (replayed) yeniden sayılmaz.
  const yaz = async (alan, key, body) => { const r = await islem(key, body); if (!r.replayed) { sayac[alan] += 1; yazilan += 1 } return r }
  try {
    let projectId = g.existingProjectId, ilkIs = null, taze = true, degerYok = true, asamaYok = true
    if (!projectId) {
      const r = await yaz('proje', g.keys.create, { type: 'project_created', quoteId: g.anchorQuoteId, name: g.name, owner: g.owner })
      projectId = r.projectId; ilkIs = r.taskId
      if (!r.replayed && !g.engaged) sayac.ilkTemas += 1
    } else {
      ({ taze, degerYok, asamaYok, acikIlkTemas: ilkIs } = projeDurumu(projectId))
    }
    if (!taze) {
      sayac.dokunulmayan += 1
      if (g.linkQuoteIds.length) console.log(`→ ${g.name}: ${g.linkQuoteIds.length} yeni teklif var; proje üzerinde çalışılmış, bağlama operatöre bırakıldı`)
      continue
    }
    adim = 'teklif bağlama'
    for (const id of g.linkQuoteIds) await yaz('baglanan', g.keys.link[id], { type: 'project_linked', projectId, quoteId: id })
    if (degerYok) {
      adim = 'proje değeri'
      try {
        await yaz('deger', g.keys.valuation, { type: 'valuation_selected', projectId, quoteId: g.valuationQuoteId, revision: g.valuationRevision })
      } catch (e) {
        // Tutarı kayıtlı olmayan teklif: proje açık kalır, değer panelden seçilir.
        if (e.status !== 422) throw e
        uyarilar.push(`${g.name}: proje değeri seçilemedi (${g.quoteCodes.at(-1)} net tutarı kayıtlı değil)`)
      }
    }
    adim = 'proje aşaması'
    if (asamaYok && g.stage !== 'pending') await yaz('asama', g.keys.stage, { type: 'outcome_recorded', projectId, status: g.stage })
    if (g.engaged) {
      // Müşteriyle zaten görüşülmüş: ilk temas işi açık kalmaz; görüşme kaydı uydurulmaz.
      adim = 'ilk temas işini kapatma'
      if (ilkIs) await yaz('iptal', g.keys.cancel, { type: 'task_cancelled', projectId, taskId: ilkIs, reason: g.cancelReason })
      adim = 'takip planlama'
      if (g.followUpAt) await yaz('takip', g.keys.followUp, { type: 'followup_scheduled', projectId, dueAt: new Date(g.followUpAt).toISOString(), owner: g.owner })
    }
    if (yazilan) console.log(`✓ ${g.name} · ${ASAMA[g.stage]} · ${isAdi(g)}`)
  } catch (e) {
    console.error(`✗ ${g.name} — "${adim}" adımında durdu: ${e.message}`)
    console.error('Aktarım durduruldu. Aynı komutla yeniden koşun: tamamlanan işlemler ikinci kez yazılmaz, yarıda kalan proje tamamlanır.')
    process.exit(1)
  }
}
const toplam = sayac.proje + sayac.baglanan + sayac.deger + sayac.asama + sayac.takip + sayac.iptal
console.log(toplam ? '\nAktarım tamam.' : '\nYazılacak kayıt kalmamış: aktarım daha önce tamamlanmış.')
console.log(`${sayac.proje} proje açıldı · ${sayac.baglanan} teklif bağlandı · ${sayac.deger} proje değeri seçildi · ${sayac.asama} proje aşaması işlendi`)
console.log(`açılan ilk temas işi: ${sayac.ilkTemas} · planlanan takip: ${sayac.takip} · zaten görüşüldüğü için kapatılan ilk temas işi: ${sayac.iptal} · olduğu gibi bırakılan mevcut proje: ${sayac.dokunulmayan}`)
for (const u of uyarilar) console.log('! ' + u)

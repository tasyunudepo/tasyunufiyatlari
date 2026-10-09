import { describe, expect, it } from 'vitest'

import { closingTime, planSeed } from '../../scripts/ofis-aktarim/plan.mjs'

// İlk aktarım: taşıma günü iş sırası boş açılmasın diye son tekliflerin
// projeye çevrilmesi (9 Ekim 2026 kullanıcı kararı). Bu test hangi teklifin
// projeye döneceğini ve hangilerinin dokunulmadan kalacağını kilitler.
const NOW = '2026-10-09T13:47:00+03:00'

const teklif = (id: number, ek: Record<string, unknown> = {}) => ({
  id, quote_code: `TY${id}`, customer_id: null, customer_name: `Müşteri ${id}`, customer_company: null,
  city_name: 'İstanbul', status: 'quoted', created_at: '2026-10-08T10:00:00+03:00',
  contact_attempted_at: null, contact_successful: null, follow_up_date: null, quoted_by: null,
  project_id: null, package_items: null, ...ek,
})

describe('ilk aktarım planı', () => {
  it('aynı müşteri kaydının son tekliflerini TEK projede toplar', () => {
    const plan = planSeed([
      teklif(1, { customer_id: 7, created_at: '2026-10-05T20:01:00+03:00', customer_name: 'Deneme Yapı' }),
      teklif(2, { customer_id: 7, created_at: '2026-10-08T15:31:00+03:00', quoted_by: 'ayse' }),
      teklif(3, { customer_id: 7, created_at: '2026-10-08T15:34:00+03:00', quoted_by: 'ayse', customer_company: 'Deneme Yapı A.Ş.' }),
      teklif(4, { customer_id: 9 }),
    ], { now: NOW, defaultOwner: 'ofis' })

    expect(plan.groups).toHaveLength(2)
    const g = plan.groups.find((x) => x.anchorQuoteId === '1')!
    // Proje ilk gelen teklifle açılır: ilk temas hedefi müşterinin ilk yazdığı ana göre.
    expect(g.linkQuoteIds).toEqual(['2', '3'])
    // Proje değeri en son verilen tekliften.
    expect(g.valuationQuoteId).toBe('3')
    expect(g.name).toBe('Deneme Yapı A.Ş. · İstanbul')
    expect(g.owner).toBe('ayse')
  })

  it('müşteri kaydı olmayan teklif kendi başına proje olur; ad benzerliğiyle birleştirilmez', () => {
    const plan = planSeed([
      teklif(1, { customer_name: 'Aynı Ad' }),
      teklif(2, { customer_name: 'Aynı Ad' }),
    ], { now: NOW, defaultOwner: 'ofis' })
    expect(plan.groups).toHaveLength(2)
    expect(plan.groups.every((g) => g.owner === 'ofis')).toBe(true)
  })

  it('14 günden eski, kapanmış ya da zaten projeye bağlı teklife dokunmaz', () => {
    const plan = planSeed([
      teklif(1, { created_at: '2026-09-20T10:00:00+03:00' }),
      teklif(2, { status: 'rejected' }),
      teklif(3, { status: 'completed' }),
      teklif(4, { project_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
      teklif(5),
    ], { now: NOW, defaultOwner: 'ofis' })
    expect(plan.groups.map((g) => g.anchorQuoteId)).toEqual(['5'])
    expect(plan.skipped).toMatchObject({ old: 1, closed: 2, linked: 1 })
  })

  it('pencereyi takvim günüyle sayar: 14 gün önceki günün sabahı gelen teklif kapsamdadır', () => {
    // NOW = 9 Ekim 13:47. 25 Eylül 09:00, saat hesabıyla 14 günden eskidir ama "son 14 gün"ün içindedir.
    const plan = planSeed([
      teklif(1, { created_at: '2026-09-25T09:00:00+03:00' }),
      teklif(2, { created_at: '2026-09-24T23:59:00+03:00' }),
    ], { now: NOW, defaultOwner: 'ofis' })
    expect(plan.groups.map((g) => g.anchorQuoteId)).toEqual(['1'])
    expect(plan.skipped.old).toBe(1)
    expect(plan.from).toBe('2026-09-24T21:00:00.000Z')
  })

  it('temas kaydı olan müşteride ilk temas işi açık bırakılmaz; söz verilen takip planlanır', () => {
    const plan = planSeed([
      teklif(1, { customer_id: 7, contact_attempted_at: '2026-10-05T21:00:00+03:00', contact_successful: true, follow_up_date: '2026-10-06', quoted_by: 'emrah' }),
      teklif(2, { customer_id: 7, created_at: '2026-10-08T15:31:00+03:00' }),
      teklif(3, { customer_id: 9, contact_attempted_at: '2026-10-08T12:00:00+03:00' }),
    ], { now: NOW, defaultOwner: 'ofis' })
    const takipli = plan.groups.find((g) => g.anchorQuoteId === '1')!
    expect(takipli.hasContact).toBe(true)
    expect(takipli.followUpAt).toBe('2026-10-06T09:00:00+03:00')
    const takipsiz = plan.groups.find((g) => g.anchorQuoteId === '3')!
    expect(takipsiz.hasContact).toBe(true)
    expect(takipsiz.followUpAt).toBeNull()
  })

  it('yarıda kalan aktarımda yeni proje açmaz; kalan teklifi mevcut projeye bağlar', () => {
    const plan = planSeed([
      teklif(1, { customer_id: 7, project_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
      teklif(2, { customer_id: 7 }),
    ], { now: NOW, defaultOwner: 'ofis' })
    expect(plan.groups).toHaveLength(1)
    expect(plan.groups[0]).toMatchObject({ existingProjectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', anchorQuoteId: null, linkQuoteIds: ['2'] })
  })

  it('ofisin elle teklif yazdığı müşteriye ilk temas işi açmaz; takibi aktarım gününe koyar', () => {
    const plan = planSeed([
      teklif(1, { customer_id: 7, request_type: 'whatsapp_order', status: 'pending' }),
      teklif(2, { customer_id: 7, request_type: 'manual_quote', created_at: '2026-10-08T15:31:00+03:00' }),
      teklif(3, { customer_id: 9, request_type: 'pdf_quote' }),
      teklif(4, { customer_id: 11, contact_attempted_at: '2026-10-08T12:00:00+03:00' }),
    ], { now: NOW, defaultOwner: 'ofis', defaultFollowUpAt: '2026-10-09T15:00:00.000Z' })
    const [ofis, web, temasli] = [7, 9, 11].map((c) => plan.groups.find((g) => g.key === `c:${c}`))
    expect(ofis).toMatchObject({ engaged: true, hasContact: false, cancelReason: 'İlk aktarım: ofis teklifi yazılmış', followUpAt: '2026-10-09T15:00:00.000Z', followUpSource: 'aktarım günü' })
    // Kendiliğinden oluşan site teklifi görüşme sayılmaz: ilk temas işi açık kalır.
    expect(web).toMatchObject({ engaged: false, cancelReason: null, followUpAt: null, followUpSource: null })
    expect(temasli).toMatchObject({ engaged: true, cancelReason: 'İlk aktarım: temas kaydı zaten var', followUpAt: '2026-10-09T15:00:00.000Z' })
  })

  it('aktarım günü takibini bir sonraki mesai kapanışına koyar', () => {
    const takvim = { timeZone: 'Europe/Istanbul', weekdays: [1, 2, 3, 4, 5], opens: '09:00', closes: '18:00', firstContactMinutes: 30 }
    // Cuma 13:47 → aynı gün 18:00
    expect(closingTime(takvim, '2026-10-09T13:47:00+03:00')).toBe('2026-10-09T15:00:00.000Z')
    // Cuma 19:10 → mesai bitmiş, hafta sonu kapalı → Pazartesi 18:00
    expect(closingTime(takvim, '2026-10-09T19:10:00+03:00')).toBe('2026-10-12T15:00:00.000Z')
    expect(closingTime(null, NOW)).toBeNull()
  })

  it('proje aşamasını müşterinin en ileri teklif aşamasından alır', () => {
    const plan = planSeed([
      teklif(1, { customer_id: 7, status: 'approved', created_at: '2026-10-05T20:01:00+03:00' }),
      teklif(2, { customer_id: 7, status: 'pending' }),
      teklif(3, { customer_id: 9, status: 'pending' }),
      teklif(4, { customer_id: 11, status: 'tanimsiz-eski-deger' }),
    ], { now: NOW, defaultOwner: 'ofis' })
    expect(plan.groups.map((g) => g.stage)).toEqual(['approved', 'pending', 'pending'])
  })

  it('temas ve takip bilgisini müşterinin projeye bağlı teklifinden de okur', () => {
    const plan = planSeed([
      teklif(1, { customer_id: 7, project_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', contact_attempted_at: '2026-10-08T11:00:00+03:00', follow_up_date: '2026-10-12' }),
      teklif(2, { customer_id: 7, created_at: '2026-10-08T15:31:00+03:00' }),
    ], { now: NOW, defaultOwner: 'ofis' })
    expect(plan.groups[0]).toMatchObject({ hasContact: true, followUpAt: '2026-10-12T09:00:00+03:00' })
  })

  it('bütün teklifleri projede olan müşteriyi iş listesine almaz; ayrı tutar', () => {
    const plan = planSeed([
      teklif(1, { customer_id: 7, project_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
    ], { now: NOW, defaultOwner: 'ofis' })
    expect(plan.groups).toHaveLength(0)
    expect(plan.settled).toHaveLength(1)
    expect(plan.settled[0]).toMatchObject({ existingProjectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', linkQuoteIds: [] })
  })

  it('teklifleri iki ayrı projeye dağılmış müşteride bağlama kararını operatöre bırakır', () => {
    const plan = planSeed([
      teklif(1, { customer_id: 7, project_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
      teklif(2, { customer_id: 7, project_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
      teklif(3, { customer_id: 7 }),
    ], { now: NOW, defaultOwner: 'ofis' })
    expect(plan.groups).toHaveLength(0)
    expect(plan.manual).toHaveLength(1)
  })

  it('her işlem için sabit anahtar üretir: aynı aktarım iki kez koşulsa aynı kayıtlar oluşur', () => {
    const a = planSeed([teklif(1), teklif(2, { customer_id: 7 })], { now: NOW, defaultOwner: 'ofis' })
    const b = planSeed([teklif(2, { customer_id: 7 }), teklif(1)], { now: NOW, defaultOwner: 'ofis' })
    const anahtar = (p: typeof a) => p.groups.map((g) => g.keys.create).sort()
    expect(anahtar(a)).toEqual(anahtar(b))
    expect(a.groups[0].keys.create).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

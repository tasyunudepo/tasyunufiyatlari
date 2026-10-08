import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Teklif revizyonu — var olan ofis teklifini YERİNDE günceller.
//
// Referans olay: 8 Ekim 2026. TE-2026-000240 ve TE-2026-000241, EPS 4 cm
// için 1 kamyon 1.008 m² sanılarak kaydedildi; doğrusu 1.680 m². Düzeltmenin
// tek yolu yeni teklif yazmaktı. Bu test revizenin sözleşmesini kilitler:
// numara değişmez, toplam sunucuda yeniden hesaplanır, önceki sürüm iz bırakır.

const mocks = vi.hoisted(() => ({
  existing: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'material_types') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { slug: 'eps', min_order_m2: 1000 }, error: null }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: mocks.existing }),
        }),
        insert: (payload: Record<string, unknown>) => {
          mocks.insert(payload)
          return { select: () => ({ single: async () => ({ data: { id: 999 }, error: null }) }) }
        },
        update: (payload: Record<string, unknown>) => {
          mocks.update(payload)
          const sonuc = {
            select: () => ({
              maybeSingle: async () => ({
                data: { id: 240, quote_code: 'TE-2026-000240' },
                error: null,
              }),
            }),
          }
          return { eq: () => ({ eq: () => sonuc, ...sonuc }) }
        },
      }
    },
  }),
}))

import { PUT } from '@/app/api/admin/quotes/manual/route'

const AUTH = 'Basic ' + Buffer.from('admin:test-sifre-1234').toString('base64')

const KAYITLI = {
  id: 240,
  request_type: 'manual_quote',
  quote_code: 'TE-2026-000240',
  area_m2: 1008,
  price_without_vat: 131846.4,
  total_price: 158215.68,
  pdf_storage_path: '240/eski.pdf',
  package_items: { items: [], manual: { createdBy: 'barbaros' } },
}

// 1.680 m² × 130,80 ₺ = 219.744,00 ₺ (KDV hariç)
function govde(ek: Record<string, unknown> = {}) {
  return {
    quoteId: 240,
    customerName: 'Revize Test',
    customerPhone: '05550001122',
    cityCode: '34',
    cityName: 'İstanbul',
    materialType: 'eps',
    areaM2: 1680,
    validityDays: 7,
    lines: [
      {
        kind: 'levha',
        catalogKey: 'levha-42-4',
        description: 'Optimix Karbonlu 4 cm',
        quantity: 1680,
        unit: 'm²',
        unitPrice: 130.8,
        isPlate: true,
        thicknessCm: 4,
      },
    ],
    discountPct: 0,
    shippingCharge: 0,
    shippingMode: 'buyer_pays',
    expectedPriceWithoutVat: 219744,
    expectedTotalPrice: 263692.8,
    consentChannel: 'telefon',
    ...ek,
  }
}

function istek(payload: unknown, auth: string | null = AUTH) {
  return new NextRequest('https://www.tasyunufiyatlari.com/api/admin/quotes/manual', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(payload),
  })
}

describe('teklif revizyonu (PUT /api/admin/quotes/manual)', () => {
  beforeEach(() => {
    process.env.ADMIN_USER = 'admin'
    process.env.ADMIN_PASSWORD = 'test-sifre-1234'
    delete process.env.PATRON_PASSWORD
    mocks.existing.mockReset().mockResolvedValue({ data: KAYITLI, error: null })
    mocks.update.mockReset()
    mocks.insert.mockReset()
  })

  it('kimliksiz istek 401 alır ve kayda dokunmaz', async () => {
    const res = await PUT(istek(govde(), null))
    expect(res.status).toBe(401)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('teklif kimliği yoksa 400 döner', async () => {
    const res = await PUT(istek(govde({ quoteId: undefined })))
    expect(res.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('1.008 m² teklifi 1.680 m² olarak aynı numarayla günceller', async () => {
    const res = await PUT(istek(govde()))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ ok: true, quoteId: 240, quoteCode: 'TE-2026-000240', revisionNo: 1 })
    expect(json.totals).toMatchObject({ priceWithoutVat: 219744, totalPrice: 263692.8 })

    // Yeni kayıt AÇILMAZ.
    expect(mocks.insert).not.toHaveBeenCalled()

    const yazilan = mocks.update.mock.calls[0][0]
    expect(yazilan.area_m2).toBe(1680)
    expect(yazilan.price_without_vat).toBe(219744)
    expect(yazilan.total_price).toBe(263692.8)
    expect(yazilan.price_per_m2).toBe(130.8)
    expect(yazilan.package_items.items[0]).toMatchObject({
      quantity: 1680,
      unitPrice: 130.8,
      totalPrice: 219744,
      thicknessCm: 4,
    })
    // Numara, durum ve kanal revizede yeniden yazılmaz.
    expect(yazilan).not.toHaveProperty('quote_code')
    expect(yazilan).not.toHaveProperty('status')
    expect(yazilan).not.toHaveProperty('request_type')
  })

  it('önceki sürümü revizyon kaydına yazar ve PDF yolunu boşaltır', async () => {
    await PUT(istek(govde()))
    const yazilan = mocks.update.mock.calls[0][0]

    expect(yazilan.package_items.manual.revisionNo).toBe(1)
    expect(yazilan.package_items.manual.revisions).toHaveLength(1)
    expect(yazilan.package_items.manual.revisions[0]).toMatchObject({
      no: 1,
      by: 'admin',
      areaM2: 1008,
      priceWithoutVat: 131846.4,
      totalPrice: 158215.68,
      pdfStoragePath: '240/eski.pdf',
    })
    // Teklifi ilk yazan kişi korunur.
    expect(yazilan.package_items.manual.createdBy).toBe('barbaros')
    // Yeni PDF bağlanabilsin diye arşiv yolu boşalır; eski yol revizyonda kalır.
    expect(yazilan.pdf_storage_path).toBeNull()
    expect(yazilan.package_items.manual.shippingMode).toBe('buyer_pays')
  })

  it('ikinci revizyon ilkini silmez', async () => {
    mocks.existing.mockResolvedValue({
      data: {
        ...KAYITLI,
        package_items: {
          items: [],
          manual: { createdBy: 'barbaros', revisions: [{ no: 1, areaM2: 900 }] },
        },
      },
      error: null,
    })
    const res = await PUT(istek(govde()))
    const yazilan = mocks.update.mock.calls[0][0]

    expect((await res.json()).revisionNo).toBe(2)
    expect(yazilan.package_items.manual.revisions.map((r: { no: number }) => r.no)).toEqual([1, 2])
  })

  it('sitedeki sihirbazdan gelen teklifin üstüne yazmaz', async () => {
    mocks.existing.mockResolvedValue({
      data: { ...KAYITLI, request_type: 'pdf_quote' },
      error: null,
    })
    const res = await PUT(istek(govde()))
    expect(res.status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('olmayan teklifte 404 döner', async () => {
    mocks.existing.mockResolvedValue({ data: null, error: null })
    const res = await PUT(istek(govde()))
    expect(res.status).toBe(404)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('ekranın toplamı sunucununkiyle tutmuyorsa reddeder', async () => {
    // Miktar 1.680'e çıkmış ama ekran eski toplamı gönderiyor.
    const res = await PUT(istek(govde({ expectedPriceWithoutVat: 131846.4 })))
    expect(res.status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('minimum sipariş altında gerekçe ister, gerekçeyle geçer', async () => {
    const kucuk = govde({
      areaM2: 500,
      lines: [{ ...govde().lines[0], quantity: 500 }],
      expectedPriceWithoutVat: 65400,
      expectedTotalPrice: 78480,
    })
    const ilk = await PUT(istek(kucuk))
    expect(ilk.status).toBe(422)
    expect((await ilk.json()).needsOverride).toBe(true)
    expect(mocks.update).not.toHaveBeenCalled()

    const ikinci = await PUT(
      istek({ ...kucuk, overrideCommercialRules: true, overrideReason: 'müşteri onayı' }),
    )
    expect(ikinci.status).toBe(200)
    expect(mocks.update.mock.calls[0][0].admin_notes).toBe('Kural aşımı: müşteri onayı')
  })
})

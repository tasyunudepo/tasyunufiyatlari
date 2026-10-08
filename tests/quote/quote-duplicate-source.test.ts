import { describe, expect, it } from 'vitest'

import { quoteToDuplicateSource } from '@/components/admin/quote-editor/QuoteDuplicateDialog'

// Çoğaltma ve revize aynı kaynağı kullanır: kayıtlı teklif → editör.
//
// 8 Ekim 2026 kullanıcı geri bildirimi: çoğaltma yalnız sepeti getiriyordu;
// ad, telefon ve şehir tek tek yeniden girilince çoğaltmanın anlamı kalmıyordu.

const OFIS_TEKLIFI = {
  id: 240,
  quote_code: 'TE-2026-000240',
  request_type: 'manual_quote',
  customer_name: 'Deneme Müşteri',
  customer_phone: '05550001122',
  customer_company: 'Deneme Yapı',
  customer_email: '',
  city_code: '34',
  city_name: 'İstanbul',
  material_type: 'eps',
  thickness_cm: 4,
  area_m2: 1008,
  consent_channel: 'whatsapp',
  discount_percentage: 0,
  package_name: 'Ofis teklifi',
  package_items: {
    items: [
      {
        name: 'Optimix Karbonlu 4 cm',
        quantity: 1008,
        unit: 'm²',
        unitPrice: 130.8,
        listUnitPrice: 130.8,
        isPlate: true,
        catalogKey: 'levha-42-4',
        kind: 'levha',
      },
    ],
    manual: { title: null, notes: 'Peşin fiyatıdır.', discountPct: 0, shippingCharge: 0, validityDays: 10 },
  },
}

describe('kayıtlı teklif → editör kaynağı', () => {
  it('müşteri, firma, şehir ve iletişim kanalını taşır', () => {
    const kaynak = quoteToDuplicateSource(OFIS_TEKLIFI)
    expect(kaynak).toMatchObject({
      customerName: 'Deneme Müşteri',
      customerPhone: '05550001122',
      customerCompany: 'Deneme Yapı',
      customerEmail: '',
      cityCode: '34',
      consentChannel: 'whatsapp',
    })
  })

  it('revize için teklifin kimliğini, numarasını ve türünü taşır', () => {
    expect(quoteToDuplicateSource(OFIS_TEKLIFI)).toMatchObject({
      quoteId: 240,
      quoteCode: 'TE-2026-000240',
      requestType: 'manual_quote',
    })
  })

  it('yazılan birim fiyatı, metrajı, notu ve geçerliliği korur', () => {
    const kaynak = quoteToDuplicateSource(OFIS_TEKLIFI)
    expect(kaynak?.areaM2).toBe(1008)
    expect(kaynak?.notes).toBe('Peşin fiyatıdır.')
    expect(kaynak?.validityDays).toBe(10)
    expect(kaynak?.lines[0]).toMatchObject({
      description: 'Optimix Karbonlu 4 cm',
      quantity: 1008,
      unit: 'm²',
      unitPrice: 130.8,
      isPlate: true,
    })
  })

  it('eski kayıtta saklanmayan levha kalınlığını katalog anahtarından çıkarır', () => {
    // Kalınlık kaybolursa toz grubunda dübel boyu yanlış seçilir.
    expect(quoteToDuplicateSource(OFIS_TEKLIFI)?.lines[0].thicknessCm).toBe(4)
  })

  it('kayıtta nakliye sunumu yoksa uydurmaz', () => {
    expect(quoteToDuplicateSource(OFIS_TEKLIFI)?.shippingMode).toBeNull()
    const yeni = structuredClone(OFIS_TEKLIFI) as typeof OFIS_TEKLIFI & {
      package_items: { manual: Record<string, unknown> }
    }
    yeni.package_items.manual.shippingMode = 'buyer_pays'
    expect(quoteToDuplicateSource(yeni)?.shippingMode).toBe('buyer_pays')
  })

  it('toplu iskontoda liste fiyatını alır; iskonto iki kez uygulanmaz', () => {
    const iskontolu = structuredClone(OFIS_TEKLIFI)
    iskontolu.package_items.items[0].unitPrice = 117.72
    iskontolu.package_items.manual.discountPct = 10
    const kaynak = quoteToDuplicateSource(iskontolu)
    expect(kaynak?.discountPct).toBe(10)
    expect(kaynak?.lines[0].unitPrice).toBe(130.8)
  })

  it('sitedeki sihirbaz teklifinden de müşteri ve levha gelir', () => {
    const kaynak = quoteToDuplicateSource({
      id: 239,
      quote_code: 'TY8417917',
      request_type: 'pdf_quote',
      customer_name: 'Site Müşterisi',
      customer_phone: '05321112233',
      city_code: 34,
      material_type: 'eps',
      thickness_cm: 4,
      area_m2: 1680,
      package_items: {
        items: [
          { name: 'Expert EPS Karbonlu 4 cm EPS', unit: 'm²', isPlate: true, quantity: 1680, unitPrice: 120, packageCount: 280 },
        ],
      },
    })
    expect(kaynak).toMatchObject({
      requestType: 'pdf_quote',
      customerName: 'Site Müşterisi',
      customerPhone: '05321112233',
      cityCode: '34',
      areaM2: 1680,
    })
    // Katalog anahtarı yok; kalınlık teklifin kendi kolonundan gelir.
    expect(kaynak?.lines[0].thicknessCm).toBe(4)
  })

  it('"Ofis teklifi" yer tutucusunu başlık diye geri yüklemez', () => {
    // TE-2026-000241: çoğaltılan teklifin başlığı "Ofis teklifi" oldu ve
    // PDF'te "Seçilen Sistem" satırına levha adı yerine bu yazıldı.
    expect(quoteToDuplicateSource(OFIS_TEKLIFI)?.title).toBeNull()

    const basligiyla = (title: string) => ({
      ...OFIS_TEKLIFI,
      package_items: {
        ...OFIS_TEKLIFI.package_items,
        manual: { ...OFIS_TEKLIFI.package_items.manual, title },
      },
    })
    expect(quoteToDuplicateSource(basligiyla('Ofis teklifi'))?.title).toBeNull()
    expect(
      quoteToDuplicateSource(basligiyla('Optimix Karbonlu 4 cm + Optimix toz grubu'))?.title,
    ).toBe('Optimix Karbonlu 4 cm + Optimix toz grubu')
  })

  it('kalemi olmayan teklif için null döner', () => {
    expect(quoteToDuplicateSource({ id: 1, package_items: { items: [] } })).toBeNull()
    expect(quoteToDuplicateSource({ id: 1, package_items: null })).toBeNull()
  })
})

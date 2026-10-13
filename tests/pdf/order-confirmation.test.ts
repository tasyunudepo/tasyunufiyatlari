import { describe, expect, it } from 'vitest'

import { BUSINESS_INFO } from '@/lib/business/info'
import {
  buildOrderConfirmationHtml,
  buildOrderConfirmationModel,
  capacityFromQuote,
  computeFirstVehicle,
  orderConfirmationFileName,
  orderInputFromQuote,
  productLabelFromQuote,
  type OrderConfirmationInput,
} from '@/lib/pdf/orderConfirmation'

// Gerçek teklif TY9008555 (6 Eylül 2026): Bonus F 120, 8 cm, 1.045,44 m²,
// 484 paket × 2,16 m² = 1 TIR; kamyon 264 paket.
const CAPACITY = capacityFromQuote({
  truckCapacityPackages: 484,
  lorryCapacityPackages: 264,
  packageSizeM2: 2.16,
})

const BASE: OrderConfirmationInput = {
  quoteCode: 'TY9008555',
  customerName: 'Örnek Müşteri',
  customerCompany: 'Örnek Yapı',
  cityName: 'İzmir',
  deliveryAddress: 'Bornova',
  productLabel: 'Bonus F 120 Taşyünü 8 cm',
  areaM2: 1045.44,
  totalPrice: 881699.75,
  priceWithoutVat: 734749.79,
  vatAmount: 146949.96,
  vehicleCapacity: CAPACITY,
  issuedAt: new Date('2026-10-13T09:00:00+03:00'),
}

const text = (input: OrderConfirmationInput) =>
  buildOrderConfirmationHtml(buildOrderConfirmationModel(input))
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')

describe('araç kapasitesi', () => {
  it('paket adedi × paket m² ile hesaplanır', () => {
    expect(CAPACITY).toEqual({ truckM2: 1045.44, lorryM2: 570.24 })
  })

  it('paket m² yoksa kapasite yoktur', () => {
    expect(capacityFromQuote({ truckCapacityPackages: 484, packageSizeM2: null })).toBeNull()
    expect(capacityFromQuote({})).toBeNull()
  })
})

describe('AC-303: "1. araç" hesabı', () => {
  it('tek araçlı siparişte gösterilmez', () => {
    expect(computeFirstVehicle(1045.44, 881699.75, CAPACITY)).toBeNull()
  })

  it('üç TIR\'lık siparişte ilk araç toplamın üçte biridir', () => {
    const first = computeFirstVehicle(1045.44 * 3, 2645099.25, CAPACITY)
    expect(first).toEqual({
      label: 'TIR',
      areaM2: 1045.44,
      amount: 881699.75,
      vehicleCount: 3,
      planLabel: '3 TIR',
    })
  })

  it('TIR + kamyon siparişinde ilk araç TIR\'dır ve tutar metraj oranıyla ayrılır', () => {
    const area = 1045.44 + 570.24
    const total = 1_000_000
    const first = computeFirstVehicle(area, total, CAPACITY)
    expect(first?.label).toBe('TIR')
    expect(first?.planLabel).toBe('1 TIR + 1 kamyon')
    expect(first?.amount).toBeCloseTo((total * 1045.44) / area, 2)
  })

  it('yalnız kamyonlu siparişte ilk araç kamyondur', () => {
    const first = computeFirstVehicle(570.24 * 2, 500_000, { truckM2: null, lorryM2: 570.24 })
    expect(first).toMatchObject({ label: 'kamyon', areaM2: 570.24, amount: 250_000, vehicleCount: 2 })
  })

  it('metraj araca tam oturmuyorsa gösterilmez', () => {
    expect(computeFirstVehicle(2500, 2_000_000, CAPACITY)).toBeNull()
  })

  it('kapasite yoksa gösterilmez', () => {
    expect(computeFirstVehicle(3000, 2_000_000, null)).toBeNull()
  })

  it('belgede çok araçlı siparişte toplamla birlikte basılır', () => {
    const body = text({ ...BASE, areaM2: 1045.44 * 3, totalPrice: 2645099.25, priceWithoutVat: null, vatAmount: null })
    // Editör bulgusu (13 Ekim 2026): imzanın neyi kesinleştirdiği açık olmalı.
    // Tablo planın tamamını, kutu bu formla onaylanan aracı gösterir.
    expect(body).toContain('Bu formla onaylanan: 1. araç (TIR, 1.045,44 m²) · 881.699,75 ₺ KDV dahil')
    expect(body).toContain('Plan toplamı, 3 TIR (KDV dahil) 2.645.099,25 ₺')
    expect(body).not.toContain('Genel toplam')
    expect(body).toContain('Kalan araçlar için ayrı onay formu düzenlenir')
    expect(body).toContain('her aracın tutarı kendi onayında ödenir')
    expect(body).toContain('1. aracı onaylarsınız; o aracın tutarı tek seferde alınır.')
    expect(body).toContain('Onaylanan aracın tutarı sipariş onayında tek seferde alınır.')
  })

  it('belgede tek araçlı siparişte basılmaz', () => {
    const single = text(BASE)
    expect(single).not.toContain('1. araç')
    expect(single).toContain('Genel toplam (KDV dahil) 881.699,75 ₺')
    expect(single).toContain('Bu formu onaylarsınız; ödeme tek seferde alınır.')
  })
})

describe('AC-302: belge içeriği', () => {
  const body = text(BASE)

  it('teklif numarası, ürün, metraj ve tutarı taşır', () => {
    expect(body).toContain('Teklif No: TY9008555')
    expect(body).toContain('Bonus F 120 Taşyünü 8 cm')
    expect(body).toContain('1.045,44 m²')
    expect(body).toContain('881.699,75 ₺')
    expect(body).toContain('734.749,79 ₺')
  })

  it('satıcı unvanını hem başlıkta hem hesap sahibi satırında gösterir', () => {
    const legalName = BUSINESS_INFO.legalName.toLocaleUpperCase('tr-TR')
    expect(body.split(legalName).length - 1).toBe(2)
    expect(body).toContain(`Hesap sahibi ${legalName}`)
    expect(body).toContain('TR22 0020 5000 0947 0027 8000 01')
    expect(body).toContain('Havale yaparken alıcı unvanının ve IBAN&#039;ın yukarıdakilerle aynı olduğunu kontrol edin.')
  })

  it('teklif sitesi ile kurumsal siteyi ayrı etiketle basar', () => {
    expect(body).toContain('Teklif: www.tasyunufiyatlari.com')
    expect(body).toContain('Kurumsal: www.ozeryapiinsaat.com')
  })

  it('üretici bayi teyidini ve sipariş teyidi satırını taşır', () => {
    expect(body).toContain('ÖzerGrup, Filli Boya ve Bonus yetkili bayisidir.')
    // Gün ya da saat taahhüdü yok (editör bulgusu, 13 Ekim 2026).
    expect(body).toContain('Ödemeniz ulaştığında siparişiniz üreticiye girilir.')
    expect(body).not.toMatch(/iş günü|aynı gün/u)
    expect(body).toContain('Üreticinin sipariş teyidi size iletilir.')
  })

  it('siparişten teslime beş aşamayı sırayla gösterir', () => {
    // Yalnız aşama bölümüne bakılır; "Teslim yeri" satırı sipariş tablosundadır.
    const stages = body.slice(body.indexOf('SİPARİŞTEN TESLİME') + 'SİPARİŞTEN TESLİME'.length)
    const order = ['Sipariş onayı', 'Üretici siparişi', 'Sevkiyat planı', 'Yükleme', 'Teslim'].map((title) =>
      stages.indexOf(title),
    )
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('bölüm başlıklarını Türkçe büyük harfle basar', () => {
    for (const title of ['SİPARİŞ', 'SATICI VE ÖDEME ALICISI', 'ÜRETİCİ TEYİDİ', 'SİPARİŞTEN TESLİME', 'MÜŞTERİ ONAYI']) {
      expect(body).toContain(title)
    }
    expect(buildOrderConfirmationHtml(buildOrderConfirmationModel(BASE))).not.toContain('text-transform')
  })

  it('vergi, MERSİS ve referans boşken satır basmaz', () => {
    expect(body).not.toMatch(/Vergi|MERSİS|REFERANS/u)
  })

  it('referans verilince basar', () => {
    const withReference = text({
      ...BASE,
      reference: { name: 'Örnek Referans', detail: 'Osmancık, 4 TIR alçı', phone: '0 500 000 00 00' },
    })
    expect(withReference).toContain('Örnek Referans · Osmancık, 4 TIR alçı · 0 500 000 00 00')
  })
})

describe('AC-304: görüşme noktası satırı', () => {
  it('İstanbul teslimde vardır', () => {
    expect(text({ ...BASE, cityName: 'İstanbul' })).toContain(
      'Tuzla görüşme noktasında yüz yüze kesinleştirebilirsiniz',
    )
  })

  it('başka ilde yoktur', () => {
    expect(text(BASE)).not.toContain('görüşme noktası')
  })
})

describe('AC-305 / AC-306: belgede olmaması gerekenler', () => {
  const bodies = [text(BASE), text({ ...BASE, cityName: 'İstanbul', areaM2: 1045.44 * 3, totalPrice: 2645099.25 })]

  it.each([
    ['kesin teslim ya da yanıt süresi', /\b\d+\s*(?:dk|dakika|saat|iş\s*günü|gün)\b/iu],
    ['iade ya da garanti vaadi', /\b(?:iade|garanti)\b/iu],
    ['kapora, peşinat ya da taksit', /\b(?:kapora|peşinat|taksit)\b/iu],
    ['koşulsuz ücretsiz nakliye', /ücretsiz\s+nakliye/iu],
    ['anlık stok vaadi', /\b(?:stokta|anlık\s+stok)\b/iu],
    ['iç alanlar', /\b(?:marj|maliyet|iskonto|kâr|komisyon|tedarikçi)\b/iu],
  ])('%s yok', (_label, pattern) => {
    for (const body of bodies) expect(body).not.toMatch(pattern)
  })
})

describe('dosya adı', () => {
  it('teklif numarasını taşır', () => {
    expect(orderConfirmationFileName('TY9008555')).toBe('TY-Siparis-Onay_TY9008555.pdf')
    expect(orderConfirmationFileName('')).toBe('TY-Siparis-Onay_teklif.pdf')
  })
})

describe('ofis teklif kaydından belge girdisi', () => {
  // quotes_dump.json içindeki TY9008555 kaydının alanları.
  const record = {
    id: 210,
    quote_code: 'TY9008555',
    customer_name: ' Örnek Müşteri ',
    customer_company: 'Örnek Yapı',
    customer_address: 'Bornova',
    city_name: 'İzmir',
    material_type: 'tasyunu',
    brand_name: 'Bonus',
    model_name: 'F 120',
    package_name: 'Dengeli Sistem',
    thickness_cm: 8,
    area_m2: 1045.44,
    total_price: 881699.75,
    price_without_vat: 734749.79,
    vat_amount: 146949.96,
    truck_capacity_packages: 484,
    lorry_capacity_packages: 264,
    package_size_m2: 2.16,
  }

  it('ürün adını marka, model, malzeme ve kalınlıkla kurar', () => {
    expect(productLabelFromQuote(record)).toBe('Bonus F 120 Taşyünü 8 cm')
  })

  it('model markayı zaten içeriyorsa markayı tekrar etmez', () => {
    expect(
      productLabelFromQuote({ brand_name: 'Optimix', model_name: 'Optimix Karbonlu', material_type: 'eps', thickness_cm: 5 }),
    ).toBe('Optimix Karbonlu EPS 5 cm')
  })

  it('marka ve model yoksa paket adına düşer', () => {
    expect(productLabelFromQuote({ package_name: 'Dengeli Sistem', material_type: 'tasyunu', thickness_cm: 7.5 })).toBe(
      'Dengeli Sistem Taşyünü 7,5 cm',
    )
  })

  it('kayıt alanlarını belge girdisine çevirir', () => {
    const input = orderInputFromQuote(record, new Date('2026-10-13T09:00:00+03:00'))
    expect(input).toMatchObject({
      quoteCode: 'TY9008555',
      customerName: 'Örnek Müşteri',
      customerCompany: 'Örnek Yapı',
      cityName: 'İzmir',
      deliveryAddress: 'Bornova',
      productLabel: 'Bonus F 120 Taşyünü 8 cm',
      areaM2: 1045.44,
      totalPrice: 881699.75,
      vehicleCapacity: { truckM2: 1045.44, lorryM2: 570.24 },
    })
  })

  it('araç alanları boş olan ofis teklifinde kapasite yoktur', () => {
    const input = orderInputFromQuote({ ...record, truck_capacity_packages: null, lorry_capacity_packages: null, package_size_m2: null })
    expect(input.vehicleCapacity).toBeNull()
  })

  it('teklif numarası yoksa kayıt kimliğini kullanır', () => {
    expect(orderInputFromQuote({ ...record, quote_code: null }).quoteCode).toBe('#210')
  })
})

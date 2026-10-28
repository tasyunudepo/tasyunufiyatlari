import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import QRCode from 'qrcode'
import { describe, expect, it } from 'vitest'

import { BUSINESS_INFO } from '@/lib/business/info'
import { buildOrderConfirmationModel } from '@/lib/pdf/orderConfirmation'
import { ORDER_PROCESS_TEXT, SELLER_BANK_ACCOUNTS } from '@/lib/pdf/orderProcess'
import {
  SHIPPING_LINE_DESCRIPTION,
  buildQrOrderLink,
  buildQuoteDocument,
  formatPhoneForDisplay,
} from '@/lib/pdf/quoteDocument'
import { QUOTE_DOCUMENT_CSS } from '@/lib/pdf/quoteDocumentStyles'
import { buildManualPdfData } from '@/lib/quote/buildManualPdfData'
import { resolvePlateIdentity } from '@/lib/quote/plateIdentity'
import type { PDFQuoteData, PDFQuoteItem } from '@/lib/pdfGenerator'

// Teklif PDF'inin şablonu (13 Ekim 2026, yuvarlak masa kararı):
// reports/teklif-formu-cro-2026-10-13/pdf-yuvarlak-masasi.md
//
// Emrah'ın kararları: dört rakam üstte eşit ağırlıkta (24 Temmuz'daki
// "Toplam Metraj büyük" kararının yerine geçer), üst bölüm alçı teklifinden
// uyarlanır, önce döküm sonra diğer bilgiler, geçerlilik 3 gün, hazırlayan
// Emrah Gümüşsoy. Astra ile ortak karar: geçerlilik günle yazılır.

const plate: PDFQuoteItem = {
  description: 'Optimix Karbonlu EPS 9 cm',
  quantity: 1040,
  unit: 'm²',
  consumptionRate: 1,
  consumptionUnit: 'm²/m²',
  unitPrice: 294.31,
  totalPrice: 306082.4,
  isPlate: true,
}

const accessory = (description: string, quantity: number, unit: string, unitPrice: number, rate: number, rateUnit: PDFQuoteItem['consumptionUnit']): PDFQuoteItem => ({
  description,
  quantity,
  unit,
  consumptionRate: rate,
  consumptionUnit: rateUnit,
  unitPrice,
  totalPrice: Math.round(quantity * unitPrice * 100) / 100,
  isPlate: false,
})

// Yuvarlak masadaki örnek teklif: 1.040 m², 565.052,50 ₺.
const setQuote: PDFQuoteData = {
  packageName: 'Dengeli Sistem',
  packageDescription: '',
  plateBrandName: 'Fawori Optimix',
  accessoryBrandName: 'Fawori Optimix',
  metraj: 1040,
  thickness: '9',
  materialType: 'eps',
  materialLongName: 'Karbonlu EPS',
  cityName: 'İstanbul',
  grandTotal: 565052.5,
  pricePerM2: 452.77,
  totalProductCost: 470877.08,
  shippingCost: 0,
  priceWithoutVat: 470877.08,
  vatAmount: 94175.42,
  refCode: 'TE-2026-000238',
  validityDate: '16.10.2026',
  whatsappOrderLink: 'https://wa.me/905435186988?text=Merhaba',
  customerCompany: '',
  relatedPerson: 'Burak Varol',
  deliveryAddress: '',
  phone: '05553631803',
  email: '',
  systemDescription: 'Fawori Optimix EPS 9cm + Fawori Optimix Toz Grubu',
  shippingMode: 'included_in_sale_price',
  items: [
    plate,
    accessory('Fawori Optimix Isı Yalıtım Yapıştırma Harcı 25 kg', 167, 'torba', 180.65, 4, 'kg/m²'),
    accessory('Fawori Optimix Isı Yalıtım Sıva Harcı 25 kg', 167, 'torba', 199.99, 4, 'kg/m²'),
    accessory('Fawori Optimix Plastik Dübel 13,5 cm 600 adet', 11, 'kutu', 1635.05, 6, 'adet/m²'),
    accessory('Fawori Optimix Donatı Filesi F160 50 m²', 23, 'rulo', 1350.24, 1.1, 'm²/m²'),
    accessory('Fawori Optimix Fileli Köşe (PVC) 2,5 m 50 adet 125 m', 5, 'paket', 2329.51, 0.5, 'mt/m²'),
    accessory('Fawori Optimix Kaplama Astarı 25 kg', 9, 'kova', 1213.1, 0.2, 'kg/m²'),
    accessory('Fawori Optimix Mineral Kaplama İnce Tane 25 kg', 104, 'torba', 284.82, 2.5, 'kg/m²'),
  ],
}

const options = { qrDataUrl: 'data:image/png;base64,QR', issuedAt: new Date('2026-10-13T16:18:00+03:00') }

const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gu, '').replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim()
const kinds = (flow: string[]) => flow.map((html) => html.match(/data-kind="([^"]+)"/u)?.[1])
const blockOf = (flow: string[], kind: string) => flow.find((html) => html.includes(`data-kind="${kind}"`)) ?? ''
const whole = (data: PDFQuoteData) => {
  const parts = buildQuoteDocument(data, options)
  return [parts.header, parts.context, ...parts.flow, parts.footer].join('\n')
}

describe('teklif PDF\'i: dört rakam üstte eşit ağırlıkta', () => {
  const parts = buildQuoteDocument(setQuote, options)
  const hero = blockOf(parts.flow, 'hero')

  it('dört rakam bu sırayla ve yalnız dört tanedir', () => {
    const labels = [...hero.matchAll(/<div class="tq-metric"><span>([^<]+)<\/span>/gu)].map((m) => m[1])
    expect(labels).toEqual(['TOPLAM FİYAT', 'TOPLAM METRAJ', 'm² FİYATI · KDV DAHİL', 'm² FİYATI · KDV HARİÇ'])
    expect(hero.match(/class="tq-metric-value"/gu)?.length).toBe(4)
  })

  it('değerler örnek teklifle aynıdır', () => {
    const values = [...hero.matchAll(/class="tq-metric-value">([^<]+)</gu)].map((m) => m[1])
    expect(values).toEqual(['565.052,50 ₺', '1.040 m²', '543,32 ₺', '452,77 ₺'])
  })

  it('dört rakamın tek bir yazı boyutu vardır', () => {
    const sizes = [...QUOTE_DOCUMENT_CSS.matchAll(/\.tq-metric-value\{font-size:(\d+)px/gu)].map((m) => m[1])
    expect(sizes).toEqual(['23'])
  })

  // Ekran ↔ PDF fiyat tabanı (karar: 23 Temmuz 2026): müşteri sihirbazdaki
  // paket kartında KDV dahil m² fiyatı görür; PDF'teki KDV dahil değer aynı
  // tabandan gelir (KDV hariç taban × 1,2).
  it('KDV dahil m² fiyatı ekran kartıyla aynı tabandan hesaplanır', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/pdf/quoteDocument.ts'), 'utf8')
    expect(source).toContain('const calculatedM2Price = resolveNetM2Price(data, metrajValue)')
    expect(source).toMatch(/KDV DAHİL<\/span><b class="tq-metric-value">\$\{m2Value\(calculatedM2Price \* 1\.2\)\}/u)
    expect(source).toMatch(/KDV HARİÇ<\/span><b class="tq-metric-value">\$\{m2Value\(calculatedM2Price\)\}/u)
  })

  it('m² fiyatı hesaplanamıyorsa sıfır değil çizgi basılır', () => {
    const noArea = buildQuoteDocument({ ...setQuote, metraj: 0, pricePerM2: 0, items: [{ ...plate, isPlate: false }, setQuote.items[1]] }, options)
    const values = [...blockOf(noArea.flow, 'hero').matchAll(/class="tq-metric-value">([^<]+)</gu)].map((m) => m[1])
    expect(values.slice(2)).toEqual(['—', '—'])
  })
})

describe('teklif PDF\'i: önce döküm, sonra diğer bilgiler', () => {
  it('komple sette bloklar kabul edilen sırayla akar', () => {
    expect(kinds(buildQuoteDocument(setQuote, options).flow)).toEqual([
      'intro', 'hero', 'info', 'table', 'total', 'action', 'process', 'payment', 'trust', 'cross', 'contact',
    ])
  })

  // 27 Ekim 2026: tek kalemli teklifte tablonun altında ara toplam, KDV ve
  // genel toplam yoktu; müşteriye giden belge "eksik" diye geri döndü (Emrah).
  it('tek kalemli teklifte de tablonun altında ara toplam, KDV ve genel toplam yazar', () => {
    const single = buildQuoteDocument({
      ...setQuote,
      accessoryBrandName: '-',
      items: [plate],
      priceWithoutVat: 306082.4,
      vatAmount: 61216.48,
      grandTotal: 367298.88,
    }, options)
    expect(single.single).toBe(true)
    expect(kinds(single.flow)).toEqual(['intro', 'hero', 'info', 'table', 'total', 'action', 'process', 'payment', 'trust', 'cross', 'contact'])
    expect(text(blockOf(single.flow, 'intro'))).toContain('LEVHA FİYAT TEKLİFİ')
    const total = text(blockOf(single.flow, 'total'))
    expect(total).toContain('Levha tedariki.')
    expect(total).toContain('Ara toplam · KDV hariç 306.082,40 ₺')
    expect(total).toContain('KDV (%20) 61.216,48 ₺')
    expect(total).toContain('Genel toplam · KDV dahil 367.298,88 ₺')
  })

  it('ofisten yazılan serbest kalem listesi "komple set" diye adlandırılmaz', () => {
    const list = buildQuoteDocument({ ...setQuote, accessoryBrandName: '', items: setQuote.items.slice(0, 3) }, options)
    expect(text(blockOf(list.flow, 'intro'))).toContain('FİYAT TEKLİFİ')
    expect(text(blockOf(list.flow, 'intro'))).not.toContain('MANTOLAMA SETİ')
    expect(text(blockOf(list.flow, 'hero'))).toContain('3 kalem MALZEME')
    expect(text(blockOf(list.flow, 'total'))).toContain('3 kalem malzeme tedariki.')
  })
})

describe('teklif PDF\'i: kapsam ve nakliye', () => {
  const totalText = (data: PDFQuoteData) => text(blockOf(buildQuoteDocument(data, options).flow, 'total'))
  const heroText = (data: PDFQuoteData) => text(blockOf(buildQuoteDocument(data, options).flow, 'hero'))

  it('nakliye dahilken kapsam cümlesi teslim ilini ve işçiliği açıkça yazar', () => {
    expect(totalText(setQuote)).toContain(
      '8 kalem komple mantolama seti. Bu teklifin İstanbul teslimine nakliye dahildir. Şantiyede indirme alıcıya aittir. Uygulama işçiliği dahil değildir.',
    )
    expect(heroText(setQuote)).toContain('KDV ve nakliye dahil')
    expect(heroText(setQuote)).toContain('Fiyata dahil NAKLİYE')
    expect(heroText(setQuote)).toContain('Dahil değil UYGULAMA İŞÇİLİĞİ')
  })

  it('nakliye alıcıya aitken toplam "nakliye dahil" demez', () => {
    const buyer = { ...setQuote, shippingMode: 'buyer_pays' as const }
    expect(totalText(buyer)).toContain('Nakliye alıcıya aittir; teklif toplamına dahil değildir.')
    expect(heroText(buyer)).toContain('Alıcıya ait NAKLİYE')
    // Çok kalemde m² fiyatı bütün kalemlerin karşılığıdır (standart, E2).
    expect(heroText(buyer)).toContain('Tüm kalemler · nakliye hariç')
    expect(heroText(buyer)).not.toContain('KDV ve nakliye dahil')
  })

  it('nakliye görüşmede netleşecekse öyle yazılır', () => {
    const separate = { ...setQuote, shippingMode: 'separate_quote_required' as const }
    expect(totalText(separate)).toContain('Nakliye satış görüşmesinde netleşir; teklif toplamına dahil değildir.')
    expect(heroText(separate)).toContain('Görüşmede netleşir NAKLİYE')
  })

  // Ofis teklifinde nakliye ayrı kalem yazılınca tutar toplamın içindedir;
  // "alıcıya ait, toplama dahil değil" demek belgede yanlış beyan olur.
  it('nakliye ayrı kalem yazıldıysa toplamın içinde sayılır', () => {
    const withLine: PDFQuoteData = {
      ...setQuote,
      accessoryBrandName: '',
      shippingMode: 'buyer_pays',
      items: [...setQuote.items.slice(0, 2), { description: SHIPPING_LINE_DESCRIPTION, quantity: 1, unit: 'kalem', consumptionRate: 0, unitPrice: 18000, totalPrice: 18000, isPlate: false }],
    }
    expect(totalText(withLine)).toContain('Nakliye ayrı kalem olarak teklif toplamına dahildir.')
    // Görünen ad teslim ilini söyler; veri anahtarı "Nakliye" olarak kalır.
    expect(text(blockOf(buildQuoteDocument(withLine, options).flow, 'table'))).toContain('3 Nakliye · İstanbul teslim 1 kalem')
    expect(totalText(withLine)).not.toContain('teklif toplamına dahil değildir')
    expect(heroText(withLine)).toContain('Ayrı kalem NAKLİYE')
    expect(heroText(withLine)).toContain('KDV ve nakliye dahil')
    // Nakliye satırı malzeme kalemi sayılmaz: iki malzeme + nakliye = 2 kalem.
    expect(heroText(withLine)).toContain('2 kalem MALZEME')
    expect(totalText(withLine)).toContain('2 kalem malzeme tedariki.')
  })

  it('firma varsa ilgili kişi ve telefon ayrı satırdadır; telefon okunur biçimdedir', () => {
    const company = blockOf(buildQuoteDocument({ ...setQuote, customerCompany: 'Varol Yapı Ltd. Şti.' }, options).flow, 'info')
    expect(company).toContain('<b>Varol Yapı Ltd. Şti.</b><small>Burak Varol</small><small class="tq-nowrap">0555 363 18 03</small>')
    const person = blockOf(buildQuoteDocument(setQuote, options).flow, 'info')
    expect(person).toContain('<b>Burak Varol</b><small class="tq-nowrap">0555 363 18 03</small>')
  })

  it('döküm sonraki sayfaya taşarsa devam başlığı teklif numarasını taşır', () => {
    const parts = buildQuoteDocument(setQuote, options)
    expect(text(parts.continuationTitle)).toBe('MALZEME DÖKÜMÜ · DEVAM · TE-2026-000238')
    expect(text(parts.context)).toContain('Burak Varol · TE-2026-000238 · 1.040 m² · İstanbul')
    expect(text(parts.context)).toContain('Genel toplam: 565.052,50 ₺ · KDV dahil')
  })

  it('nakliye uyarısı ve büyük metraj notu varsa basılır, yoksa kutu çıkmaz', () => {
    expect(kinds(buildQuoteDocument(setQuote, options).flow)).not.toContain('notice')
    const noted = buildQuoteDocument({ ...setQuote, shippingWarning: 'Araç yarım dolu.', specialOrderNote: 'Fabrika teyidi gerekir.' }, options)
    expect(kinds(noted.flow)).toContain('notice')
    expect(text(blockOf(noted.flow, 'notice'))).toContain('Araç yarım dolu.')
    expect(text(blockOf(noted.flow, 'notice'))).toContain('Büyük metraj, özel teklif: Fabrika teyidi gerekir.')
  })

  it('ofis teklif notu belgede basılır; satır sonları korunur', () => {
    const noted = buildQuoteDocument({ ...setQuote, quoteNote: 'Ekim kampanyası.\n4 Kasım 2026 Çarşamba gününe kadar geçerlidir.' }, options)
    const notice = blockOf(noted.flow, 'notice')
    expect(notice).toContain('Ekim kampanyası.<br>4 Kasım 2026 Çarşamba gününe kadar geçerlidir.')
    expect(kinds(buildQuoteDocument({ ...setQuote, quoteNote: '   ' }, options).flow)).not.toContain('notice')
  })

  it('ofis ekranındaki teklif notu PDF verisine taşınır', () => {
    const pdf = buildManualPdfData({
      quoteCode: 'TE-2026-000999',
      customerName: 'Deneme',
      customerPhone: '05550000000',
      cityName: 'Kocaeli',
      notes: 'Siparişe nakliye dahildir.',
      materialType: 'tasyunu',
      areaM2: 100,
      validityDays: 7,
      lines: [{ description: 'Bonus Gold Plus 70 5 cm', quantity: 100, unit: 'm²', unitPrice: 168.05, isPlate: true }],
      discountPct: 0,
      shippingCharge: 0,
      totals: { linesNet: 16805, discountAmount: 0, priceWithoutVat: 16805, vatAmount: 3361, totalPrice: 20166 },
    })
    expect(pdf.quoteNote).toBe('Siparişe nakliye dahildir.')
    expect(text(blockOf(buildQuoteDocument(pdf, options).flow, 'notice'))).toContain('Siparişe nakliye dahildir.')
  })
})

describe('teklif PDF\'i: döküm satırları', () => {
  const tableOf = (items: PDFQuoteItem[]) => blockOf(buildQuoteDocument({ ...setQuote, items }, options).flow, 'table')

  it('tam ürün adı, miktar, birim fiyat ve tutar basılır', () => {
    const table = text(tableOf(setQuote.items))
    expect(table).toContain('Fawori Optimix Isı Yalıtım Yapıştırma Harcı 25 kg')
    expect(table).toContain('167 torba 180,65 ₺ 30.168,55 ₺')
    expect(table).toContain('Birim fiyat KDV hariç')
  })

  // Sarfiyat teknik orandır; ambalaj adedi metraja bölünerek uydurulmaz.
  it('yardımcı malzemede sarfiyat birimiyle yazılır; levhada yazılmaz', () => {
    const table = text(tableOf(setQuote.items))
    expect(table).toContain('Sarfiyat 4 kg/m²')
    expect(table).toContain('Sarfiyat 0,5 mt/m²')
    expect(table).not.toContain('Sarfiyat 1 m²/m²')
    // Kimliği olmayan eski levha satırı: ad olduğu gibi, tür grubu malzemeden.
    expect(table).toContain('1 Optimix Karbonlu EPS 9 cm EPS levha 1.040 m²')
  })

  // Ofis teklifi (27 Temmuz 2026): negatif kalem "paket içeriği" değildir.
  it('negatif tutarlı satır tutarıyla görünür', () => {
    const discount: PDFQuoteItem = { description: 'Toplu alım iskontosu (%3)', quantity: 1, unit: 'kalem', consumptionRate: 0, unitPrice: -14126.31, totalPrice: -14126.31, isPlate: false }
    const table = text(tableOf([plate, setQuote.items[1], discount]))
    expect(table).toContain('-14.126,31 ₺')
    expect(table).not.toContain('Pakete dahil')
  })

  it('fiyatı sıfır olan aksesuar "pakete dahil" görünür; levhada sıfır fiyat gizlenmez', () => {
    const free = { ...setQuote.items[1], unitPrice: 0, totalPrice: 0 }
    expect(text(tableOf([plate, free]))).toContain('Pakete dahil')
    expect(text(tableOf([{ ...plate, unitPrice: 0, totalPrice: 0 }, setQuote.items[1]]))).toContain('0,00 ₺')
  })

  // Standart A: paket sayısı adın yanında değil, miktar sütununda m²'nin altında.
  it('paket sayısı varsa miktar sütununda yazılır, yoksa "0 paket" yazılmaz', () => {
    expect(tableOf([{ ...plate, packageCount: 224 }, setQuote.items[1]])).toContain('<td>1.040 m²<small>224 paket</small></td>')
    expect(text(tableOf([{ ...plate, packageCount: 224 }, setQuote.items[1]]))).not.toContain('PKT')
    expect(tableOf([{ ...plate, packageCount: 0 }, setQuote.items[1]])).toContain('<td>1.040 m²</td>')
    expect(text(tableOf(setQuote.items))).not.toContain('0 paket')
  })

  it('kural kaynakta değişmeden durur', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/pdf/quoteDocument.ts'), 'utf8')
    expect(source).toContain('it.unitPrice >= 0 && it.unitPrice < 0.01')
    expect(source).not.toMatch(/it\.unitPrice === 0 \|\| it\.unitPrice < 0\.01/u)
    expect(source).toContain('(it.packageCount ?? 0) > 0')
    expect(source).toContain('formatTechnicalConsumption(it.consumptionRate, it.consumptionUnit)')
  })
})

// Teklif PDF standardı (Emrah + Astra + Opus, 27 Ekim 2026):
// docs/standartlar/teklif-pdf-standardi.md
describe('teklif PDF standardı: ürün kimliği (A)', () => {
  const goldPlus = resolvePlateIdentity({
    brandName: 'Bonus', modelShortName: 'Gold Plus 50', materialSlug: 'tasyunu', thicknessCm: 12, packageM2: 2.16, packagePieces: 3,
  })
  const plateItem: PDFQuoteItem = {
    description: 'Bonus Gold Plus 50 12 cm', quantity: 1900, unit: 'm²', consumptionRate: 1, consumptionUnit: 'm²/m²',
    unitPrice: 283.87, totalPrice: 539353, isPlate: true, packageCount: 880, identity: goldPlus,
  }
  const shippingLine: PDFQuoteItem = { description: SHIPPING_LINE_DESCRIPTION, quantity: 1, unit: 'kalem', consumptionRate: 0, unitPrice: 4700, totalPrice: 4700, isPlate: false }
  const doc = (items: PDFQuoteItem[], extra: Partial<PDFQuoteData> = {}) => buildQuoteDocument({
    ...setQuote, accessoryBrandName: '', materialType: 'tasyunu', systemDescription: 'Bonus Gold Plus 50 12 cm', packageName: '', items, ...extra,
  }, options)

  it('levha satırı ad, tür ve özellik gruplarıyla yazılır; paket sayısı miktar sütunundadır', () => {
    expect(text(blockOf(doc([plateItem]).flow, 'table'))).toContain(
      '1 Bonus Gold Plus 50 · 12 cm Taşyünü levha · Giydirme cephe '
      + 'Yoğunluk 50 kg/m³ (föy beyanı) · Levha 60 × 120 cm · Pakette 3 levha = 2,16 m² · 880 paket = 1.900,80 m² '
      + '1.900 m² 880 paket 283,87 ₺ 539.353,00 ₺',
    )
  })

  it('ürün kartı standart adı ve kapsamı yazar; iç adlar basılmaz', () => {
    const single = text(blockOf(doc([plateItem], { packageName: 'Ofis Teklifi' }).flow, 'info'))
    expect(single).toContain('ÜRÜN Bonus Gold Plus 50 · 12 cm Taşyünü levha ARA TOPLAM')
    expect(single).not.toContain('Ofis Teklifi')
    // Nakliye kalem sayısına girmez.
    expect(text(blockOf(doc([plateItem, ...setQuote.items.slice(1, 3), shippingLine]).flow, 'info'))).toContain('Taşyünü levha + 2 yardımcı malzeme')
    expect(text(blockOf(doc(setQuote.items.slice(1, 3)).flow, 'info'))).toContain('2 kalem malzeme')
  })

  it('levhası ve başlığı olmayan listede ürün kartı "Taşyünü cm" yazmaz', () => {
    const info = text(blockOf(doc(setQuote.items.slice(1, 3), { systemDescription: undefined, thickness: '' }).flow, 'info'))
    expect(info).toContain('ÜRÜN Malzeme tedariki 2 kalem malzeme')
    expect(info).not.toContain(' cm')
  })

  it('kimliği olmayan levhada tür grubu kayıtlı malzemeden gelir', () => {
    const legacy = { ...plateItem, identity: null }
    expect(text(blockOf(doc([legacy], { materialType: 'eps' }).flow, 'table'))).toContain('1 Bonus Gold Plus 50 12 cm EPS levha 1.900 m² 880 paket')
    expect(text(blockOf(doc([legacy], { materialType: 'eps' }).flow, 'info'))).toContain('EPS levha')
  })

  it('satış birimi kodu Türkçe kelimeyle yazılır; kayıtta olmayan birim üretilmez', () => {
    const table = text(blockOf(doc([plateItem, { ...setQuote.items[1], unit: 'PKT' }, { ...setQuote.items[3], unit: 'KUTU' }]).flow, 'table'))
    expect(table).toContain('167 paket')
    expect(table).toContain('11 kutu')
    expect(table).not.toContain('PKT')
    expect(table).not.toContain('torba')
  })
})

describe('teklif PDF standardı: boşluk ve sayfa (B)', () => {
  const source = readFileSync(resolve(process.cwd(), 'lib/pdf/quoteDocument.ts'), 'utf8')

  it('gövde 400, vurgu 600; 700 kullanılmaz', () => {
    expect(QUOTE_DOCUMENT_CSS).not.toContain('font-weight:700')
    expect(QUOTE_DOCUMENT_CSS).toContain('.tq .tq-metric-value{font-size:23px;line-height:1.15;font-weight:600')
  })

  it('aralık tek yerden: grup içi 12 px, gruplar arası 24 px', () => {
    expect(QUOTE_DOCUMENT_CSS).toContain('.tq-content{flex:1;min-height:0;display:flex;flex-direction:column}')
    expect(QUOTE_DOCUMENT_CSS).toContain('.tq-content>*+*{margin-top:12px}')
    expect(QUOTE_DOCUMENT_CSS).toContain('.tq-content>.tq-table,.tq-content>.tq-action,.tq-content>.tq-process,.tq-content>.tq-cross,.tq-content>.tq-contact{margin-top:24px}')
    expect(QUOTE_DOCUMENT_CSS).toContain('.tq-content>*:first-child{margin-top:0}')
  })

  it('sayfa kenarı 40/32/28 px; tablo hücresi 9 × 10 px; sütunlar 52/14/16/18; zebra yok', () => {
    expect(QUOTE_DOCUMENT_CSS).toContain('padding:32px 40px 28px')
    expect(QUOTE_DOCUMENT_CSS).toContain('.tq td{padding:9px 10px;')
    expect(QUOTE_DOCUMENT_CSS).toContain('color:#fff;padding:9px 10px;')
    for (const width of ['width:52%', 'width:14%', 'width:16%', 'width:18%']) expect(QUOTE_DOCUMENT_CSS).toContain(width)
    expect(QUOTE_DOCUMENT_CSS).not.toContain('nth-child(even)')
  })

  it('tek kalemli teklif için ayrı düzen ya da gizlenen içerik yoktur', () => {
    expect(QUOTE_DOCUMENT_CSS).not.toContain('tq-single')
    expect(source).toContain('const flow = [intro, hero, info, table, totals, ...notice, action, process, payment, trust, cross, contactLine]')
    expect(source).not.toMatch(/!single &&|single \? ''/u)
  })

  it('tablonun son satırı ile toplam bloğu birlikte yerleşir', () => {
    const pagination = readFileSync(resolve(process.cwd(), 'lib/pdf/quotePagination.ts'), 'utf8')
    expect(pagination).toContain('carry(body.lastElementChild as HTMLElement)\n    add(total)')
    expect(pagination).not.toContain('else newPage()')
  })
})

describe('teklif PDF\'i: eylem, hazırlayan, geçerlilik', () => {
  const parts = buildQuoteDocument(setQuote, options)
  const action = blockOf(parts.flow, 'action')

  it('tek metinli sipariş çağrısı ve telefon bağlantılıdır', () => {
    expect(text(action)).toContain('Sipariş için WhatsApp’tan yazın')
    expect(text(action)).toContain(`Veya arayın: ${BUSINESS_INFO.phone.display}`)
    expect(action).toContain('class="tq-cta" data-pdf-link="https://wa.me/905435186988?text=Merhaba"')
    expect(action).toContain(`data-pdf-link="tel:${BUSINESS_INFO.phone.tel}"`)
    expect(action).toContain('data-pdf-qr')
  })

  // Gerçek tekliflerde düğmenin mesajı ürün, metraj ve fiyat satırlarıyla
  // uzundur (13 Ekim 2026 ölçümü: 468 karakter); karekoda konunca kod
  // sıklaşır ve kâğıttan okunmaz. Karekod aynı hatta, aynı teklif
  // numarasıyla kısa mesajı taşır.
  it('karekod aynı hat ve aynı teklif numarasıyla kısa bağlantıyı taşır', () => {
    const link = buildQrOrderLink('TE-2026-000238')
    expect(link.startsWith('https://wa.me/905435186988?text=')).toBe(true)
    expect(decodeURIComponent(link)).toContain('TE-2026-000238 numaralı teklif için siparişe geçmek istiyorum.')
    expect(action).toContain(`class="tq-qr" data-pdf-link="${link}"`)
  })

  it('karekod kâğıttan okunacak kadar seyrektir', () => {
    // 88 px (23,3 mm) kutuda, 2 modül kenar boşluğuyla modül ≥ 0,40 mm olmalı.
    const longRef = buildQrOrderLink('TE-2026-000238-R12')
    const modules = QRCode.create(longRef, { errorCorrectionLevel: 'M' }).modules.size
    expect(23.3 / (modules + 4)).toBeGreaterThanOrEqual(0.4)
  })

  it('teklifi hazırlayan adı ve telefonuyla yazılır', () => {
    expect(text(action)).toContain('Teklifi hazırlayan: Emrah Gümüşsoy · 0 543 518 69 88')
  })

  it('geçerlilik günle yazılır; belgede saat yoktur', () => {
    expect(text(action)).toContain('Fiyatlar 16.10.2026 günü sonuna kadar geçerlidir. Süre dolduktan sonra güncel fiyat teyit edilir.')
    expect(text(blockOf(parts.flow, 'intro'))).toContain('Düzenlenme: 13.10.2026')
    expect(text(blockOf(parts.flow, 'intro'))).toContain('GEÇERLİLİK 16.10.2026')
    expect(text(whole(setQuote))).not.toMatch(/\b\d{2}:\d{2}\b/u)
  })

  it('geçerlilik tarihi yoksa boş etiket basılmaz', () => {
    const none = buildQuoteDocument({ ...setQuote, validityDate: undefined }, options)
    expect(text(none.flow.join(' '))).not.toContain('GEÇERLİLİK')
    expect(text(none.flow.join(' '))).not.toContain('günü sonuna kadar')
  })
})

describe('teklif PDF\'i: süreç, ödeme ve bayilik', () => {
  const parts = buildQuoteDocument(setQuote, options)

  it('dört adım sırayla yazılır', () => {
    const process = text(blockOf(parts.flow, 'process'))
    const order = ['1. Onay ve ödeme', '2. Üretici teyidi', '3. Sevkiyat planı', '4. Teslim'].map((step) => process.indexOf(step))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('süreç ve ödeme cümleleri Sipariş Onay Formu ile aynı kaynaktandır', () => {
    const quote = text(parts.flow.join(' '))
    expect(quote).toContain(ORDER_PROCESS_TEXT.manufacturerOrder)
    expect(quote).toContain(ORDER_PROCESS_TEXT.shippingPlan)
    expect(quote).toContain(ORDER_PROCESS_TEXT.paymentRule)
    expect(quote).toContain('Havale yaparken alıcı unvanının ve IBAN')

    const form = buildOrderConfirmationModel({
      quoteCode: 'TY1',
      customerName: 'Örnek Müşteri',
      customerCompany: '',
      cityName: 'Ankara',
      deliveryAddress: '',
      productLabel: 'Optimix Karbonlu EPS 9 cm',
      areaM2: 1040,
      totalPrice: 565052.5,
      priceWithoutVat: 470877.08,
      vatAmount: 94175.42,
      vehicleCapacity: null,
      issuedAt: new Date('2026-10-13T10:00:00+03:00'),
    })
    expect(form.accountNote).toBe(ORDER_PROCESS_TEXT.accountCheck)
    expect(form.steps.map((step) => step.detail)).toContain(ORDER_PROCESS_TEXT.manufacturerOrder)
    expect(form.bankRows.map((row) => row.value)).toEqual(SELLER_BANK_ACCOUNTS.map((account) => account.iban))
  })

  it('hesap sahibi unvanı banka satırlarının üstündedir; iki IBAN yazılıdır', () => {
    const payment = text(blockOf(parts.flow, 'payment'))
    const owner = payment.indexOf(`Hesap sahibi: ${BUSINESS_INFO.legalName.toLocaleUpperCase('tr-TR')}`)
    expect(owner).toBeGreaterThan(0)
    for (const account of SELLER_BANK_ACCOUNTS) {
      expect(payment.indexOf(account.iban)).toBeGreaterThan(owner)
    }
    expect(payment).toContain('Kredi kartı veya banka havalesi')
  })

  it('bayilik her sayfanın başında ve kendi bloğunda yazılıdır', () => {
    expect(text(parts.header)).toContain('Filli Boya ve Bonus yetkili bayisi')
    const trust = blockOf(parts.flow, 'trust')
    expect(text(trust)).toContain('Filli Boya ve Bonus yetkili bayisiyiz.')
    expect(text(trust)).toContain(ORDER_PROCESS_TEXT.dealership)
    expect(trust.match(/<img /gu)?.length).toBe(4)
  })

  it('teklif sitesi ile kurumsal site ayrı etiketle basılır', () => {
    const footer = text(parts.footer)
    expect(footer).toContain('Teklif: www.tasyunufiyatlari.com')
    expect(footer).toContain('Kurumsal: www.ozeryapiinsaat.com')
    expect(parts.footer).toContain(`data-pdf-link="${BUSINESS_INFO.url}"`)
    expect(parts.footer).toContain(`data-pdf-link="${BUSINESS_INFO.corporateUrl}"`)
  })
})

describe('teklif PDF\'i: alçı ve alçıpan bölümü', () => {
  const parts = buildQuoteDocument(setQuote, options)
  const cross = blockOf(parts.flow, 'cross')

  it('ana teklifin toplamından ve eyleminden sonra gelir', () => {
    const order = kinds(parts.flow)
    expect(order.indexOf('cross')).toBeGreaterThan(order.indexOf('total'))
    expect(order.indexOf('cross')).toBeGreaterThan(order.indexOf('action'))
    expect(order.indexOf('cross')).toBeGreaterThan(order.indexOf('payment'))
  })

  it('iki kanal fiyatı, yazılı adresi ve kaynağı etiketli bağlantıyla basılır', () => {
    expect(text(cross)).toContain('Alçı ve alçıpan da lazım mı?')
    expect(text(cross)).toContain('1 TIR 129.366 ₺')
    expect(text(cross)).toContain('alcifiyatlari.com/urun-kategori/makina-alcisi')
    // Editör bulgusu (13 Ekim 2026): başlığı "levha" ya da "fiyat" teklifi olan belgede
    // "mantolama teklifi" demek aynı belgeyi iki adla anmak olur.
    expect(text(cross)).toContain('Bu teklifin toplamına dahil değildir.')
    expect(text(cross)).not.toContain('Mantolama teklifinin')
    const links = [...cross.matchAll(/data-pdf-link="([^"]+)"/gu)].map((m) => m[1].replaceAll('&amp;', '&'))
    expect(links).toHaveLength(2)
    for (const link of links) expect(new URL(link).searchParams.get('utm_content')).toBe('pdf')
  })
})

describe('teklif PDF\'i: belgede olmaması gerekenler', () => {
  it('iç alanlar ve çalışma notları yazılmaz', () => {
    const body = text(whole({ ...setQuote, packageDescription: 'iç not' })).toLocaleLowerCase('tr-TR')
    for (const word of ['marj', 'komisyon', 'tedarikçi', 'iskonto oranı', 'taslak', 'todo', 'iç not']) {
      expect(body).not.toContain(word)
    }
  })

  it('müşteri alanları HTML olarak yorumlanmaz', () => {
    const html = whole({ ...setQuote, relatedPerson: '<img src=x onerror=alert(1)>', refCode: 'TY"1' })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('TY&quot;1')
  })

  it('stil kuralları belgenin köküne kapalıdır; site stiline karışmaz', () => {
    const selectors = QUOTE_DOCUMENT_CSS.split('}').map((rule) => rule.split('{')[0].trim()).filter((s) => s && !s.startsWith('/*'))
    for (const selector of selectors) {
      for (const part of selector.split(',')) expect(part.trim()).toMatch(/^\.tq[\s.-]|^\.tq$/u)
    }
  })
})

describe('telefon gösterimi', () => {
  it('cep numarası okunur biçimde basılır', () => {
    expect(formatPhoneForDisplay('05553631803')).toBe('0555 363 18 03')
    expect(formatPhoneForDisplay('+90 555 363 18 03')).toBe('0555 363 18 03')
    expect(formatPhoneForDisplay('5553631803')).toBe('0555 363 18 03')
  })

  it('tanınmayan biçim olduğu gibi bırakılır', () => {
    expect(formatPhoneForDisplay('0216 123')).toBe('0216 123')
    expect(formatPhoneForDisplay('')).toBe('')
  })
})

// Termin süresi (Emrah, 16 Ekim 2026): taşyünü teklifinde "Sevkiyat planı" adımında yazılır; EPS'te süre söylenmedi.
describe('teklif PDF\'i: termin süresi', () => {
  const processText = (data: PDFQuoteData) => text(blockOf(buildQuoteDocument(data, options).flow, 'process'))

  it('taşyünü teklifinde termin ve not sevkiyat planında yazar', () => {
    const body = processText({ ...setQuote, materialType: 'tasyunu' })
    expect(body).toContain('Termin süresi: 7–21 gün (sipariş onayından teslime).')
    expect(body).toContain('Çoğunlukla 1 hafta içinde teslim edilir.')
    expect(body).toContain(ORDER_PROCESS_TEXT.shippingPlan)
  })

  it('EPS teklifinde termin yazmaz', () => {
    const body = processText({ ...setQuote, materialType: 'eps' })
    expect(body).not.toContain('Termin süresi')
    expect(body).toContain(ORDER_PROCESS_TEXT.shippingPlan)
  })
})

// 28 Ekim 2026 (Emrah): teklif zaten alçı ya da alçıpan içeriyorsa alttaki
// "Alçı ve alçıpan da lazım mı?" kutusu basılmaz. TE-2026-000272'de kutu,
// teklifteki makine alçısından ucuz bir makine alçısını öneriyordu.
describe('teklif PDF\'i: teklifte alçı varsa alçı tanıtım kutusu basılmaz', () => {
  const serbest = (description: string, quantity: number, unit: string, unitPrice: number): PDFQuoteItem => ({
    description, quantity, unit, consumptionRate: 0, unitPrice, totalPrice: Math.round(quantity * unitPrice * 100) / 100, isPlate: false,
  })
  const withItems = (...items: PDFQuoteItem[]): PDFQuoteData => ({ ...setQuote, items: [...setQuote.items, ...items] })
  const hasCross = (data: PDFQuoteData) => {
    const flow = buildQuoteDocument(data, options).flow
    return kinds(flow).includes('cross') || flow.join('').includes('Alçı ve alçıpan da lazım mı?')
  }

  it('makine alçısı kalemi varsa kutu basılmaz', () => {
    expect(hasCross(withItems(serbest('Entegre Alçımatik Makine Alçı Sıvası 35kg · 1.200 m², 1 cm (10 kg/m²) · 7 palet', 350, 'TORBA', 144.38)))).toBe(false)
  })

  it('alçıpan kalemi varsa kutu basılmaz (büyük harf ve ASCII yazım dahil)', () => {
    expect(hasCross(withItems(serbest('DALSAN BEYAZ ALÇIPAN 12,5 MM', 200, 'ADET', 180)))).toBe(false)
    expect(hasCross(withItems(serbest('Saten alci 25 kg', 40, 'TORBA', 150)))).toBe(false)
  })

  it('alçı içermeyen teklifte kutu yerinde kalır', () => {
    expect(hasCross(setQuote)).toBe(true)
    expect(hasCross(withItems(serbest("Tuğla 13,5'luk · 21 palet × 336 adet · nakliye dahil", 7056, 'ADET', 9.36)))).toBe(true)
  })

  it('adında "Alçı Kaplı" geçen taşyünü levhası kutuyu gizlemez', () => {
    const desibel: PDFQuoteItem = { ...plate, description: 'Bonus Desibel Alçı Kaplı Kompozit Taşyünü Levha 5 cm' }
    expect(hasCross({ ...setQuote, items: [desibel, ...setQuote.items.slice(1)] })).toBe(true)
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildQuoteDocument } from '@/lib/pdf/quoteDocument'
import type { PDFQuoteData } from '@/lib/pdfGenerator'
import { quoteDensityDisplay, quoteDensityNote } from '@/lib/technical-profiles'
import { generateQuoteWhatsAppMessage } from '@/lib/utils/whatsapp'

// Emrah, 24 Ekim 2026 (TY2866541, Ferhat Öner): müşteri Gold Plus 70 seçti,
// PDF'te yoğunluk yazmadı. "Yazmadığınız için belki 50 yoğunlukta
// yollayacaksınız" — güven kaybı. Levhanın yoğunluğu teklif belgesinde yazar.

describe('teklif yoğunluk notu', () => {
  it('Gold Plus varyantının föy yoğunluğunu kaynağıyla verir', () => {
    expect(quoteDensityNote('Gold Plus 70')).toBe('Yoğunluk: 70 kg/m³ · Föy beyanı')
    expect(quoteDensityNote('Gold Plus 50')).toBe('Yoğunluk: 50 kg/m³ · Föy beyanı')
    expect(quoteDensityDisplay('Gold Plus 90')).toBe('90 kg/m³')
  })

  it('sözlü beyanı föy beyanı gibi göstermez', () => {
    expect(quoteDensityNote('TR7.5')).toBe('Yoğunluk: 100–110 kg/m³ · Üretici sözlü beyanı — değişken')
  })

  it('föyde beyan yoksa ya da model bilinmiyorsa değer uydurmaz', () => {
    expect(quoteDensityNote('Premium F')).toBeNull()
    expect(quoteDensityNote('İdeal Carbon')).toBeNull()
    expect(quoteDensityNote(null)).toBeNull()
    expect(quoteDensityDisplay(undefined)).toBeNull()
  })
})

const goldPlusQuote: PDFQuoteData = {
  packageName: 'Bonus Gold Plus Taşyünü Giydirme Cephe Levhası',
  packageDescription: 'Bonus Gold Plus Taşyünü Giydirme Cephe Levhası',
  plateBrandName: 'Bonus',
  accessoryBrandName: '-',
  metraj: 3548,
  thickness: '10',
  materialType: 'tasyunu',
  materialLongName: 'Taşyünü',
  cityName: 'Malatya',
  grandTotal: 2014100.26,
  pricePerM2: 473.06,
  totalProductCost: 1678416.88,
  shippingCost: 0,
  priceWithoutVat: 1678416.88,
  vatAmount: 335683.38,
  refCode: 'TY2866541',
  validityDate: '27.10.2026',
  whatsappOrderLink: 'https://wa.me/905435186988?text=Merhaba',
  customerCompany: '',
  relatedPerson: 'Ferhat Öner',
  deliveryAddress: '',
  phone: '05327209245',
  email: '',
  systemDescription: 'Bonus Gold Plus Taşyünü Giydirme Cephe Levhası — 10 cm',
  shippingMode: 'included_in_sale_price',
  items: [
    {
      description: 'Bonus Gold Plus Taşyünü Giydirme Cephe Levhası (10 cm)',
      quantity: 3548,
      unit: 'm²',
      consumptionRate: 1,
      consumptionUnit: 'm²/m²',
      unitPrice: 473.06,
      totalPrice: 1678416.88,
      isPlate: true,
      packageCount: 1232,
      technicalNote: quoteDensityNote('Gold Plus 70'),
    },
  ],
}

const options = { qrDataUrl: 'data:image/png;base64,QR', issuedAt: new Date('2026-10-24T14:54:00+03:00') }
const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gu, '').replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim()
const whole = (data: PDFQuoteData) => {
  const parts = buildQuoteDocument(data, options)
  return text([parts.header, parts.context, ...parts.flow, parts.footer].join('\n'))
}

describe('teklif PDF\'inde levha yoğunluğu', () => {
  it('levha satırında ve ürün kutusunda yoğunluk yazar', () => {
    const doc = whole(goldPlusQuote)
    expect(doc).toContain('Bonus Gold Plus Taşyünü Giydirme Cephe Levhası (10 cm) (1232 PKT) Yoğunluk: 70 kg/m³ · Föy beyanı')
    expect(doc).toContain('Taşyünü · 10 cm · Yoğunluk: 70 kg/m³ · Föy beyanı')
  })

  it('not yoksa satıra boş satır ya da "Yoğunluk" yazılmaz', () => {
    const items = goldPlusQuote.items.map((it) => ({ ...it, technicalNote: null }))
    expect(whole({ ...goldPlusQuote, items })).not.toContain('Yoğunluk')
  })
})

describe('WhatsApp sipariş mesajında yoğunluk', () => {
  const base = {
    productName: 'Bonus Gold Plus Taşyünü Giydirme Cephe Levhası',
    thicknessCm: 10,
    metrajM2: 3548,
    vehicleLabel: '1 TIR dolusu',
    cityName: 'Malatya',
    pricePerM2: 473.06,
    totalKdvHaric: 1678416.88,
    shippingMessage: 'fiyata dahil',
  }

  it('tek ürün mesajında ürün satırının altında yazar', () => {
    const message = generateQuoteWhatsAppMessage({ ...base, densityDisplay: '70 kg/m³' })
    expect(message).toContain('Bonus Gold Plus Taşyünü Giydirme Cephe Levhası (10 cm) için teklif almak istiyorum.\nYoğunluk: 70 kg/m³')
  })

  it('set mesajında levha satırının altında yazar; yoksa satır eklenmez', () => {
    const setContext = { itemCount: 8, plateName: 'Optimix TR7.5', tierName: 'Orijinal Sistem' }
    expect(generateQuoteWhatsAppMessage({ ...base, setContext, densityDisplay: '100–110 kg/m³' }))
      .toContain('Levha: Optimix TR7.5\nYoğunluk: 100–110 kg/m³\nSistem: Orijinal Sistem')
    expect(generateQuoteWhatsAppMessage({ ...base, setContext })).not.toContain('Yoğunluk')
  })
})

describe('üç teklif yolu yoğunluk notunu belgeye taşır', () => {
  const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

  it('ürün sayfası: seçilen varyant (override) önce gelir', () => {
    const s = source('components/catalog/SingleProductQuoteButton.tsx')
    expect(s).toContain('const densityModel     = modelNameOverride ?? product.model;')
    expect(s).toContain('technicalNote:   densityNote,')
    expect(s).toContain('densityDisplay: quoteDensityDisplay(densityModel),')
  })

  it('hesaplayıcı: levha kalemine ve WhatsApp mesajına', () => {
    const s = source('components/wizard/WizardCalculator.tsx')
    expect(s).toContain('technicalNote: it.isPlate ? quoteDensityNote(selectedModel) : null,')
    expect(s).toContain('densityDisplay: quoteDensityDisplay(selectedModel),')
  })

  it('ofis: katalogdan seçilen levhanın model adından', () => {
    expect(source('app/ofis/tabs/quotes/QuoteBuilder.tsx')).toContain('quoteDensityNote(catalogItems.find((i) => i.key === l.catalogKey)?.modelShortName)')
    expect(source('lib/quote/buildManualPdfData.ts')).toContain('technicalNote: l.technicalNote ?? null,')
  })
})

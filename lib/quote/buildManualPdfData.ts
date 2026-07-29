import type { PDFQuoteData, PDFQuoteItem } from '@/lib/pdfGenerator'
import { discountedUnitPrice, effectiveLineTotal } from '@/lib/schemas/manualQuote.schema'
import { generateQuoteWhatsAppMessage, buildWhatsAppLink } from '@/lib/utils/whatsapp'
import { roundToKurus } from '@/lib/pricing/quoteTotals'

// Elle yazılan teklifi PDF sözleşmesine çevirir.
//
// Wizard ile AYNI şablonu (lib/pdfGenerator.ts) kullanır — müşteri iki
// kanaldan da aynı belgeyi görür. `lib/pdfGenerator.ts` dosyasına
// DOKUNULMAZ: tests/contracts/pdf-screen-consistency.test.ts o dosyanın
// HTML gövdesine regex ve font-size sayımıyla bağlı, kozmetik bir
// düzenleme bile testi kırar.
//
// Bu yüzden genel iskonto ve nakliye, şablona yeni bir bölüm eklemek
// yerine NEGATİF/POZİTİF KALEM SATIRI olarak basılır — mevcut kalem
// tablosu bunları olduğu gibi gösterir.

export interface ManualPdfInput {
  quoteCode: string
  customerName: string
  customerCompany?: string | null
  customerPhone: string
  customerEmail?: string | null
  customerAddress?: string | null
  cityName: string
  title?: string | null
  notes?: string | null
  materialType: 'tasyunu' | 'eps' | 'karma'
  areaM2: number
  validityDays: number
  lines: Array<{
    description: string
    quantity: number
    unit: string
    unitPrice: number
    lineDiscountPct?: number
    isPlate?: boolean
    thicknessCm?: number | null
    packageCount?: number | null
  }>
  discountPct: number
  shippingCharge: number
  /** Belgede nakliyenin nasıl görüneceği — operatörün açık seçimi. */
  shippingMode?: 'included_in_sale_price' | 'buyer_pays' | 'separate_quote_required'
  totals: {
    linesNet: number
    discountAmount: number
    priceWithoutVat: number
    vatAmount: number
    totalPrice: number
  }
}

function formatValidityDate(days: number, now: Date): string {
  const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  return d.toLocaleDateString('tr-TR')
}

export function buildManualPdfData(input: ManualPdfInput, now = new Date()): PDFQuoteData {
  const plateLine = input.lines.find((l) => l.isPlate) ?? null

  // İskonto BİRİM FİYATLARA işlenir; belgenin altına ayrı bir eksi satır
  // YAZILMAZ (27 Tem 2026 kararı). Müşteri belgede zaten indirilmiş fiyatı
  // görür — satış görüşmesinde "şu fiyattan veriyorum" demek buna dayanıyor
  // ve satır tutarlarının toplamı ara toplamı birebir verir.
  const items: PDFQuoteItem[] = input.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    // Sarfiyat oranı yalnız wizard'ın otomatik paketlerinde anlamlı;
    // elle yazılan satırda 0 geçilir ve şablonda boş görünür.
    consumptionRate: 0,
    unitPrice: discountedUnitPrice(l.unitPrice, input.discountPct),
    totalPrice: effectiveLineTotal(l, input.discountPct),
    isPlate: l.isPlate ?? false,
    packageCount: l.packageCount ?? undefined,
  }))

  if (input.shippingCharge > 0) {
    items.push({
      description: 'Nakliye',
      quantity: 1,
      unit: 'kalem',
      consumptionRate: 0,
      unitPrice: input.shippingCharge,
      totalPrice: input.shippingCharge,
      isPlate: false,
    })
  }

  // Ayrı kalem olarak nakliye eklendiyse "dahil" denemez; operatör
  // "dahil" seçse bile tutar satırda göründüğü için alıcıya ait sayılır.
  const nakliyeModu: 'included_in_sale_price' | 'buyer_pays' | 'separate_quote_required' =
    input.shippingCharge > 0
      ? 'buyer_pays'
      : (input.shippingMode ?? 'included_in_sale_price')

  const nakliyeMesaji =
    nakliyeModu === 'included_in_sale_price'
      ? 'Nakliye dahildir.'
      : nakliyeModu === 'buyer_pays'
        ? 'Nakliye fiyata dahil değildir; alıcıya aittir.'
        : 'Nakliye koşulu satış görüşmesinde netleşir.'

  const pricePerM2 = input.areaM2 > 0
    ? roundToKurus(input.totals.priceWithoutVat / input.areaM2)
    : 0

  // PDF şablonu 'tasyunu' | 'eps' bekliyor; karma teklifte levha satırı
  // varsa onun malzemesi, yoksa taşyünü varsayılır (etiket amaçlı).
  const materialType: 'tasyunu' | 'eps' =
    input.materialType === 'eps' ? 'eps' : 'tasyunu'

  const whatsappMessage = generateQuoteWhatsAppMessage({
    productName: input.title || plateLine?.description || 'Teklif',
    thicknessCm: plateLine?.thicknessCm ?? 0,
    metrajM2: input.areaM2,
    vehicleLabel: '',
    cityName: input.cityName,
    pricePerM2,
    totalKdvHaric: input.totals.priceWithoutVat,
    shippingMessage: nakliyeMesaji,
    refCode: input.quoteCode,
  })

  // İskonto vurgusu: eksi satır yok ama müşteri indirimin uygulandığını
  // görmeli — teklif notunun başına yazılır.
  const iskontoNotu =
    input.discountPct > 0
      ? `Birim fiyatlara %${input.discountPct} toplu alım iskontosu uygulanmıştır.`
      : ''
  const aciklama = [iskontoNotu, input.notes?.trim()].filter(Boolean).join(' ')

  return {
    packageName: input.title || 'Ofis Teklifi',
    packageDescription: aciklama,
    plateBrandName: plateLine?.description.split(' ')[0] || '',
    accessoryBrandName: '',
    metraj: input.areaM2,
    thickness: plateLine?.thicknessCm != null ? String(plateLine.thicknessCm) : '',
    materialType,
    cityName: input.cityName,

    grandTotal: input.totals.totalPrice,
    pricePerM2,
    totalProductCost: input.totals.priceWithoutVat,
    shippingCost: input.shippingCharge,
    priceWithoutVat: input.totals.priceWithoutVat,
    vatAmount: input.totals.vatAmount,

    // "Seçilen Sistem" satırı: levha kalemi işaretli değilse şablon
    // `${malzeme} ${kalınlık} cm` kurar ve kalınlık boşsa "Taşyünü cm"
    // gibi kusurlu bir metin çıkar. Elle teklifte teklif başlığı bu işi
    // daha iyi yapar (ör. "Bonus F 150 Pro 4cm + TEKNO Toz Grubu").
    systemDescription:
      input.title?.trim() || plateLine?.description || undefined,

    refCode: input.quoteCode,
    validityDate: formatValidityDate(input.validityDays, now),
    whatsappOrderLink: buildWhatsAppLink(whatsappMessage),

    customerCompany: input.customerCompany || '',
    relatedPerson: input.customerName,
    deliveryAddress: input.customerAddress || '',
    phone: input.customerPhone,
    email: input.customerEmail || '',
    city: input.cityName,

    items,
    // Nakliye sunumu OPERATÖRÜN SEÇİMİDİR; tutarın sıfır olmasından
    // çıkarım yapılmaz (29 Tem 2026: nakliye hariç teklif verilemiyordu).
    isShippingIncluded: nakliyeModu === 'included_in_sale_price',
    shippingMode: nakliyeModu,
  }
}

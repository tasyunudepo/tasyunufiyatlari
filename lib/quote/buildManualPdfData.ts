import type { PDFQuoteData, PDFQuoteItem } from '@/lib/pdfGenerator'
import { discountedUnitPrice, effectiveLineTotal } from '@/lib/schemas/manualQuote.schema'
import { generateQuoteWhatsAppMessage, buildWhatsAppLink } from '@/lib/utils/whatsapp'
import { roundToKurus } from '@/lib/pricing/quoteTotals'
import { SHIPPING_LINE_DESCRIPTION, SHIPPING_LINE_SENTENCE } from '@/lib/pdf/quoteDocument'
import type { PlateIdentity } from '@/lib/quote/plateIdentity'
import { lastValidDay } from '@/lib/quote/validity'
import type { TechnicalConsumptionUnit } from '@/lib/types'

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
    consumptionRate?: number | null
    consumptionUnit?: TechnicalConsumptionUnit | null
    /** Levha kimliği: ad, tür, yoğunluk, ölçü, paket (lib/quote/plateIdentity.ts). */
    identity?: PlateIdentity | null
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
  return lastValidDay(now, days)
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
    // Toz grubu setinden gelen teknik oran korunur. Serbest kalemde oran
    // yoksa uydurulmaz; levha kendi alanının tamamını kapladığı için 1'dir.
    consumptionRate: l.consumptionRate ?? (l.isPlate ? 1 : 0),
    consumptionUnit: l.consumptionUnit ?? (l.isPlate ? 'm²/m²' : undefined),
    unitPrice: discountedUnitPrice(l.unitPrice, input.discountPct),
    totalPrice: effectiveLineTotal(l, input.discountPct),
    isPlate: l.isPlate ?? false,
    packageCount: l.packageCount ?? undefined,
    identity: l.isPlate ? l.identity ?? null : null,
  }))

  if (input.shippingCharge > 0) {
    items.push({
      description: SHIPPING_LINE_DESCRIPTION,
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

  // Ayrı nakliye kalemi toplamın içindedir; mesaj belgeyle aynı cümleyi
  // kullanır. Eskiden mesaj "fiyata dahil değildir; alıcıya aittir" diyordu.
  const nakliyeMesaji =
    input.shippingCharge > 0
      ? SHIPPING_LINE_SENTENCE
      : nakliyeModu === 'included_in_sale_price'
        ? 'Nakliye dahildir.'
        : nakliyeModu === 'buyer_pays'
          ? 'Nakliye fiyata dahil değildir; alıcıya aittir.'
          : 'Nakliye koşulu satış görüşmesinde netleşir.'

  // Belgedeki metraj ve m² fiyatının paydası aynı kaynaktan gelir: levha
  // varsa fiyatlandırılan levha metrajı (tam pakete yuvarlanmış), yoksa iş
  // metrajı. Eskiden pay ile payda ayrıydı: 3.548,16 m² levhada m² fiyatı
  // 3.548 m²'ye bölünüyor, birim fiyat 446,78 iken üstte 446,80 yazıyordu.
  const pricedArea = plateLine && plateLine.quantity > 0 ? plateLine.quantity : input.areaM2
  const pricePerM2 = pricedArea > 0
    ? roundToKurus(input.totals.priceWithoutVat / pricedArea)
    : 0

  // PDF şablonu 'tasyunu' | 'eps' bekliyor; karma teklifte levha satırı
  // varsa onun malzemesi, yoksa taşyünü varsayılır (etiket amaçlı).
  const materialType: 'tasyunu' | 'eps' =
    input.materialType === 'eps' ? 'eps' : 'tasyunu'

  const whatsappMessage = generateQuoteWhatsAppMessage({
    productName: input.title || plateLine?.description || 'Teklif',
    thicknessCm: plateLine?.thicknessCm ?? 0,
    metrajM2: pricedArea,
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
    // Başlık yoksa ürün kutusuna "Paket: Ofis Teklifi" yazılmaz; malzeme ve kalınlık görünür.
    packageName: input.title?.trim() || '',
    packageDescription: aciklama,
    quoteNote: aciklama || undefined,
    plateBrandName: plateLine?.description.split(' ')[0] || '',
    accessoryBrandName: '',
    metraj: pricedArea,
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

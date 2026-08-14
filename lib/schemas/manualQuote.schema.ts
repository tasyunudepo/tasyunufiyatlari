import { z } from 'zod'

// Elle teklif şeması — ofis yüzeyi içindir ve `apiQuoteSchema`'yı İMPORT ETMEZ.
//
// Neden ayrı: public teklif akışı `submit_quote_guarded` RPC'sinden geçiyor ve
// operatör için ölümcül kısıtlar taşıyor:
//   · IP başına 5/10dk, telefon başına 3/30dk hız limiti → arka arkaya teklif yazılamaz
//   · 30 dk dedupe → aynı müşteriye ikinci varyant ikinci kayıt oluşturmaz
//   · kvkk_consent = true zorunlu → telefonla gelen müşteride sahte rıza demek
//   · 25 zorunlu anahtar (plate_brand_name, package_count, items_per_package…)
//     → yalnız toz kalemlerinden oluşan teklif geçemez
//
// Buradaki kural: ürün alanları opsiyonel, PARA alanları katı.

export const QUOTE_LINE_KINDS = ['levha', 'aksesuar', 'hizmet', 'serbest'] as const

export const manualQuoteLineSchema = z.object({
  kind: z.enum(QUOTE_LINE_KINDS).default('serbest'),
  /** Katalogdan seçildiyse kaynağı; serbest satırda null. */
  catalogKey: z.string().max(64).nullable().optional(),
  description: z.string().trim().min(1, 'Ürün adı gerekli').max(300),
  quantity: z.number().positive('Miktar sıfırdan büyük olmalı').max(1_000_000),
  unit: z.string().trim().min(1).max(20),
  unitPrice: z.number().min(0, 'Birim fiyat negatif olamaz').max(10_000_000),
  /** Satır bazlı iskonto (%). Genel iskonto ayrıca uygulanır. */
  lineDiscountPct: z.number().min(0).max(100).default(0),
  isPlate: z.boolean().default(false),
  thicknessCm: z.number().min(0).max(100).nullable().optional(),
  packageCount: z.number().int().min(0).nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),

  // ── Hesap ve izlenebilirlik dayanağı ──
  //
  // NEDEN SAKLANIYOR: 27 Temmuz 2026'da bir teklifin hangi marjla
  // üretildiği kayıttan okunamadı, tersine mühendislikle bulundu. Ayrıca
  // asıl iş "teklifi çoğalt, metrajı değiştir"di; sarfiyat saklanmadan
  // miktarlar yeniden hesaplanamıyor.
  //
  // GİZLİLİK: netCost ve unitContent yalnız `package_items` JSONB'sinde kalır.
  // Teknik sarfiyat ve fiziksel birimi ise müşterinin malzeme hesabını
  // denetleyebilmesi için PDF'de gösterilir.
  /** İskontolar uygulanmış birim alış, KDV hariç. */
  netCost: z.number().min(0).max(10_000_000).nullable().optional(),
  /** m² başına sarfiyat — toz grubu kalemlerinde. */
  consumptionRate: z.number().min(0).max(1000).nullable().optional(),
  /** Sarfiyatın fiziksel birimi; PKT/KOVA gibi satış birimi değildir. */
  consumptionUnit: z
    .enum(['kg/m²', 'adet/m²', 'm²/m²', 'mt/m²'])
    .nullable()
    .optional(),
  /** Paket içeriği (adet/kg) — çoğaltmada miktar yeniden hesabı için. */
  unitContent: z.number().min(0).max(100_000).nullable().optional(),
})

export type ManualQuoteLine = z.infer<typeof manualQuoteLineSchema>

export const manualQuoteSchema = z.object({
  // ── Müşteri ──
  customerName: z.string().trim().min(2, 'En az 2 karakter').max(120),
  customerPhone: z.string().trim().min(7, 'Telefon çok kısa').max(24),
  customerCompany: z.string().trim().max(255).nullable().optional(),
  customerEmail: z.string().trim().max(255).nullable().optional(),
  customerAddress: z.string().trim().max(500).nullable().optional(),

  // ── Bağlam ──
  cityCode: z.string().trim().min(1, 'Şehir seçin').max(10),
  cityName: z.string().trim().min(1, 'Şehir adı gerekli').max(120),
  materialType: z.enum(['tasyunu', 'eps', 'karma']).default('karma'),
  /** İş metrajı — m² fiyatı ve marj kademesi buna göre. */
  areaM2: z.number().positive('Metraj sıfırdan büyük olmalı').max(100000),
  title: z.string().trim().max(200).nullable().optional(),
  validityDays: z.number().int().min(1).max(90).default(7),
  notes: z.string().trim().max(2000).nullable().optional(),

  // ── Kalemler ve para ──
  lines: z.array(manualQuoteLineSchema).min(1, 'En az bir kalem girin'),
  /** Genel toplu alım iskontosu (%). KDV matrahından önce uygulanır. */
  discountPct: z.number().min(0).max(100).default(0),
  shippingCharge: z.number().min(0).max(10_000_000).default(0),
  /**
   * Nakliyenin belgedeki sunumu.
   *
   * 29 Temmuz 2026: operatör nakliye HARİÇ teklif vermek istedi ve
   * veremedi — ekran nakliye tutarı 0 ise otomatik "DAHİL" yazıyordu.
   * Artık açık seçim: dahil / alıcıya ait / satış görüşmesinde netleşir.
   */
  shippingMode: z
    .enum(['included_in_sale_price', 'buyer_pays', 'separate_quote_required'])
    .default('included_in_sale_price'),
  /**
   * Fiyatların üretildiği marj — tüm kalemler aynı marjdaysa o değer,
   * karışıksa null. Kayda geçer, belgeye yazılmaz.
   */
  appliedMarginPct: z.number().min(0).max(100).nullable().optional(),

  // ── İstemcinin hesabı (sunucu yeniden hesaplar ve karşılaştırır) ──
  expectedPriceWithoutVat: z.number().min(0),
  expectedTotalPrice: z.number().min(0),

  // ── KVKK ──
  // Telefonla/ofisten gelen müşteride AÇIK RIZA yoktur; dayanak sözleşme
  // hazırlığıdır (KVKK m.5/2-c). Sahte rıza kaydı yazılmaz.
  consentBasis: z
    .enum(['acik_riza', 'sozlesme_hazirligi', 'mesru_menfaat'])
    .default('sozlesme_hazirligi'),
  consentChannel: z.enum(['telefon', 'yuz_yuze', 'eposta', 'whatsapp']),

  // ── Ticari kural aşımı ──
  /** Min sipariş / tam araç uyarısı varsa operatör gerekçeyle geçer. */
  overrideCommercialRules: z.boolean().default(false),
  overrideReason: z.string().trim().max(300).nullable().optional(),
})
  .refine(
    (v) => !v.overrideCommercialRules || (v.overrideReason?.length ?? 0) >= 3,
    { message: 'Kural aşımı için gerekçe girin.', path: ['overrideReason'] },
  )

export type ManualQuoteInput = z.infer<typeof manualQuoteSchema>

/** Bir satırın net tutarı (KDV hariç, satır iskontosu uygulanmış). */
export function lineTotal(line: {
  quantity: number
  unitPrice: number
  lineDiscountPct?: number
}): number {
  const gross = line.quantity * line.unitPrice
  const net = gross * (1 - (line.lineDiscountPct ?? 0) / 100)
  return Math.round(net * 100) / 100
}

/**
 * Toplu iskonto UYGULANMIŞ birim fiyat.
 *
 * KARAR (27 Tem 2026, kullanıcı): iskonto belgenin altına ayrı bir eksi satır
 * olarak YAZILMAZ; doğrudan BİRİM FİYATLARA işlenir. Müşteri belgede zaten
 * indirilmiş fiyatı görür — sahadaki standart bu ve satış görüşmesinde
 * "şu fiyattan veriyorum" demek buna dayanıyor.
 */
export function discountedUnitPrice(unitPrice: number, discountPct: number): number {
  if (!Number.isFinite(discountPct) || discountPct <= 0) {
    return Math.round(unitPrice * 100) / 100
  }
  return Math.round(unitPrice * (1 - discountPct / 100) * 100) / 100
}

/** Toplu iskonto işlenmiş satır tutarı. */
export function effectiveLineTotal(
  line: { quantity: number; unitPrice: number; lineDiscountPct?: number },
  discountPct: number,
): number {
  return lineTotal({
    quantity: line.quantity,
    unitPrice: discountedUnitPrice(line.unitPrice, discountPct),
    lineDiscountPct: line.lineDiscountPct,
  })
}

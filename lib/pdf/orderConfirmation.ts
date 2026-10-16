import { BUSINESS_INFO } from '@/lib/business/info'
import { ORDER_PROCESS_TEXT, SELLER_BANK_ACCOUNTS } from '@/lib/pdf/orderProcess'
import { LEAD_TIME_LABEL, LEAD_TIME_NOTE, showsLeadTime } from '@/lib/sales/leadTime'
import { buildAccountIdentityRows, getSellerIdentity, type IdentityRow } from '@/lib/pdf/sellerIdentity'
import { roundToKurus } from '@/lib/pricing/quoteTotals'
import { fitVehicles, type VehicleCapacity } from '@/lib/quote/vehicleArea'

// ============================================================
// Sipariş Onay Formu — belge modeli
// ============================================================
//
// Teklif kabul edildikten sonra, ödemeden önce müşteriye verilen tek
// sayfalık belge. Amaç: parayı göndereceği anda müşterinin elinde satıcının
// kim olduğunu, parasının nereye gittiğini ve sonrasında ne olacağını
// doğrulanabilir alanlarla gösteren tek bir kâğıt olması.
//
// Karar: reports/capraz-satis-seo-geo-2026-10-09/yuvarlak-masa.md
// (13 Ekim 2026). Ödeme kuralı değişmez: sipariş onayında tek seferde.
// Belgeye maliyet, marj ya da iskonto oranı gibi iç alanlar yazılmaz.
// ============================================================

export { SELLER_BANK_ACCOUNTS }

export interface OrderReference {
  /** Referans kişinin adı. */
  name: string
  /** Ne aldığı, nereye; örn. "Osmancık, 4 TIR alçı". */
  detail: string
  phone: string
}

export interface OrderConfirmationInput {
  quoteCode: string
  customerName: string
  customerCompany?: string | null
  cityName: string
  deliveryAddress?: string | null
  /** Ürün ya da paket adı, kalınlıkla birlikte. */
  productLabel: string
  areaM2: number
  /** KDV dahil genel toplam. */
  totalPrice: number
  priceWithoutVat?: number | null
  vatAmount?: number | null
  /** Tam araç kapasitesi; yoksa "1. araç" satırı basılmaz. */
  vehicleCapacity?: VehicleCapacity | null
  /** 'tasyunu' ise sevkiyat planı adımında termin süresi yazar (Emrah, 16 Ekim 2026). */
  materialType?: string | null
  /** Müşterinin izniyle doldurulur; boşken basılmaz. */
  reference?: OrderReference | null
  issuedAt: Date
}

export interface FirstVehicle {
  label: 'TIR' | 'kamyon'
  /** İlk aracın taşıdığı metraj. */
  areaM2: number
  /** İlk aracın KDV dahil tutarı. */
  amount: number
  /** Siparişin toplam araç sayısı. */
  vehicleCount: number
  /** "2 TIR + 1 kamyon" gibi toplam araç planı. */
  planLabel: string
}

/**
 * Birden çok araca tam oturan siparişte ilk aracın metrajı ve tutarı.
 *
 * Tutar, teklifin toplamından metraj oranıyla ayrılır: teklifte tek bir m²
 * fiyatı vardır, ilk araç da o fiyattan ödenir. Tek araçlı siparişte ve
 * metraj araç dolusuna tam oturmuyorsa `null` döner; yanlış araç etiketi
 * gerçek bir sipariş hatasına yol açar (bkz. vehicleArea.ts).
 */
export function computeFirstVehicle(
  areaM2: number,
  totalPrice: number,
  capacity: VehicleCapacity | null | undefined,
): FirstVehicle | null {
  if (!capacity || !(areaM2 > 0) || !(totalPrice > 0)) return null

  const fit = fitVehicles(areaM2, capacity)
  if (!fit || !fit.exact) return null

  const vehicleCount = fit.trucks + fit.lorries
  if (vehicleCount < 2) return null

  const isTruck = fit.trucks > 0
  const firstArea = isTruck ? capacity.truckM2 : capacity.lorryM2
  if (firstArea == null || !(firstArea > 0)) return null

  const parts: string[] = []
  if (fit.trucks > 0) parts.push(`${fit.trucks} TIR`)
  if (fit.lorries > 0) parts.push(`${fit.lorries} kamyon`)

  return {
    label: isTruck ? 'TIR' : 'kamyon',
    areaM2: firstArea,
    amount: roundToKurus((totalPrice * firstArea) / areaM2),
    vehicleCount,
    planLabel: parts.join(' + '),
  }
}

/** Teklif kaydındaki paket alanlarından tam araç kapasitesi (m²). */
export function capacityFromQuote(quote: {
  truckCapacityPackages?: number | null
  lorryCapacityPackages?: number | null
  packageSizeM2?: number | null
}): VehicleCapacity | null {
  const size = Number(quote.packageSizeM2)
  if (!(size > 0)) return null

  const toM2 = (packages: number | null | undefined): number | null => {
    const count = Number(packages)
    return count > 0 ? roundToKurus(count * size) : null
  }
  const capacity = {
    truckM2: toM2(quote.truckCapacityPackages),
    lorryM2: toM2(quote.lorryCapacityPackages),
  }
  return capacity.truckM2 == null && capacity.lorryM2 == null ? null : capacity
}

/** Ofisteki teklif kaydının bu belge için okunan alanları. */
export interface QuoteRecordLike {
  quote_code?: string | null
  id?: number | string | null
  customer_name?: string | null
  customer_company?: string | null
  customer_address?: string | null
  city_name?: string | null
  material_type?: string | null
  brand_name?: string | null
  model_name?: unknown
  package_name?: string | null
  thickness_cm?: number | null
  area_m2?: number | null
  total_price?: number | null
  price_without_vat?: number | null
  vat_amount?: number | null
  truck_capacity_packages?: unknown
  lorry_capacity_packages?: unknown
  package_size_m2?: unknown
}

const MATERIAL_LABEL: Record<string, string> = { tasyunu: 'Taşyünü', eps: 'EPS' }

/** "Bonus F 120 Taşyünü 8 cm" — marka, model, malzeme ve kalınlık tek satırda. */
export function productLabelFromQuote(quote: QuoteRecordLike): string {
  const model = typeof quote.model_name === 'string' ? quote.model_name.trim() : ''
  const brand = (quote.brand_name ?? '').trim()
  const material = MATERIAL_LABEL[quote.material_type ?? ''] ?? ''
  const lower = (value: string) => value.toLocaleLowerCase('tr-TR')

  const parts: string[] = []
  if (brand && !lower(model).includes(lower(brand))) parts.push(brand)
  if (model) parts.push(model)
  if (parts.length === 0 && quote.package_name) parts.push(quote.package_name.trim())
  if (material && !lower(parts.join(' ')).includes(lower(material))) parts.push(material)
  if (quote.thickness_cm != null && quote.thickness_cm > 0) {
    parts.push(`${quote.thickness_cm.toLocaleString('tr-TR')} cm`)
  }
  return parts.join(' ')
}

const toNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value)
  return value != null && Number.isFinite(parsed) ? parsed : null
}

export function orderInputFromQuote(quote: QuoteRecordLike, now: Date = new Date()): OrderConfirmationInput {
  return {
    quoteCode: quote.quote_code ?? (quote.id != null ? `#${quote.id}` : ''),
    customerName: (quote.customer_name ?? '').trim(),
    customerCompany: quote.customer_company?.trim() || null,
    cityName: (quote.city_name ?? '').trim(),
    deliveryAddress: quote.customer_address?.trim() || null,
    productLabel: productLabelFromQuote(quote),
    areaM2: Number(quote.area_m2) || 0,
    totalPrice: Number(quote.total_price) || 0,
    priceWithoutVat: toNumberOrNull(quote.price_without_vat),
    vatAmount: toNumberOrNull(quote.vat_amount),
    vehicleCapacity: capacityFromQuote({
      truckCapacityPackages: toNumberOrNull(quote.truck_capacity_packages),
      lorryCapacityPackages: toNumberOrNull(quote.lorry_capacity_packages),
      packageSizeM2: toNumberOrNull(quote.package_size_m2),
    }),
    materialType: quote.material_type ?? null,
    issuedAt: now,
  }
}

export interface OrderConfirmationModel {
  quoteCode: string
  issuedOn: string
  sellerName: string
  sellerAddress: string
  sellerPhone: string
  quoteSite: string
  corporateSite: string
  orderRows: IdentityRow[]
  firstVehicle: { headline: string; note: string } | null
  accountRows: IdentityRow[]
  bankRows: IdentityRow[]
  accountNote: string
  manufacturerLines: string[]
  steps: Array<{ title: string; detail: string }>
  meetingPointLine: string | null
  reference: OrderReference | null
  paymentLine: string
}

const fmtMoney = (value: number): string =>
  `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`

const fmtArea = (value: number): string =>
  `${value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m²`

function isIstanbul(cityName: string): boolean {
  return cityName.trim().toLocaleLowerCase('tr-TR') === 'istanbul'
}

export function buildOrderConfirmationModel(input: OrderConfirmationInput): OrderConfirmationModel {
  const identity = getSellerIdentity()
  const customer = [input.customerName, input.customerCompany].filter(Boolean).join(' · ')
  const delivery = [input.deliveryAddress, input.cityName].filter(Boolean).join(' · ')

  const orderRows: IdentityRow[] = [
    { label: 'Müşteri', value: customer },
    { label: 'Teslim yeri', value: delivery },
    { label: 'Ürün', value: input.productLabel },
    { label: 'Metraj', value: fmtArea(input.areaM2) },
  ]
  if (input.priceWithoutVat != null && input.vatAmount != null) {
    orderRows.push(
      { label: 'Ara toplam (KDV hariç)', value: fmtMoney(input.priceWithoutVat) },
      { label: 'KDV (%20)', value: fmtMoney(input.vatAmount) },
    )
  }
  const first = computeFirstVehicle(input.areaM2, input.totalPrice, input.vehicleCapacity)

  // Çok araçlı işte tablo planın tamamını, vurgulu kutu bu formla onaylanan
  // aracı gösterir; müşteri hangi tutarı onayladığını ikisini karıştırmadan
  // görmelidir (editör bulgusu, 13 Ekim 2026).
  orderRows.push({
    label: first ? `Plan toplamı, ${first.planLabel} (KDV dahil)` : 'Genel toplam (KDV dahil)',
    value: fmtMoney(input.totalPrice),
  })

  return {
    quoteCode: input.quoteCode,
    issuedOn: input.issuedAt.toLocaleDateString('tr-TR'),
    sellerName: identity.legalName,
    sellerAddress: `${BUSINESS_INFO.address.streetAddress} ${BUSINESS_INFO.address.addressLocality} / ${BUSINESS_INFO.address.addressRegion}`,
    sellerPhone: BUSINESS_INFO.phone.display,
    quoteSite: identity.quoteSite,
    corporateSite: identity.corporateSite,
    orderRows,
    firstVehicle: first
      ? {
          headline: `Bu formla onaylanan: 1. araç (${first.label}, ${fmtArea(first.areaM2)}) · ${fmtMoney(first.amount)} KDV dahil`,
          note: `Sipariş ${first.planLabel} olarak planlanır. Kalan araçlar için ayrı onay formu düzenlenir; her aracın tutarı kendi onayında ödenir.`,
        }
      : null,
    accountRows: buildAccountIdentityRows(identity),
    bankRows: SELLER_BANK_ACCOUNTS.map((account) => ({ label: account.bank, value: account.iban })),
    accountNote: ORDER_PROCESS_TEXT.accountCheck,
    manufacturerLines: [
      'ÖzerGrup, Filli Boya ve Bonus yetkili bayisidir. Bayiliği üreticinin müşteri hattından teyit edebilirsiniz.',
      'Ödemeniz ulaştığında siparişiniz üreticiye girilir. Üreticinin sipariş teyidi size iletilir.',
    ],
    steps: [
      {
        title: 'Sipariş onayı',
        detail: first
          ? '1. aracı onaylarsınız; o aracın tutarı tek seferde alınır.'
          : 'Bu formu onaylarsınız; ödeme tek seferde alınır.',
      },
      { title: 'Üretici siparişi', detail: ORDER_PROCESS_TEXT.manufacturerOrder },
      {
        title: 'Sevkiyat planı',
        detail: showsLeadTime(input.materialType)
          ? `${LEAD_TIME_LABEL} (sipariş onayından teslime). ${LEAD_TIME_NOTE} ${ORDER_PROCESS_TEXT.shippingPlan}`
          : ORDER_PROCESS_TEXT.shippingPlan,
      },
      { title: 'Yükleme', detail: ORDER_PROCESS_TEXT.dispatch },
      { title: 'Teslim', detail: ORDER_PROCESS_TEXT.delivery },
    ],
    meetingPointLine: isIstanbul(input.cityName)
      ? `Teslim iliniz İstanbul olduğu için siparişi Tuzla görüşme noktasında yüz yüze kesinleştirebilirsiniz: ${BUSINESS_INFO.address.streetAddress}, ${BUSINESS_INFO.address.addressLocality}.`
      : null,
    reference: input.reference ?? null,
    paymentLine: first
      ? 'Onaylanan aracın tutarı sipariş onayında tek seferde alınır.'
      : ORDER_PROCESS_TEXT.paymentRule,
  }
}

function escapeHtml(input: string): string {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const C = {
  ink: '#0f172a',
  text: '#334155',
  muted: '#64748b',
  rule: '#cbd5e1',
  gold: '#a07a2c',
  goldSoft: '#f8efd3',
  panel: '#f8fafc',
}

function rowsHtml(rows: IdentityRow[], mono = false): string {
  return rows
    .map(
      (row) => `
      <div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;border-bottom:1px solid ${C.rule};padding:5px 0;">
        <span style="font-weight:700;white-space:nowrap;color:${C.text};">${escapeHtml(row.label)}</span>
        <span style="color:${C.ink};font-weight:600;text-align:right;${mono ? 'font-family:monospace;' : ''}">${escapeHtml(row.value)}</span>
      </div>`,
    )
    .join('')
}

// Büyük harfe çevirme CSS'e bırakılmaz: `text-transform` Türkçe i/İ ayrımını
// bilmez, "Üretici teyidi" başlığını "ÜRETICI TEYIDI" diye basar.
function sectionTitle(text: string): string {
  return `<h2 style="font-size:11px;font-weight:800;margin:0 0 6px 0;color:${C.ink};letter-spacing:0.6px;">${escapeHtml(text.toLocaleUpperCase('tr-TR'))}</h2>`
}

/** Belgenin HTML gövdesi. `logoSrc` verilmezse logo çizilmez. */
export function buildOrderConfirmationHtml(model: OrderConfirmationModel, logoSrc?: string): string {
  const steps = model.steps
    .map(
      (step, index) => `
      <div style="flex:1;min-width:0;">
        <div style="font-size:10px;font-weight:800;color:${C.gold};">${index + 1}</div>
        <div style="font-size:11px;font-weight:700;color:${C.ink};">${escapeHtml(step.title)}</div>
        <div style="font-size:9.5px;color:${C.text};line-height:1.35;">${escapeHtml(step.detail)}</div>
      </div>`,
    )
    .join('')

  const firstVehicle = model.firstVehicle
    ? `
      <div style="margin-top:8px;background:${C.goldSoft};border-left:4px solid ${C.gold};padding:8px 12px;border-radius:0 4px 4px 0;">
        <div style="font-size:12px;font-weight:800;color:${C.ink};">${escapeHtml(model.firstVehicle.headline)}</div>
        <div style="font-size:10px;color:${C.text};margin-top:2px;">${escapeHtml(model.firstVehicle.note)}</div>
      </div>`
    : ''

  const meetingPoint = model.meetingPointLine
    ? `<p style="font-size:10.5px;color:${C.text};margin:10px 0 0 0;">${escapeHtml(model.meetingPointLine)}</p>`
    : ''

  const reference = model.reference
    ? `
      <div style="margin-top:16px;">
        ${sectionTitle('Referans')}
        <div style="font-size:11px;color:${C.ink};">
          <b>${escapeHtml(model.reference.name)}</b> · ${escapeHtml(model.reference.detail)} · ${escapeHtml(model.reference.phone)}
        </div>
      </div>`
    : ''

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:2px solid ${C.ink};">
      ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" style="height:50px;width:auto;" onerror="this.style.display='none'" />` : '<span></span>'}
      <div style="text-align:right;font-size:11px;color:${C.text};line-height:1.5;">
        <div style="font-weight:700;color:${C.ink};">${escapeHtml(model.sellerName)}</div>
        <div>${escapeHtml(model.sellerAddress)}</div>
        <div><span style="font-weight:600;">Tel:</span> ${escapeHtml(model.sellerPhone)}</div>
        <div><span style="font-weight:600;">Teklif:</span> ${escapeHtml(model.quoteSite)} | <span style="font-weight:600;">Kurumsal:</span> ${escapeHtml(model.corporateSite)}</div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:14px;padding-bottom:10px;border-bottom:1px solid ${C.rule};">
      <div>
        <h1 style="margin:0 0 2px 0;font-size:18px;font-weight:800;color:${C.ink};letter-spacing:-0.3px;">SİPARİŞ ONAY FORMU</h1>
        <div style="font-size:12px;font-weight:700;color:${C.gold};">Teklif No: ${escapeHtml(model.quoteCode)}</div>
      </div>
      <div style="font-size:11px;color:${C.text};">Tarih: <b>${escapeHtml(model.issuedOn)}</b></div>
    </div>

    <div style="display:flex;gap:28px;margin-top:16px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        ${sectionTitle('Sipariş')}
        ${rowsHtml(model.orderRows)}
        ${firstVehicle}
      </div>
      <div style="flex:1;min-width:0;">
        ${sectionTitle('Satıcı ve ödeme alıcısı')}
        <div style="border:1px solid ${C.rule};border-radius:6px;padding:8px 10px;background:${C.panel};">
          ${rowsHtml(model.accountRows)}
          ${rowsHtml(model.bankRows, true)}
        </div>
        <p style="font-size:10px;color:${C.text};margin:6px 0 0 0;">${escapeHtml(model.accountNote)}</p>
        <p style="font-size:10px;color:${C.text};margin:4px 0 0 0;">${escapeHtml(model.paymentLine)}</p>
      </div>
    </div>

    <div style="margin-top:16px;">
      ${sectionTitle('Üretici teyidi')}
      ${model.manufacturerLines.map((line) => `<p style="font-size:11px;color:${C.ink};margin:0 0 4px 0;">${escapeHtml(line)}</p>`).join('')}
    </div>

    <div style="margin-top:16px;">
      ${sectionTitle('Siparişten teslime')}
      <div style="display:flex;gap:12px;align-items:flex-start;border:1px solid ${C.rule};border-radius:6px;padding:10px 12px;">
        ${steps}
      </div>
      ${meetingPoint}
    </div>

    ${reference}

    <div style="margin-top:22px;padding-top:12px;border-top:1px solid ${C.rule};">
      ${sectionTitle('Müşteri onayı')}
      <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:16px;">
        <div>
          <div style="font-size:9px;color:${C.muted};margin-bottom:2px;">İsim - Soyisim / Unvan</div>
          <div style="border-bottom:1px solid ${C.rule};height:26px;"></div>
        </div>
        <div>
          <div style="font-size:9px;color:${C.muted};margin-bottom:2px;">Tarih</div>
          <div style="border-bottom:1px solid ${C.rule};height:26px;"></div>
        </div>
        <div>
          <div style="font-size:9px;color:${C.muted};margin-bottom:2px;">İmza ve kaşe</div>
          <div style="border-bottom:1px solid ${C.rule};height:26px;"></div>
        </div>
      </div>
    </div>
  `
}

export function orderConfirmationFileName(quoteCode: string): string {
  const safe = quoteCode.replace(/[^a-zA-Z0-9-]/gu, '')
  return `TY-Siparis-Onay_${safe || 'teklif'}.pdf`
}

import { BUSINESS_INFO, TEL_URL, WHATSAPP_URL } from '@/lib/business/info'
import { resolveNetM2Price } from '@/lib/pdf/m2Price'
import { ORDER_PROCESS_TEXT, SELLER_BANK_ACCOUNTS } from '@/lib/pdf/orderProcess'
import { LEAD_TIME_LABEL, LEAD_TIME_NOTE, showsLeadTime } from '@/lib/sales/leadTime'
import { buildPortfolioPdfItems } from '@/lib/pdf/portfolioSection'
import { collapseRepeatedWords } from '@/lib/catalog/productLabel'
import { buildAccountIdentityRows, getQuoteContact, getSellerIdentity } from '@/lib/pdf/sellerIdentity'
import type { PDFQuoteData, PDFQuoteItem } from '@/lib/pdfGenerator'
import type { ShippingMode } from '@/lib/pricing/commercialRules'
import { formatTechnicalConsumption } from '@/lib/quote/technicalConsumption'
import { formatDay } from '@/lib/quote/validity'

// ============================================================
// Teklif PDF'i — belge blokları
// ============================================================
//
// Şablon, yuvarlak masada (Emrah, Astra, Opus; 13 Ekim 2026) kabul edilen
// sürümdür: reports/teklif-formu-cro-2026-10-13/pdf-yuvarlak-masasi.md
//
//   - Üst bölüm alçı teklif şablonundan uyarlandı (renk dizilimi, düzen).
//   - Dört rakam üstte EŞİT ağırlıkta: toplam fiyat, toplam metraj,
//     m² fiyatı KDV dahil, m² fiyatı KDV hariç. 24 Temmuz 2026'daki
//     "Toplam Metraj büyük" kararının yerine geçer.
//   - Önce döküm, sonra diğer bilgiler: tablo ve toplam üst bölümün hemen
//     altındadır; süreç, ödeme ve bayilik onlardan sonra gelir.
//   - Geçerlilik günle yazılır: "… günü sonuna kadar geçerlidir".
//
// Bu dosya yalnız metin üretir; tarayıcıya ihtiyaç duymaz. Blokların
// sayfalara bölünmesi lib/pdf/quotePagination.ts, resme çevrilmesi
// lib/pdfGenerator.ts içindedir.
// ============================================================

/** Ofis teklifinde ayrı kalem olarak yazılan nakliye satırının adı. */
export const SHIPPING_LINE_DESCRIPTION = 'Nakliye'

export interface QuoteDocumentOptions {
  /** `buildQrOrderLink` bağlantısının karekodu (data URL). */
  qrDataUrl: string
  /** Belgenin düzenlendiği an; verilmezse şimdi. */
  issuedAt?: Date
}

export interface QuoteDocumentParts {
  /** Tek kalemli teklif: sıkı düzen, tek sayfa hedefi. */
  single: boolean
  header: string
  footer: string
  /** İkinci ve sonraki sayfaların başındaki bağlam satırı. */
  context: string
  /** Sırayla sayfalara yerleşen bloklar. */
  flow: string[]
  /** Döküm sonraki sayfaya taşarsa tablo başlığı yeniden basılır. */
  tableHead: string
  continuationTitle: string
}

export function escapeHtml(input: string): string {
  if (!input) return ''
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const fmtMoney = (v: number) => `${v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
const fmtQty = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/**
 * Karekodun taşıdığı sipariş bağlantısı. Düğmedeki bağlantı ürün, metraj ve
 * fiyat satırlarıyla uzundur; karekoda konursa kod sıklaşır ve kâğıttan
 * okunmaz (88 px'te modül başına ~0,23 mm). Karekod yalnız teklif numarasını
 * taşır: aynı numara, aynı WhatsApp hattı, kısa mesaj (~0,44 mm).
 */
export function buildQrOrderLink(refCode: string): string {
  const message = `Merhaba, ${refCode} numaralı teklif için siparişe geçmek istiyorum.`
  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`
}

/** Müşterinin yazdığı cep numarasını okunur biçimde basar: 05553631803 → 0555 363 18 03. */
export function formatPhoneForDisplay(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('90') ? `0${digits.slice(2)}` : digits.length === 10 ? `0${digits}` : digits
  if (local.length !== 11 || !local.startsWith('0')) return phone
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 9)} ${local.slice(9)}`
}

const block = (kind: string, html: string) => `<section class="tq-block tq-${kind}" data-kind="${kind}">${html}</section>`

// Simgeler resim olarak gömülür: html2canvas stil dosyasındaki çizgi rengini
// satır içi SVG'ye taşımaz.
const icon = (path: string) =>
  `<img alt="" src="data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#9CCDB0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`,
  )}">`

const ICONS = {
  set: 'M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7M12 11v10',
  truck: 'M2 7h11v9H2zM13 10h4l3 3v3h-7zM6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
  pin: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  down: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  tool: 'M14 6l4 4M3 21l9-9M15 3l6 6-3 3-6-6z',
}

const BRAND_LOGOS = [
  { name: 'Filli Boya', src: '/images/markalogolar/strip/filli-boya.webp' },
  { name: 'Dalmaçyalı', src: '/images/markalogolar/strip/dalmacyali.webp' },
  { name: 'Fawori', src: '/images/markalogolar/strip/fawori.webp' },
  { name: 'Bonus', src: '/images/markalogolar/bonus-logo-red.svg' },
]

type QuoteScope = 'set' | 'single' | 'list'

/**
 * Teklifin kapsamı. Sihirbaz paketi levha ve toz grubu markasıyla gelir;
 * ürün sayfası tek kalem yazar; ofis teklifi serbest kalem listesidir.
 */
function quoteScope(data: PDFQuoteData): QuoteScope {
  if (data.items.length === 1) return 'single'
  return data.accessoryBrandName && data.accessoryBrandName !== '-' ? 'set' : 'list'
}

interface ShippingCopy {
  /** Kapsam kutucuğundaki kısa değer. */
  tile: string
  /** Kapsam cümlesi. */
  sentence: string
  /** Nakliye teklif toplamının içinde mi. */
  inTotal: boolean
}

function shippingCopy(mode: ShippingMode, city: string, hasShippingLine: boolean): ShippingCopy {
  // Ofis teklifinde nakliye ayrı kalem yazıldıysa toplamın içindedir;
  // "alıcıya ait, toplama dahil değil" demek yanlış olur.
  if (hasShippingLine) {
    return { tile: 'Ayrı kalem', sentence: 'Nakliye dökümde ayrı kalem olarak yer alır.', inTotal: true }
  }
  if (mode === 'included_in_sale_price') {
    return {
      tile: 'Fiyata dahil',
      sentence: city ? `Bu teklifin ${city} teslimine nakliye dahildir.` : 'Nakliye teklif fiyatına dahildir.',
      inTotal: true,
    }
  }
  if (mode === 'separate_quote_required') {
    return {
      tile: 'Görüşmede netleşir',
      sentence: 'Nakliye satış görüşmesinde netleşir; teklif toplamına dahil değildir.',
      inTotal: false,
    }
  }
  return { tile: 'Alıcıya ait', sentence: 'Nakliye alıcıya aittir; teklif toplamına dahil değildir.', inTotal: false }
}

function rowHtml(it: PDFQuoteItem, index: number): string {
  // 0 TL "pakete dahil" demektir. Levhada 0 görünürse hata anlaşılsın diye
  // fiyat basılır. NEGATİF fiyat paket içeriği DEĞİLDİR: ofis teklifinde
  // iskonto negatif kalem olarak yazılabilir ve tutarıyla görünmelidir.
  const isZeroPrice = it.unitPrice >= 0 && it.unitPrice < 0.01 && !it.isPlate

  // Paket bilgisi yoksa "(0 PKT)" yazmak yanlış bilgi olur; hiç yazılmaz.
  const description = it.isPlate && (it.packageCount ?? 0) > 0
    ? `${it.description} (${it.packageCount} PKT)`
    : it.description

  // Levha kendi alanını kaplar; "1 m²/m²" bilgi taşımaz, yazılmaz.
  const consumption = it.isPlate ? '—' : formatTechnicalConsumption(it.consumptionRate, it.consumptionUnit)
  const detail = consumption === '—' ? '' : `<small>m² sarfiyatı: ${escapeHtml(consumption)}</small>`

  const unitPrice = isZeroPrice ? '<span class="tq-in-package">Pakete dahil</span>' : escapeHtml(fmtMoney(it.unitPrice))
  const total = isZeroPrice ? '—' : `<b>${escapeHtml(fmtMoney(it.totalPrice))}</b>`

  return `<tr><td><div class="tq-row-name"><span class="tq-row-no">${index + 1}</span><div><b>${escapeHtml(description)}</b>${detail}</div></div></td><td>${escapeHtml(fmtQty(it.quantity))}<small>${escapeHtml(it.unit)}</small></td><td>${unitPrice}</td><td>${total}</td></tr>`
}

export function buildQuoteDocument(input: PDFQuoteData, options: QuoteDocumentOptions): QuoteDocumentParts {
  // Ürün adı belgeye tek kez yazılır: eski kayıtlardaki ya da gözden kaçan
  // bir birleştirmedeki "Optimix Optimix Karbonlu" tekrarı burada kesilir.
  const data: PDFQuoteData = {
    ...input,
    systemDescription: collapseRepeatedWords(input.systemDescription),
    packageName: collapseRepeatedWords(input.packageName),
    items: input.items.map((it) => ({ ...it, description: collapseRepeatedWords(it.description) })),
  }
  const seller = getSellerIdentity()
  const contact = getQuoteContact()
  const scope = quoteScope(data)
  const single = scope === 'single'

  const metrajValue = typeof data.metraj === 'string' ? Number(data.metraj) || 0 : data.metraj
  // m² fiyatı (KDV hariç taban): veride yoksa KDV HARİÇ ara toplamdan hesaplanır.
  const calculatedM2Price = resolveNetM2Price(data, metrajValue)
  // Metraj: levha kalemi varsa teslim edilen alan (paket katına yuvarlanmış), yoksa girilen metraj.
  const firstItem = data.items[0]
  const area = firstItem?.isPlate && firstItem.quantity > 0 ? firstItem.quantity : metrajValue

  const materialLabel = data.materialType === 'tasyunu' ? 'Taşyünü' : 'EPS'
  const product = data.systemDescription || `${materialLabel} ${data.thickness} cm`
  const customer = data.customerCompany || data.relatedPerson
  const city = data.city || data.cityName || ''
  const place = data.district && `${city} / ${data.district}`.length <= 22 ? `${city} / ${data.district}` : city

  const shippingMode: ShippingMode = data.shippingMode
    ?? (data.isShippingIncluded ? 'included_in_sale_price' : 'buyer_pays')
  const isShippingLine = (it: PDFQuoteItem) => !it.isPlate && it.description === SHIPPING_LINE_DESCRIPTION && it.totalPrice > 0
  const hasShippingLine = data.items.some(isShippingLine)
  // Nakliye satırı malzeme kalemi değildir; kalem sayısına girmez.
  const itemCount = data.items.filter((it) => !isShippingLine(it)).length
  const shipping = shippingCopy(shippingMode, city, hasShippingLine)
  const m2Note = shipping.inTotal ? 'Nakliye dahil' : 'Nakliye hariç'
  const m2Value = (value: number) => (value > 0 ? escapeHtml(fmtMoney(value)) : '—')

  const wa = escapeHtml(data.whatsappOrderLink)
  const qrLink = escapeHtml(buildQrOrderLink(data.refCode))
  const ref = escapeHtml(data.refCode)
  const total = escapeHtml(fmtMoney(data.grandTotal))
  const issuedDay = formatDay(options.issuedAt ?? new Date())

  const title = scope === 'set'
    ? 'MANTOLAMA SETİ FİYAT TEKLİFİ'
    : single && firstItem?.isPlate
      ? 'LEVHA FİYAT TEKLİFİ'
      : 'FİYAT TEKLİFİ'
  const scopeLead = scope === 'set'
    ? `${itemCount} kalem komple mantolama seti.`
    : single
      ? (firstItem?.isPlate ? 'Levha tedariki.' : 'Malzeme tedariki.')
      : `${itemCount} kalem malzeme tedariki.`
  const scopeSentence = `<b>${scopeLead}</b> ${escapeHtml(shipping.sentence)} Şantiyede indirme alıcıya aittir. <b>Uygulama işçiliği dahil değildir.</b>`

  const scopeTile = scope === 'set'
    ? { value: `${itemCount} kalem`, label: 'KOMPLE SET' }
    : single
      ? { value: firstItem?.isPlate ? 'Levha' : '1 kalem', label: 'TEDARİK' }
      : { value: `${itemCount} kalem`, label: 'MALZEME' }

  // Ürün kartının alt satırı: sihirbazda paket adı; adı ürünü tekrarlıyorsa malzeme ve kalınlık.
  const productNote = data.packageName && !product.includes(data.packageName)
    ? `Paket: ${data.packageName}`
    : [materialLabel, data.thickness ? `${data.thickness} cm` : ''].filter(Boolean).join(' · ')
  const phone = formatPhoneForDisplay(data.phone)
  const customerNote = data.customerCompany && data.relatedPerson
    ? `<small>${escapeHtml(data.relatedPerson)}</small><small class="tq-nowrap">${escapeHtml(phone)}</small>`
    : `<small class="tq-nowrap">${escapeHtml(phone)}</small>`

  const validity = data.validityDate ? escapeHtml(data.validityDate) : ''

  // ── Sayfa çerçevesi ─────────────────────────────────────
  const header = `<header class="tq-header"><img class="tq-brand" src="/images/teklifpdf/logo_dark.png" alt="${escapeHtml(BUSINESS_INFO.legalName)}"><div class="tq-seller"><b>${escapeHtml(BUSINESS_INFO.legalName)}</b><span class="tq-dealer">Filli Boya ve Bonus yetkili bayisi</span><span>${escapeHtml(`${BUSINESS_INFO.address.streetAddress} · ${BUSINESS_INFO.address.addressLocality} / ${BUSINESS_INFO.address.addressRegion}`)}</span><span class="tq-seller-phone" data-pdf-link="${TEL_URL}">${escapeHtml(BUSINESS_INFO.phone.display)}</span></div></header>`

  const footer = `<footer class="tq-footer"><span><span data-pdf-link="${escapeHtml(BUSINESS_INFO.url)}">Teklif: ${escapeHtml(seller.quoteSite)}</span> · <span data-pdf-link="${escapeHtml(BUSINESS_INFO.corporateUrl)}">Kurumsal: ${escapeHtml(seller.corporateSite)}</span></span><span>${ref} · <i class="tq-page-number"></i></span></footer>`

  const context = `<div class="tq-context"><span>${escapeHtml(customer)} · ${escapeHtml(fmtQty(area))} m²${city ? ` · ${escapeHtml(city)}` : ''}</span><b>Genel toplam: ${total} · KDV dahil</b></div>`

  // ── Üst bölüm: başlık, dört eşit rakam, kapsam kutucukları, kart ──
  const intro = block('intro', `<div><h1>${title}</h1><p class="tq-ref">Teklif No: <b>${ref}</b></p></div><div class="tq-meta"><span>Düzenlenme: ${issuedDay}</span>${validity ? `<span class="tq-valid-pill"><i>GEÇERLİLİK</i>${validity}</span>` : ''}</div>`)

  const hero = block('hero', `<div class="tq-metrics">`
    + `<div class="tq-metric"><span>TOPLAM FİYAT</span><b class="tq-metric-value">${total}</b><small>KDV ${shipping.inTotal ? 've nakliye ' : ''}dahil</small></div>`
    + `<div class="tq-metric"><span>TOPLAM METRAJ</span><b class="tq-metric-value">${escapeHtml(fmtQty(area))} m²</b><small>${data.thickness ? `${escapeHtml(data.thickness)} cm ${escapeHtml(data.materialLongName || materialLabel)}` : 'Uygulama alanı'}</small></div>`
    + `<div class="tq-metric"><span>m² FİYATI · KDV DAHİL</span><b class="tq-metric-value">${m2Value(calculatedM2Price * 1.2)}</b><small>${m2Note}</small></div>`
    + `<div class="tq-metric"><span>m² FİYATI · KDV HARİÇ</span><b class="tq-metric-value">${m2Value(calculatedM2Price)}</b><small>${m2Note}</small></div>`
    + `</div><div class="tq-facts">`
    + `<div>${icon(ICONS.set)}<b>${scopeTile.value}</b><span>${scopeTile.label}</span></div>`
    + `<div>${icon(ICONS.truck)}<b>${shipping.tile}</b><span>NAKLİYE</span></div>`
    + `<div>${icon(ICONS.pin)}<b>${escapeHtml(place || '—')}</b><span>TESLİM YERİ</span></div>`
    + `<div>${icon(ICONS.down)}<b>Alıcıya ait</b><span>İNDİRME</span></div>`
    + `<div>${icon(ICONS.tool)}<b>Dahil değil</b><span>UYGULAMA İŞÇİLİĞİ</span></div>`
    + `</div>`)

  const info = block('info', `<div><span>MÜŞTERİ</span><b>${escapeHtml(customer)}</b>${customerNote}</div>`
    + `<div><span>ÜRÜN</span><b>${escapeHtml(product)}</b><small>${escapeHtml(productNote)}</small></div>`
    + `<div><span>ARA TOPLAM · KDV HARİÇ</span><b>${escapeHtml(fmtMoney(data.priceWithoutVat))}</b><small>KDV (%20): ${escapeHtml(fmtMoney(data.vatAmount))}</small></div>`)

  // ── Döküm ve toplam ─────────────────────────────────────
  const tableHead = '<thead><tr><th>Ürün / ambalaj</th><th>Miktar</th><th>Birim fiyat<small>KDV hariç</small></th><th>Tutar<small>KDV hariç</small></th></tr></thead>'
  const rows = data.items.map(rowHtml).join('')
  const table = `<section class="tq-block tq-table" data-kind="table"><table>${tableHead}<tbody>${rows}</tbody></table></section>`

  const totals = block('total', `<p>${scopeSentence} Birim fiyatlar ve satır tutarları KDV hariçtir.</p><dl>`
    + `<div><dt>Ara toplam · KDV hariç</dt><dd>${escapeHtml(fmtMoney(data.priceWithoutVat))}</dd></div>`
    + `<div><dt>KDV (%20)</dt><dd>${escapeHtml(fmtMoney(data.vatAmount))}</dd></div>`
    + `<div><dt>Genel toplam · KDV dahil</dt><dd>${total}</dd></div></dl>`)

  const notices = [
    data.shippingWarning ? `<p>${escapeHtml(data.shippingWarning)}</p>` : '',
    data.specialOrderNote ? `<p><b>Büyük metraj, özel teklif:</b> ${escapeHtml(data.specialOrderNote)}</p>` : '',
  ].filter(Boolean)
  const notice = notices.length ? [block('notice', notices.join(''))] : []

  // ── Eylem: tek metinli sipariş çağrısı, hazırlayan, geçerlilik, karekod ──
  const action = block('action', `<div class="tq-action-copy"><h2>Teklifiniz üzerinden siparişe geçelim.</h2>`
    + `<div class="tq-action-row"><span class="tq-cta" data-pdf-link="${wa}">Sipariş için WhatsApp’tan yazın</span><span class="tq-action-phone">Veya arayın: <b data-pdf-link="${TEL_URL}">${escapeHtml(BUSINESS_INFO.phone.display)}</b></span></div>`
    + `<p class="tq-prepared"><b>Teklifi hazırlayan:</b> ${escapeHtml(contact.name)} · ${escapeHtml(contact.phone)}</p>`
    + (validity ? `<p class="tq-validity">Fiyatlar ${validity} günü sonuna kadar geçerlidir. Süre dolduktan sonra güncel fiyat teyit edilir.</p>` : '')
    + `</div><div class="tq-qr" data-pdf-link="${qrLink}"><img data-pdf-qr src="${options.qrDataUrl}" alt=""><span>Basılı belgede okutun</span></div>`)

  // ── Süreç, ödeme, bayilik ───────────────────────────────
  const steps = [
    { title: '1. Onay ve ödeme', detail: 'Sipariş Onay Formu düzenlenir; ödeme tek seferde alınır.' },
    { title: '2. Üretici teyidi', detail: ORDER_PROCESS_TEXT.manufacturerOrder },
    {
      title: '3. Sevkiyat planı',
      detail: showsLeadTime(data.materialType)
        ? `${LEAD_TIME_LABEL} (sipariş onayından teslime). ${LEAD_TIME_NOTE} ${ORDER_PROCESS_TEXT.shippingPlan}`
        : ORDER_PROCESS_TEXT.shippingPlan,
    },
    { title: '4. Teslim', detail: 'Araç yola çıktığında bilgi verilir; ürün şantiyeye teslim edilir.' },
  ]
  const process = block('process', `<h2>Sipariş nasıl ilerler?</h2><div class="tq-steps">${steps.map((s) => `<div><b>${s.title}</b><p>${escapeHtml(s.detail)}</p></div>`).join('')}</div>`)

  const accountRows = buildAccountIdentityRows(seller)
    .map((row) => `<p><b>${escapeHtml(row.label)}:</b> ${escapeHtml(row.value)}</p>`)
    .join('')
  const bankRows = SELLER_BANK_ACCOUNTS
    .map((b) => `<div class="tq-bank-row"><b>${escapeHtml(b.label)}</b><span class="tq-iban">${b.iban}</span></div>`)
    .join('')
  const payment = block('payment', `<div class="tq-section-head"><h2>Ödeme ve hesap bilgileri</h2><span>Kredi kartı veya banka havalesi</span></div>`
    + `<p>${escapeHtml(ORDER_PROCESS_TEXT.paymentRule)}</p><div class="tq-account">${accountRows}</div>${bankRows}`
    + `<p class="tq-hint">${escapeHtml(ORDER_PROCESS_TEXT.accountCheck)} Havale açıklamasına teklif numaranızı yazabilirsiniz.</p>`)

  const trust = block('trust', `<div><b>Filli Boya ve Bonus yetkili bayisiyiz.</b><p>Dalmaçyalı ve Fawori, Filli Boya ürün grubundadır.<br>${escapeHtml(ORDER_PROCESS_TEXT.dealership)}</p></div>`
    + `<div class="tq-logos">${BRAND_LOGOS.map((l) => `<img src="${l.src}" alt="${l.name}">`).join('')}</div>`)

  // ── Alçı ve alçıpan: ayrı malzeme teklifleri ─────────────
  // Sayfa resim olarak basıldığı için bağlantı alanları ayrıca işaretlenir
  // (data-pdf-link); adres basılı kopyada elle girilebilsin diye yazılıdır.
  const offers = buildPortfolioPdfItems()
    .map((item) => `<div><h3>${escapeHtml(item.title)}</h3><b class="tq-cross-price">${escapeHtml(item.amount)}</b><p>${escapeHtml(item.product)}</p>`
      + (!single && item.vehicle ? `<p>${escapeHtml(item.vehicle)}</p>` : '')
      + `<p>${escapeHtml(item.priceTerms)}${single ? '' : ` · Liste: ${escapeHtml(item.listDate)}`}</p>`
      + `<span class="tq-cross-link" data-pdf-link="${escapeHtml(item.href)}"><b>${escapeHtml(item.cta)}</b><small>${escapeHtml(item.linkLabel)}</small></span></div>`)
    .join('')
  const cross = block('cross', `<div class="tq-section-head"><h2>Alçı ve alçıpan da lazım mı?</h2><span>Ayrı malzeme teklifleri</span></div><div class="tq-cross-grid">${offers}</div><p class="tq-cross-note">Bu teklifin toplamına dahil değildir.</p>`)

  const contactLine = block('contact', `<span>${escapeHtml(customer)} · ${ref}</span><b data-pdf-link="${wa}">Sipariş için WhatsApp’tan yazın</b>`)

  const continuationTitle = `<section class="tq-block tq-continuation" data-kind="continuation"><p class="tq-eyebrow">MALZEME DÖKÜMÜ · DEVAM · ${ref}</p></section>`

  // Önce döküm, sonra diğer bilgiler. Tek kalemli teklifte toplam üst
  // bölümdeki kartta zaten yazılıdır; kapsam cümlesi tablonun üstünde kalır
  // ve belge tek sayfaya sığar.
  const flow = single
    ? [intro, hero, info, block('scope', `<p>${scopeSentence}</p>`), table, ...notice, action, process, payment, trust, cross]
    : [intro, hero, info, table, totals, ...notice, action, process, payment, trust, cross, contactLine]

  return { single, header, footer, context, flow, tableHead, continuationTitle }
}

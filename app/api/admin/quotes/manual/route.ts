import { NextRequest, NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth'
import { createPdfCapabilityToken, assertPdfCapabilityConfigured } from '@/lib/security/pdfCapability'
import { buildQuoteTotals, roundToKurus } from '@/lib/pricing/quoteTotals'
import { validateMinimumOrder } from '@/lib/pricing/commercialRules'
import {
  manualQuoteSchema,
  discountedUnitPrice,
  effectiveLineTotal,
  lineTotal,
  type ManualQuoteInput,
} from '@/lib/schemas/manualQuote.schema'

export const dynamic = 'force-dynamic'

// Elle yazılan teklifin kayıt yolu.
//
// `submit_quote_guarded` RPC'si BİLEREK kullanılmıyor: hız limiti (IP 5/10dk,
// telefon 3/30dk), 30 dk dedupe ve zorunlu `kvkk_consent=true` operatör
// akışıyla bağdaşmıyor. Bunun yerine service-role ile doğrudan insert +
// kendi doğrulaması. Public ciro yolu (app/api/quotes) hiç değişmiyor.
//
// Para güvenliği: tarayıcının hesabına GÜVENİLMEZ. Toplam sunucuda yeniden
// hesaplanır ve istemcinin gönderdiğiyle 2 kuruştan fazla saparsa reddedilir.

const TOLERANCE = 0.02
const PDF_UPLOAD_TTL_SECONDS = 600

/** TE-2026-XXXXXX — wizard'ın TY önekinden ayrı, çakışma uzayı bağımsız. */
function buildManualQuoteCode(quoteId: number, now: Date): string {
  return `TE-${now.getFullYear()}-${String(quoteId).padStart(6, '0')}`
}

/** Önceki sürümün izi — revizede eski tutar ve PDF kaybolmasın diye. */
interface RevisionEntry {
  no: number
  at: string
  by: string
  areaM2: number
  priceWithoutVat: number
  totalPrice: number
  /** Önceki sürümün arşivdeki PDF'i; dosya storage'da kalır. */
  pdfStoragePath: string | null
}

type ParseResult =
  | { ok: true; data: ManualQuoteInput }
  | { ok: false; response: NextResponse }

function parseBody(body: unknown): ParseResult {
  const parsed = manualQuoteSchema.safeParse(body)
  if (parsed.success) return { ok: true, data: parsed.data }
  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        error: 'Teklif verisi doğrulanamadı.',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    ),
  }
}

// ── Sunucu tarafı para hesabı ──
// İskonto BİRİM FİYATLARA işlenir (27 Tem 2026 kararı); belgenin altına
// ayrı eksi satır yazılmaz. Böylece satır tutarlarının toplamı ara
// toplamı birebir verir.
function computeTotals(d: ManualQuoteInput) {
  const listeToplami = roundToKurus(d.lines.reduce((sum, l) => sum + lineTotal(l), 0))
  const netToplam = roundToKurus(
    d.lines.reduce((sum, l) => sum + effectiveLineTotal(l, d.discountPct), 0),
  )
  return { listeToplami, totals: buildQuoteTotals(netToplam, d.shippingCharge) }
}

function totalMismatchResponse(
  d: ManualQuoteInput,
  totals: ReturnType<typeof buildQuoteTotals>,
): NextResponse | null {
  if (Math.abs(totals.priceWithoutVat - d.expectedPriceWithoutVat) <= TOLERANCE) return null
  return NextResponse.json(
    {
      ok: false,
      error: `Toplam tutarsız — sunucu ${totals.priceWithoutVat.toFixed(2)} ₺ hesapladı, ekran ${d.expectedPriceWithoutVat.toFixed(2)} ₺ gönderdi. Sayfayı yenileyip tekrar deneyin.`,
    },
    { status: 409 },
  )
}

// ── Ticari kural: engellemez, uyarır ──
async function commercialWarnings(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  d: ManualQuoteInput,
): Promise<string[]> {
  const warnings: string[] = []
  const { data: materialRow } = await supabase
    .from('material_types')
    .select('slug, min_order_m2')
    .eq('slug', d.materialType === 'karma' ? 'eps' : d.materialType)
    .maybeSingle()

  if (materialRow?.min_order_m2 != null) {
    const check = validateMinimumOrder(d.areaM2, Number(materialRow.min_order_m2))
    if (!check.ok) {
      warnings.push(
        `Minimum sipariş ${materialRow.min_order_m2} m² — bu teklif ${d.areaM2} m².`,
      )
    }
  }
  return warnings
}

function overrideRequiredResponse(warnings: string[]): NextResponse {
  return NextResponse.json(
    { ok: false, error: 'Ticari kural uyarısı var.', warnings, needsOverride: true },
    { status: 422 },
  )
}

/**
 * Teklifin içeriğini taşıyan kolonlar — yeni kayıtta da revizede de aynı.
 *
 * NOT NULL kolonların hepsi doldurulmalı; levha içermeyen tekliflerde
 * dürüst varsayılanlar kullanılır (uydurma değer yazılmaz, "—" konur).
 */
function buildContentColumns(
  d: ManualQuoteInput,
  input: {
    listeToplami: number
    totals: ReturnType<typeof buildQuoteTotals>
    createdBy: string
    revisions?: RevisionEntry[]
  },
) {
  const { listeToplami, totals } = input
  const plateLine = d.lines.find((l) => l.isPlate) ?? null

  const packageItems = {
    items: d.lines.map((l, i) => ({
      lineNo: i + 1,
      kind: l.kind,
      catalogKey: l.catalogKey ?? null,
      name: l.description,
      quantity: l.quantity,
      unit: l.unit,
      // Kayıt belgeyle aynı olsun: iskonto işlenmiş birim fiyat yazılır,
      // liste fiyatı ayrıca saklanır.
      unitPrice: discountedUnitPrice(l.unitPrice, d.discountPct),
      listUnitPrice: l.unitPrice,
      lineDiscountPct: l.lineDiscountPct,
      totalPrice: effectiveLineTotal(l, d.discountPct),
      isPlate: l.isPlate,
      // Revizede dübel boyu seçimi kalınlığa bakar; kayıtta olmazsa
      // yüklenen teklif kalınlığını kaybeder.
      thicknessCm: l.thicknessCm ?? null,
      packageCount: l.packageCount ?? null,
      note: l.note ?? null,
      // Maliyet dayanağı — yalnız kayıtta. "Bu fiyatı neden verdik" ve
      // "teklifi çoğalt, metrajı değiştir" bu alanlarla cevaplanır.
      netCost: l.netCost ?? null,
      consumptionRate: l.consumptionRate ?? null,
      consumptionUnit: l.consumptionUnit ?? null,
      unitContent: l.unitContent ?? null,
    })),
    manual: {
      title: d.title ?? null,
      notes: d.notes ?? null,
      discountPct: d.discountPct,
      listTotal: listeToplami,
      shippingCharge: d.shippingCharge,
      // Nakliyenin belgedeki sunumu — revizede aynı seçimle açılsın diye.
      shippingMode: d.shippingMode,
      validityDays: d.validityDays,
      createdBy: input.createdBy,
      // Teklifin üretildiği marj — 27 Tem 2026'da bu bilgi kayıtta
      // olmadığı için bir fiyatın kaynağı tersine mühendislikle bulundu.
      appliedMarginPct: d.appliedMarginPct ?? null,
      areaM2: d.areaM2,
      ...(input.revisions && input.revisions.length > 0
        ? { revisionNo: input.revisions.length, revisions: input.revisions }
        : {}),
    },
  }

  return {
    customer_name: d.customerName,
    customer_email: d.customerEmail || '',
    customer_phone: d.customerPhone,
    customer_company: d.customerCompany || null,
    customer_address: d.customerAddress || null,

    material_type: d.materialType,
    brand_name: plateLine?.description.split(' ')[0] || '—',
    model_name: plateLine?.description ?? null,
    thickness_cm: Math.round(plateLine?.thicknessCm ?? 0),
    area_m2: d.areaM2,
    city_code: d.cityCode,
    city_name: d.cityName,

    package_name: d.title || 'Ofis teklifi',
    package_description: d.notes || null,
    plate_brand_name: plateLine ? plateLine.description.split(' ')[0] : '—',
    accessory_brand_name: '—',

    total_price: totals.totalPrice,
    price_per_m2: roundToKurus(totals.priceWithoutVat / d.areaM2),
    shipping_cost: d.shippingCharge,
    discount_percentage: d.discountPct,
    price_without_vat: totals.priceWithoutVat,
    vat_amount: totals.vatAmount,

    package_count: plateLine?.packageCount ?? 0,
    package_size_m2: 0,
    items_per_package: 0,
    vehicle_type: null,

    package_items: packageItems,
    consent_channel: d.consentChannel,
  }
}

/** PDF yükleme yetkisi — public akışla aynı capability mekanizması. */
function issuePdfUploadCapability(quoteId: number, now: Date): string | null {
  try {
    assertPdfCapabilityConfigured()
    return createPdfCapabilityToken({
      quoteId,
      action: 'upload',
      expiresAt: Math.floor(now.getTime() / 1000) + PDF_UPLOAD_TTL_SECONDS,
    })
  } catch {
    // PDF yükleme yapılandırılmamışsa teklif yine kaydedilmiş olur;
    // operatör PDF'i elle indirebilir.
    return null
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = parseBody(body)
  if (!parsed.ok) return parsed.response
  const d = parsed.data

  const { listeToplami, totals } = computeTotals(d)
  const mismatch = totalMismatchResponse(d, totals)
  if (mismatch) return mismatch

  const supabase = createServerSupabaseClient()
  const warnings = await commercialWarnings(supabase, d)
  if (warnings.length > 0 && !d.overrideCommercialRules) {
    return overrideRequiredResponse(warnings)
  }

  const now = new Date()
  const insertPayload = {
    ...buildContentColumns(d, { listeToplami, totals, createdBy: auth.user }),

    request_type: 'manual_quote',
    source_channel: 'ofis',
    status: 'quoted',

    // KVKK: açık rıza YOK; dayanak sözleşme hazırlığı (m.5/2-c).
    kvkk_consent: false,
    consent_timestamp: now.toISOString(),
    consent_version: 'kvkk-ofis-v1',
    consent_purpose: 'fiyat_teklifi_ve_iletisim',

    quoted_by: auth.user,
    admin_notes: d.overrideReason ? `Kural aşımı: ${d.overrideReason}` : null,
  }

  const { data: created, error } = await supabase
    .from('quotes')
    .insert(insertPayload)
    .select('id, created_at')
    .single()

  if (error || !created) {
    console.error('Elle teklif kaydedilemedi:', error?.message)
    return NextResponse.json(
      { ok: false, error: 'Teklif kaydedilemedi.' },
      { status: 500 },
    )
  }

  // Kod sunucuda üretilir (wizard'da istemci üretiyor ve benzersizlik
  // garantisi yok); TE öneki çakışma uzayını tamamen ayırır.
  const quoteCode = buildManualQuoteCode(created.id, now)
  await supabase.from('quotes').update({ quote_code: quoteCode }).eq('id', created.id)

  return NextResponse.json(
    {
      ok: true,
      quoteId: created.id,
      quoteCode,
      totals,
      warnings,
      pdfUploadCapability: issuePdfUploadCapability(created.id, now),
    },
    { status: 201 },
  )
}

// Teklif revizyonu — var olan ofis teklifini YERİNDE günceller.
//
// NEDEN: 8 Ekim 2026'da iki teklif yanlış metrajla (1.008 m²) kaydedildi.
// Düzeltmenin tek yolu yeni teklif yazmaktı; müşteri aynı iş için iki ayrı
// numara görüyor, liste de çöp kayıtla doluyordu. Revizede teklif numarası
// DEĞİŞMEZ; önceki tutar, metraj ve PDF `manual.revisions` altında kalır.
//
// Yalnız ofis teklifleri (`manual_quote`) revize edilir. Sitedeki sihirbazdan
// gelen kayıt müşterinin kendi talebidir; onun üstüne yazılmaz, çoğaltılır.
export async function PUT(req: NextRequest) {
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const quoteId = Number((body as { quoteId?: unknown } | null)?.quoteId)
  if (!Number.isSafeInteger(quoteId) || quoteId <= 0) {
    return NextResponse.json(
      { ok: false, error: 'Geçersiz teklif kimliği.' },
      { status: 400 },
    )
  }

  const parsed = parseBody(body)
  if (!parsed.ok) return parsed.response
  const d = parsed.data

  const { listeToplami, totals } = computeTotals(d)
  const mismatch = totalMismatchResponse(d, totals)
  if (mismatch) return mismatch

  const supabase = createServerSupabaseClient()

  const { data: existing, error: readError } = await supabase
    .from('quotes')
    .select('id, request_type, quote_code, area_m2, price_without_vat, total_price, pdf_storage_path, package_items')
    .eq('id', quoteId)
    .maybeSingle()

  if (readError) {
    console.error('Revize edilecek teklif okunamadı:', readError.message)
    return NextResponse.json(
      { ok: false, error: 'Teklif okunamadı.' },
      { status: 500 },
    )
  }
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: 'Teklif bulunamadı.' },
      { status: 404 },
    )
  }
  if (existing.request_type !== 'manual_quote') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Yalnız ofis teklifleri revize edilebilir. Bu kaydı çoğaltıp yeni teklif yazın.',
      },
      { status: 409 },
    )
  }

  const warnings = await commercialWarnings(supabase, d)
  if (warnings.length > 0 && !d.overrideCommercialRules) {
    return overrideRequiredResponse(warnings)
  }

  const now = new Date()
  const oncekiManual = (existing.package_items as {
    manual?: { createdBy?: string; revisions?: RevisionEntry[] }
  } | null)?.manual
  const oncekiRevizyonlar = Array.isArray(oncekiManual?.revisions) ? oncekiManual.revisions : []
  const revisions: RevisionEntry[] = [
    ...oncekiRevizyonlar,
    {
      no: oncekiRevizyonlar.length + 1,
      at: now.toISOString(),
      by: auth.user,
      areaM2: Number(existing.area_m2 ?? 0),
      priceWithoutVat: Number(existing.price_without_vat ?? 0),
      totalPrice: Number(existing.total_price ?? 0),
      pdfStoragePath: existing.pdf_storage_path ?? null,
    },
  ]

  const updatePayload = {
    ...buildContentColumns(d, {
      listeToplami,
      totals,
      createdBy: oncekiManual?.createdBy ?? auth.user,
      revisions,
    }),
    updated_at: now.toISOString(),
    // Yeni PDF bağlanabilsin diye arşiv yolu boşaltılır (upload-pdf üzerine
    // yazmayı reddeder). Eski dosya silinmez; yolu revizyon kaydındadır.
    pdf_storage_path: null,
    pdf_url: null,
    ...(d.overrideReason ? { admin_notes: `Kural aşımı: ${d.overrideReason}` } : {}),
  }

  const { data: updated, error: updateError } = await supabase
    .from('quotes')
    .update(updatePayload)
    .eq('id', quoteId)
    .eq('request_type', 'manual_quote')
    .select('id, quote_code')
    .maybeSingle()

  if (updateError || !updated) {
    console.error('Teklif revize edilemedi:', updateError?.message ?? 'kayıt bulunamadı')
    return NextResponse.json(
      { ok: false, error: 'Teklif revize edilemedi.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    quoteId: updated.id,
    quoteCode: updated.quote_code ?? existing.quote_code,
    revisionNo: revisions.length,
    totals,
    warnings,
    pdfUploadCapability: issuePdfUploadCapability(updated.id, now),
  })
}

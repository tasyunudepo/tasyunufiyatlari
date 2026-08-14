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

export async function POST(req: NextRequest) {
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = manualQuoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Teklif verisi doğrulanamadı.',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }

  const d = parsed.data

  // ── Sunucu tarafı para hesabı ──
  // İskonto BİRİM FİYATLARA işlenir (27 Tem 2026 kararı); belgenin altına
  // ayrı eksi satır yazılmaz. Böylece satır tutarlarının toplamı ara
  // toplamı birebir verir.
  const listeToplami = roundToKurus(d.lines.reduce((sum, l) => sum + lineTotal(l), 0))
  const netToplam = roundToKurus(
    d.lines.reduce((sum, l) => sum + effectiveLineTotal(l, d.discountPct), 0),
  )
  const totals = buildQuoteTotals(netToplam, d.shippingCharge)

  if (Math.abs(totals.priceWithoutVat - d.expectedPriceWithoutVat) > TOLERANCE) {
    return NextResponse.json(
      {
        ok: false,
        error: `Toplam tutarsız — sunucu ${totals.priceWithoutVat.toFixed(2)} ₺ hesapladı, ekran ${d.expectedPriceWithoutVat.toFixed(2)} ₺ gönderdi. Sayfayı yenileyip tekrar deneyin.`,
      },
      { status: 409 },
    )
  }

  // ── Ticari kural: engellemez, uyarır ──
  const warnings: string[] = []
  const supabase = createServerSupabaseClient()

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

  if (warnings.length > 0 && !d.overrideCommercialRules) {
    return NextResponse.json(
      { ok: false, error: 'Ticari kural uyarısı var.', warnings, needsOverride: true },
      { status: 422 },
    )
  }

  // ── quotes satırı ──
  // NOT NULL kolonların hepsi doldurulmalı; levha içermeyen tekliflerde
  // dürüst varsayılanlar kullanılır (uydurma değer yazılmaz, "—" konur).
  const plateLine = d.lines.find((l) => l.isPlate) ?? null
  const now = new Date()

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
      validityDays: d.validityDays,
      createdBy: auth.user,
      // Teklifin üretildiği marj — 27 Tem 2026'da bu bilgi kayıtta
      // olmadığı için bir fiyatın kaynağı tersine mühendislikle bulundu.
      appliedMarginPct: d.appliedMarginPct ?? null,
      areaM2: d.areaM2,
    },
  }

  const insertPayload = {
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

    request_type: 'manual_quote',
    source_channel: 'ofis',
    status: 'quoted',

    // KVKK: açık rıza YOK; dayanak sözleşme hazırlığı (m.5/2-c).
    kvkk_consent: false,
    consent_timestamp: now.toISOString(),
    consent_version: 'kvkk-ofis-v1',
    consent_purpose: 'fiyat_teklifi_ve_iletisim',
    consent_channel: d.consentChannel,

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

  // PDF yükleme yetkisi — public akışla aynı capability mekanizması.
  let pdfUploadCapability: string | null = null
  try {
    assertPdfCapabilityConfigured()
    pdfUploadCapability = createPdfCapabilityToken({
      quoteId: created.id,
      action: 'upload',
      expiresAt: Math.floor(now.getTime() / 1000) + PDF_UPLOAD_TTL_SECONDS,
    })
  } catch {
    // PDF yükleme yapılandırılmamışsa teklif yine kaydedilmiş olur;
    // operatör PDF'i elle indirebilir.
    pdfUploadCapability = null
  }

  return NextResponse.json(
    {
      ok: true,
      quoteId: created.id,
      quoteCode,
      totals,
      warnings,
      pdfUploadCapability,
    },
    { status: 201 },
  )
}

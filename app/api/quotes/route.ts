import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { ZodError } from 'zod'

import { sendNotification, type LeadEventType } from '@/lib/notifications'
import {
  PdfCapabilityError,
  assertPdfCapabilityConfigured,
  createPdfCapabilityToken,
} from '@/lib/security/pdfCapability'
import {
  QuoteGuardInputError,
  buildQuoteFingerprint,
  getTrustedClientIp,
  hashGuardValue,
  normalizePhoneForGuard,
  readIdempotencyKey,
} from '@/lib/security/quoteSubmissionGuard'
import { apiQuoteSchema } from '@/lib/schemas/quote.schema'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  isValidFullVehicleArea,
  validateMinimumOrder,
} from '@/lib/pricing/commercialRules'
import { computeBonusCapacity } from '@/lib/pricing/bonus/sale'

export const runtime = 'nodejs'

const CONSENT_VERSION = 'kvkk-teklif-v1'
const CONSENT_PURPOSE = 'fiyat_teklifi_ve_iletisim'
const DEFAULT_PDF_CAPABILITY_TTL_SECONDS = 600
// Yerel Next sunucusunda reverse proxy başlıkları ve üretim secret'ı yoktur.
// Bu anahtar yalnız development sürecinde, process ömrü boyunca kullanılır;
// production/test ortamları mevcut fail-closed davranışını korur.
const LOCAL_DEVELOPMENT_GUARD_SECRET = randomBytes(32).toString('hex')

type GuardedRpcRow = {
  outcome: 'created' | 'replayed' | 'deduplicated' | 'conflict' | 'rate_limited'
  quote_id: number | string | null
  created_at: string | null
  retry_after_seconds: number | null
  limited_by: string | null
}

function getPdfCapabilityTtlSeconds(): number {
  const configured = Number(process.env.PDF_UPLOAD_CAPABILITY_TTL_SECONDS)
  if (!Number.isSafeInteger(configured)) return DEFAULT_PDF_CAPABILITY_TTL_SECONDS
  return Math.min(1800, Math.max(60, configured))
}

function resolveQuoteGuardContext(headers: Headers) {
  const isLocalDevelopment = process.env.NODE_ENV === 'development'
  let clientIp: string

  try {
    clientIp = getTrustedClientIp(headers)
  } catch (error) {
    if (
      !isLocalDevelopment
      || !(error instanceof QuoteGuardInputError)
      || error.code !== 'missing_client_ip'
    ) {
      throw error
    }
    clientIp = '127.0.0.1'
  }

  const explicitSecret = isLocalDevelopment && !process.env.QUOTE_ABUSE_HASH_SECRET
    ? LOCAL_DEVELOPMENT_GUARD_SECRET
    : undefined

  return { clientIp, explicitSecret }
}

function mapQuotePayload(payload: ReturnType<typeof apiQuoteSchema.parse>) {
  const rawAttribution = payload.packageItems.attribution
  const attribution = rawAttribution
    && typeof rawAttribution === 'object'
    && !Array.isArray(rawAttribution)
    ? rawAttribution as Record<string, unknown>
    : {}
  const packageItems = {
    ...payload.packageItems,
    attribution: {
      ...attribution,
      // DB generated kolonunun tek güvenilir girdisi API'de doğrulanan bu
      // alandır. İstemcinin nested değeri burada kesin olarak ezilir.
      comparison_session_id: payload.sourceChannel === 'comparison'
        ? payload.comparisonSessionId
        : null,
    },
  }

  return {
    customer_name: payload.customerName,
    customer_email: payload.customerEmail || '',
    customer_phone: payload.customerPhone,
    customer_company: payload.customerCompany || '',
    customer_address: payload.customerAddress || '',
    material_type: payload.materialType,
    brand_id: payload.brandId,
    brand_name: payload.brandName,
    model_name: payload.modelName || '',
    thickness_cm: payload.thicknessCm,
    area_m2: payload.areaM2,
    city_code: payload.cityCode,
    city_name: payload.cityName,
    package_name: payload.packageName,
    package_description: payload.packageDescription || '',
    plate_brand_name: payload.plateBrandName,
    accessory_brand_name: payload.accessoryBrandName,
    total_price: payload.totalPrice,
    price_per_m2: payload.pricePerM2,
    shipping_cost: payload.shippingCost,
    discount_percentage: payload.discountPercentage,
    price_without_vat: payload.priceWithoutVat,
    vat_amount: payload.vatAmount,
    package_count: payload.packageCount,
    package_size_m2: payload.packageSizeM2,
    items_per_package: payload.itemsPerPackage,
    vehicle_type: payload.vehicleType || null,
    lorry_capacity_packages: payload.lorryCapacityPackages ?? null,
    truck_capacity_packages: payload.truckCapacityPackages ?? null,
    lorry_fill_percentage: payload.lorryFillPercentage ?? null,
    truck_fill_percentage: payload.truckFillPercentage ?? null,
    package_items: packageItems,
    request_type: payload.submissionType,
    source_channel: payload.sourceChannel,
    status: payload.submissionType === 'pdf_quote' ? 'quoted' : 'pending',
    quote_code: payload.quoteCode || null,
    // PDF alanları istemciden kabul edilmez. Quote oluştuktan sonra yalnızca
    // capability korumalı /api/upload-pdf route'u random path'i bağlar.
    pdf_url: null,
    pdf_storage_path: null,
    kvkk_consent: true,
    consent_timestamp: new Date().toISOString(),
    consent_version: CONSENT_VERSION,
    consent_purpose: CONSENT_PURPOSE,
    consent_channel: payload.sourceChannel,
  }
}

function configurationErrorResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: 'Teklif hizmeti geçici olarak kullanılamıyor.',
    },
    { status: 503 },
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const payload = apiQuoteSchema.parse(body)

    // PDF teklifi yazıldıktan sonra capability üretilememesi yarım başarıdır.
    // Bu nedenle server secret'ını DB yan etkisinden önce doğrula.
    if (payload.submissionType === 'pdf_quote') {
      assertPdfCapabilityConfigured()
    }

    const idempotencyKey = readIdempotencyKey(req.headers)
    const { clientIp, explicitSecret } = resolveQuoteGuardContext(req.headers)
    const normalizedPhone = normalizePhoneForGuard(payload.customerPhone)
    const idempotencyHash = hashGuardValue('idempotency', idempotencyKey, explicitSecret)
    const requestFingerprint = buildQuoteFingerprint(payload, explicitSecret)
    const phoneHash = hashGuardValue('phone', normalizedPhone, explicitSecret)
    const ipHash = hashGuardValue('ip', clientIp, explicitSecret)
    const supabase = createServerSupabaseClient()

    const { data: materialRule, error: materialRuleError } = await supabase
      .from('material_types')
      .select('min_order_m2, full_vehicle_only')
      .eq('slug', payload.materialType)
      .single()

    if (materialRuleError || !materialRule) {
      console.error(
        '[quotes] Malzeme ticari kuralı okunamadı:',
        materialRuleError?.message || 'boş yanıt',
      )
      return configurationErrorResponse()
    }

    const minimumOrder = validateMinimumOrder(
      payload.areaM2,
      Number(materialRule.min_order_m2) || 0,
    )
    if (!minimumOrder.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Bu teklif için minimum ${minimumOrder.minimumM2} m² gereklidir.`,
        },
        { status: 400 },
      )
    }

    // Public satış, malzeme türünden bağımsız olarak proje ölçeğindedir.
    // İstemci tarafındaki CTA veya form atlatılsa bile kamyon altı sipariş
    // kayda ve bildirime ulaşamaz. Bonus kapasitesi üreticinin kendi bölge
    // listesinden, diğer markalar genel lojistik tablosundan okunur.
    let lorryCapacityM2: number
    let truckCapacityM2: number
    let packageSizeM2: number

    if (payload.brandName === 'Bonus') {
      const capacity = payload.modelName
        ? computeBonusCapacity({
            modelShortName: payload.modelName,
            thicknessCm: payload.thicknessCm,
          })
        : null
      if (!capacity || !capacity.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Bonus araç kapasitesi doğrulanamadı. Lütfen model ve kalınlık seçiminizi kontrol edin.',
          },
          { status: 400 },
        )
      }
      lorryCapacityM2 = capacity.kamyonM2
      truckCapacityM2 = capacity.tirM2
      packageSizeM2 = capacity.packageM2
    } else {
      const thicknessMm = payload.thicknessCm * 10
      const { data: logRow, error: logisticsError } = await supabase
        .from('logistics_capacity')
        .select('lorry_capacity_m2, truck_capacity_m2, package_size_m2, lorry_capacity_packages, truck_capacity_packages')
        .eq('thickness', thicknessMm)
        .single()

      if (logisticsError || !logRow) {
        console.error(
          '[quotes] Lojistik kuralı okunamadı:',
          logisticsError?.message || 'boş yanıt',
        )
        return configurationErrorResponse()
      }

      const submittedPackageSizeM2 = Number(payload.packageSizeM2)
      const submittedPackageCount = Number(payload.packageCount)
      const submittedPackageAreaM2 = submittedPackageSizeM2 * submittedPackageCount
      const packageAreaMatches = Number.isFinite(submittedPackageAreaM2)
        && Math.abs(submittedPackageAreaM2 - payload.areaM2) <= Math.max(1e-6, submittedPackageSizeM2 * 1e-9)
      const submittedPackageSizeIsUsable = Number.isFinite(submittedPackageSizeM2)
        && submittedPackageSizeM2 > 0
        && packageAreaMatches
      const lorryCapacityPackages = Number(logRow.lorry_capacity_packages)
      const truckCapacityPackages = Number(logRow.truck_capacity_packages)

      // Aynı kalınlıktaki EPS ve taşyünü levhaların paket m²'si farklı
      // olabilir. Sunucunun genel lojistik kapasitesini kullanması geçerli bir
      // tam aracı yanlış reddeder. Paket adedi × paket m², gönderilen alanla
      // birebir uyuşuyorsa araç paket adetlerini bu ürün paketine uygula.
      if (
        submittedPackageSizeIsUsable
        && Number.isFinite(lorryCapacityPackages)
        && Number.isFinite(truckCapacityPackages)
        && lorryCapacityPackages > 0
        && truckCapacityPackages > 0
      ) {
        packageSizeM2 = submittedPackageSizeM2
        lorryCapacityM2 = lorryCapacityPackages * packageSizeM2
        truckCapacityM2 = truckCapacityPackages * packageSizeM2
      } else {
        lorryCapacityM2 = Number(logRow.lorry_capacity_m2)
        truckCapacityM2 = Number(logRow.truck_capacity_m2)
        packageSizeM2 = Number(logRow.package_size_m2)
      }
    }

    if (
      !Number.isFinite(lorryCapacityM2)
      || !Number.isFinite(truckCapacityM2)
      || !Number.isFinite(packageSizeM2)
      || lorryCapacityM2 <= 0
      || truckCapacityM2 <= 0
      || packageSizeM2 <= 0
    ) {
      return configurationErrorResponse()
    }

    if (payload.areaM2 < lorryCapacityM2) {
      return NextResponse.json(
        {
          ok: false,
          error: `Satışlarımız tam kamyon veya TIR bazındadır. Minimum ${lorryCapacityM2.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} m² gereklidir.`,
        },
        { status: 400 },
      )
    }

    const isValidVehicleArea = isValidFullVehicleArea({
      areaM2: payload.areaM2,
      lorryCapacityM2,
      truckCapacityM2,
      packageSizeM2,
    })
    if (!isValidVehicleArea) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Teklif yalnız tam kamyon, tam TIR veya bunların tam araç kombinasyonu için oluşturulabilir.',
        },
        { status: 400 },
      )
    }

    const minM2 = payload.vehicleType === 'lorry'
      ? lorryCapacityM2
      : payload.vehicleType === 'truck'
        ? truckCapacityM2
        : null
    if (minM2 !== null && payload.areaM2 < minM2) {
      return NextResponse.json(
        {
          ok: false,
          error: `Bu metraj için ${payload.vehicleType === 'lorry' ? 'kamyon' : 'TIR'} fiyatı uygulanamaz. Minimum ${minM2.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} m² gereklidir.`,
        },
        { status: 400 },
      )
    }

    const insertPayload = mapQuotePayload(payload)
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'submit_quote_guarded',
      {
        p_quote_payload: insertPayload,
        p_idempotency_hash: idempotencyHash,
        p_request_fingerprint: requestFingerprint,
        p_phone_hash: phoneHash,
        p_ip_hash: ipHash,
      },
    )

    if (rpcError) {
      console.error('[quotes] Atomik teklif RPC başarısız:', rpcError.message)
      return configurationErrorResponse()
    }

    const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
      | GuardedRpcRow
      | null

    if (!result || !result.outcome) {
      console.error('[quotes] Atomik teklif RPC geçersiz yanıt verdi.')
      return configurationErrorResponse()
    }

    if (result.outcome === 'conflict') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Bu istek anahtarı farklı bir teklif için kullanılmış.',
        },
        { status: 409 },
      )
    }

    if (result.outcome === 'rate_limited') {
      const retryAfter = Math.max(1, Number(result.retry_after_seconds) || 60)
      return NextResponse.json(
        {
          ok: false,
          error: 'Kısa sürede çok fazla teklif talebi alındı. Lütfen biraz sonra tekrar deneyin.',
          retryAfterSeconds: retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      )
    }

    if (!result.quote_id || !result.created_at) {
      console.error('[quotes] Başarılı RPC yanıtında teklif kimliği eksik.')
      return configurationErrorResponse()
    }

    // Yalnızca yeni kayıt bildirim üretir. Replay/dedupe aynı lead'i ve
    // CallMeBot kotasını tekrar tüketmez.
    if (result.outcome === 'created') {
      const eventType: LeadEventType = payload.submissionType === 'pdf_quote'
        ? (payload.sourceChannel === 'catalog'
          ? 'single_product_pdf'
          : 'package_pdf_quote')
        : (payload.sourceChannel === 'catalog'
          ? 'single_product_whatsapp'
          : 'package_whatsapp_order')

      try {
        await sendNotification(eventType, {
          refCode: insertPayload.quote_code ?? undefined,
          customerName: insertPayload.customer_name,
          customerPhone: insertPayload.customer_phone,
          productName: insertPayload.package_name || insertPayload.brand_name,
          thicknessCm: insertPayload.thickness_cm,
          areaM2: insertPayload.area_m2,
          cityName: insertPayload.city_name,
          totalPrice: insertPayload.total_price,
        })
      } catch (error) {
        console.warn(
          '[notify] Bildirim gönderilemedi (teklif kaydı korundu):',
          error instanceof Error ? error.message : 'bilinmeyen hata',
        )
      }
    }

    let pdfUploadCapability: string | undefined
    let pdfUploadCapabilityExpiresAt: number | undefined
    if (payload.submissionType === 'pdf_quote') {
      const nowSeconds = Math.floor(Date.now() / 1000)
      pdfUploadCapabilityExpiresAt = nowSeconds + getPdfCapabilityTtlSeconds()
      pdfUploadCapability = createPdfCapabilityToken({
        quoteId: result.quote_id,
        action: 'upload',
        expiresAt: pdfUploadCapabilityExpiresAt,
      })
    }

    return NextResponse.json({
      ok: true,
      quoteId: result.quote_id,
      createdAt: result.created_at,
      outcome: result.outcome,
      ...(pdfUploadCapability
        ? { pdfUploadCapability, pdfUploadCapabilityExpiresAt }
        : {}),
    })
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      return NextResponse.json(
        { ok: false, error: 'Teklif verisi doğrulanamadı.', details },
        { status: 400 },
      )
    }

    if (error instanceof QuoteGuardInputError) {
      const isConfigurationError = [
        'missing_hash_secret',
        'weak_hash_secret',
        'missing_client_ip',
        'invalid_client_ip',
      ].includes(error.code)
      return isConfigurationError
        ? configurationErrorResponse()
        : NextResponse.json(
          { ok: false, error: 'Teklif istek anahtarı geçerli değil.' },
          { status: 400 },
        )
    }

    if (error instanceof PdfCapabilityError) {
      return configurationErrorResponse()
    }

    console.error(
      '[quotes] Beklenmeyen hata:',
      error instanceof Error ? error.message : 'bilinmeyen hata',
    )
    return NextResponse.json(
      { ok: false, error: 'Teklif kaydı sırasında beklenmeyen hata oluştu.' },
      { status: 500 },
    )
  }
}

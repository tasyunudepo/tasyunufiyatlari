import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { apiQuoteSchema } from '@/lib/schemas/quote.schema'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendNotification, type LeadEventType } from '@/lib/notifications'

function mapQuotePayload(
  payload: ReturnType<typeof apiQuoteSchema.parse>,
  req: NextRequest,
) {
  return {
    customer_name: payload.customerName,
    // PDF teklif akışında e-posta opsiyonel. Boş alanları null yerine
    // boş string olarak saklayıp eski şema/not-null kısıtlarıyla uyum koruyoruz.
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
    package_items: payload.packageItems,
    request_type: payload.submissionType,
    source_channel: payload.sourceChannel,
    status: payload.submissionType === 'pdf_quote' ? 'quoted' : 'pending',
    quote_code: payload.quoteCode || null,
    pdf_url: payload.pdfUrl || null,
    pdf_storage_path: payload.pdfStoragePath || null,

    // KVKK rıza persist — apiQuoteSchema validation sonrası
    // payload.kvkkConsent === true garantili. Defansif kontrol yine de.
    kvkk_consent: payload.kvkkConsent === true,
    consent_timestamp: payload.kvkkConsent ? new Date().toISOString() : null,
    consent_ip:
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const payload = apiQuoteSchema.parse(body)
    const supabase = createServerSupabaseClient()

    // Katalog kanalında tier eligibility'yi server tarafında doğrula.
    // Wizard kendi hesabını yapıyor (özel tasyunu kuralları dahil), o kanalı atla.
    if (
      payload.sourceChannel === 'catalog' &&
      (payload.vehicleType === 'lorry' || payload.vehicleType === 'truck')
    ) {
      const thicknessMm = payload.thicknessCm * 10
      const { data: logRow } = await supabase
        .from('logistics_capacity')
        .select('lorry_capacity_m2, truck_capacity_m2')
        .eq('thickness', thicknessMm)
        .single()

      if (logRow) {
        const minM2 =
          payload.vehicleType === 'lorry'
            ? Number(logRow.lorry_capacity_m2)
            : Number(logRow.truck_capacity_m2)
        if (payload.areaM2 < minM2) {
          return NextResponse.json(
            {
              ok: false,
              error: `Bu metraj için ${payload.vehicleType === 'lorry' ? 'Kamyon' : 'TIR'} fiyatı uygulanamaz. Minimum ${minM2} m² gereklidir.`,
            },
            { status: 400 }
          )
        }
      }
    }

    const insertPayload = mapQuotePayload(payload, req)

    const { data, error } = await supabase
      .from('quotes')
      .insert(insertPayload)
      .select('id, created_at')
      .single()

    if (error) {
      console.error('Quote insert failed:', error)
      // Geliştirme/debug için Supabase error mesajını da döndür.
      // Production'da generic mesaj yeterli; debug için detay kritik.
      const debugError =
        process.env.NODE_ENV !== 'production' && error
          ? `${error.message} (code: ${error.code ?? 'n/a'})`
          : null
      return NextResponse.json(
        {
          ok: false,
          error: 'Teklif kaydı oluşturulamadı.',
          ...(debugError ? { debug: debugError } : {}),
        },
        { status: 500 }
      )
    }

    const analyticsPayload = {
      event_type:
        payload.submissionType === 'pdf_quote'
          ? 'pdf_quote_requested'
          : 'whatsapp_order_requested',
      quote_id: data.id,
      material_type: payload.materialType,
      brand_id: payload.brandId,
      brand_name: payload.brandName,
      model_name: payload.modelName || null,
      thickness_cm: payload.thicknessCm,
      area_m2: payload.areaM2,
      city_code: payload.cityCode,
      city_name: payload.cityName,
      package_name: payload.packageName,
      total_price: payload.totalPrice,
      metadata: {
        plateBrandName: payload.plateBrandName,
        accessoryBrandName: payload.accessoryBrandName,
        vehicleType: payload.vehicleType || null,
        submissionType: payload.submissionType,
        sourceChannel: payload.sourceChannel,
      },
    }

    const { error: analyticsError } = await supabase
      .from('quote_funnel_events')
      .insert(analyticsPayload)

    if (analyticsError) {
      console.warn('Quote analytics insert skipped:', analyticsError.message)
    }

    // WhatsApp bildirimi — hata fırlatmaz, DB kaydını engellemez.
    // AWAIT zorunlu: Vercel serverless function response döndüğünde
    // bekleyen Promise'leri sonlandırır → fire-and-forget fetch kaybolur.
    const eventType: LeadEventType =
      payload.submissionType === 'pdf_quote'
        ? (payload.sourceChannel === 'catalog' ? 'single_product_pdf' : 'package_pdf_quote')
        : (payload.sourceChannel === 'catalog' ? 'single_product_whatsapp' : 'package_whatsapp_order');

    try {
      await sendNotification(eventType, {
        refCode:       insertPayload.quote_code ?? undefined,
        customerName:  insertPayload.customer_name,
        customerPhone: insertPayload.customer_phone,
        productName:   insertPayload.package_name || insertPayload.brand_name,
        thicknessCm:   insertPayload.thickness_cm,
        areaM2:        insertPayload.area_m2,
        cityName:      insertPayload.city_name,
        totalPrice:    insertPayload.total_price,
        pdfUrl:        insertPayload.pdf_url ?? undefined,
      });
    } catch (notifyErr) {
      console.warn('[notify] sendNotification failed (non-fatal):', notifyErr);
    }

    return NextResponse.json({
      ok: true,
      quoteId: data.id,
      createdAt: data.created_at,
    })
  } catch (error) {
    console.error('Quote API error:', error)

    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      return NextResponse.json(
        { ok: false, error: 'Teklif verisi doğrulanamadı.', details },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { ok: false, error: 'Teklif kaydı sırasında beklenmeyen hata oluştu.' },
      { status: 500 }
    )
  }
}

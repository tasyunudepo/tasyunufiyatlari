import { NextRequest, NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  requireAdminMutationAuth,
  requireOfficeReadAuth,
} from '@/lib/security/adminMutationAuth'
import { customerUpdateSchema } from '@/lib/schemas/customer.schema'

export const dynamic = 'force-dynamic'

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * Müşteri detayı — kimlik + teklif geçmişi + etkileşim defteri.
 * Üç sorgu tek yanıtta birleşir; müşteri ekranı tek istekle dolar.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireOfficeReadAuth(req)
  if (!auth.ok) return auth.response

  const { id: raw } = await params
  const id = parseId(raw)
  if (id === null) {
    return NextResponse.json({ ok: false, error: 'Geçersiz müşteri kimliği.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (customerError) {
    console.error('Müşteri okunamadı:', customerError.message)
    return NextResponse.json({ ok: false, error: 'Müşteri okunamadı.' }, { status: 500 })
  }
  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Müşteri bulunamadı.' }, { status: 404 })
  }

  const [{ data: quotes }, { data: interactions }] = await Promise.all([
    supabase
      .from('quotes')
      .select(
        'id, quote_code, created_at, status, priority, request_type, source_channel,' +
          ' brand_name, package_name, material_type, thickness_cm, area_m2, city_name,' +
          ' total_price, price_per_m2, sales_final_price, gross_profit, loss_category,' +
          ' closed_at, follow_up_date, contact_attempted_at, pdf_storage_path',
      )
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('customer_interactions')
      .select('*')
      .eq('customer_id', id)
      .order('occurred_at', { ascending: false }),
  ])

  return NextResponse.json(
    {
      ok: true,
      customer,
      quotes: quotes ?? [],
      interactions: interactions ?? [],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const { id: raw } = await params
  const id = parseId(raw)
  if (id === null) {
    return NextResponse.json({ ok: false, error: 'Geçersiz müşteri kimliği.' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = customerUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Güncelleme verisi geçersiz.' },
      { status: 400 },
    )
  }

  // Telefon burada değiştirilmez: doğal anahtar ve teklif bağı ona dayanıyor.
  // Yanlış telefon düzeltmesi ayrı bir birleştirme işi (ileride).
  const FIELD_MAP: Record<string, string> = {
    displayName: 'display_name',
    companyName: 'company_name',
    email: 'email',
    cityCode: 'city_code',
    cityName: 'city_name',
    address: 'address',
    customerType: 'customer_type',
    origin: 'origin',
    owner: 'owner',
    notes: 'notes',
    status: 'status',
    consentBasis: 'consent_basis',
    consentChannel: 'consent_channel',
  }

  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue
    const column = FIELD_MAP[key]
    if (!column) continue
    update[column] = value === '' ? null : value
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Güncellenecek alan yok.' },
      { status: 400 },
    )
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('customers')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('Müşteri güncellenemedi:', error.message)
    return NextResponse.json({ ok: false, error: 'Müşteri güncellenemedi.' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'Müşteri bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, customer: data })
}

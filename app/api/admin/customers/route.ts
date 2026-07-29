import { NextRequest, NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  requireAdminMutationAuth,
  requireOfficeReadAuth,
} from '@/lib/security/adminMutationAuth'
import { normalizePhoneForGuard, QuoteGuardInputError } from '@/lib/security/quoteSubmissionGuard'
import {
  customerCreateSchema,
  customerListQuerySchema,
} from '@/lib/schemas/customer.schema'

export const dynamic = 'force-dynamic'

const BUSINESS_UNIT = 'tasyunu'

// Müşteri kütüğü tam PII taşır. Okuma proxy'ye ek olarak handler seviyesinde
// de kapalıdır (audit S1: /api/admin/quotes'ta bu kapı yoktu, yeni yüzeyde
// baştan var). Mutasyonda patron 403 alır.

/** Liste — sunucu taraflı sayfalama (audit E2: ilk günden sayfalı). */
export async function GET(req: NextRequest) {
  const auth = requireOfficeReadAuth(req)
  if (!auth.ok) return auth.response

  const parsed = customerListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Geçersiz liste parametresi.' },
      { status: 400 },
    )
  }
  const { q, filter, limit, offset } = parsed.data

  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('customers')
    .select(
      'id, display_name, company_name, phone_display, phone_normalized, email,' +
        ' city_name, customer_type, origin, owner, status, last_contact_at, created_at',
      { count: 'exact' },
    )
    .eq('business_unit', BUSINESS_UNIT)

  if (q) {
    // Telefonla arama normalize edilerek yapılır; "0532..." ile "+90532..."
    // aynı müşteriyi bulmalı.
    let phoneTerm: string | null = null
    try {
      phoneTerm = normalizePhoneForGuard(q)
    } catch {
      phoneTerm = null
    }
    const like = `%${q.replace(/[%_]/g, '')}%`
    const clauses = [
      `display_name.ilike.${like}`,
      `company_name.ilike.${like}`,
      `phone_display.ilike.${like}`,
    ]
    if (phoneTerm) clauses.push(`phone_normalized.eq.${phoneTerm}`)
    query = query.or(clauses.join(','))
  }

  if (filter === 'temassiz') query = query.is('last_contact_at', null)

  const { data, error, count } = await query
    .order('last_contact_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Müşteri listesi alınamadı:', error.message)
    return NextResponse.json(
      { ok: false, error: 'Müşteri kayıtları alınamadı.' },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      customers: data ?? [],
      total: count ?? 0,
      limit,
      offset,
      hasMore: (count ?? 0) > offset + (data?.length ?? 0),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** Yeni müşteri — telefonla gelen talebin giriş noktası. */
export async function POST(req: NextRequest) {
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = customerCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Müşteri bilgisi doğrulanamadı.',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }

  let phoneNormalized: string
  try {
    phoneNormalized = normalizePhoneForGuard(parsed.data.phone)
  } catch (error) {
    if (error instanceof QuoteGuardInputError) {
      return NextResponse.json(
        { ok: false, error: 'Telefon numarası 10 ila 15 rakam içermelidir.' },
        { status: 400 },
      )
    }
    throw error
  }

  const supabase = createServerSupabaseClient()

  // Aynı telefon zaten varsa yeni kayıt açma — mevcut müşteriyi döndür.
  // Operatör "yeni müşteri" derken farkında olmadan kopya üretmesin.
  const { data: mevcut } = await supabase
    .from('customers')
    .select('id, display_name, phone_display')
    .eq('business_unit', BUSINESS_UNIT)
    .eq('phone_normalized', phoneNormalized)
    .maybeSingle()

  if (mevcut) {
    return NextResponse.json(
      { ok: true, customer: mevcut, existing: true },
      { status: 200 },
    )
  }

  const d = parsed.data
  const { data, error } = await supabase
    .from('customers')
    .insert({
      business_unit: BUSINESS_UNIT,
      phone_normalized: phoneNormalized,
      phone_display: d.phone,
      display_name: d.displayName,
      company_name: d.companyName || null,
      email: d.email || null,
      city_code: d.cityCode || null,
      city_name: d.cityName || null,
      address: d.address || null,
      customer_type: d.customerType,
      origin: d.origin,
      owner: d.owner || null,
      notes: d.notes || null,
      // KVKK: açık rıza uydurulmaz; dayanak ve kaydeden kişi yazılır.
      kvkk_consent: false,
      consent_basis: d.consentBasis,
      consent_channel: d.consentChannel || null,
      consent_version: 'kvkk-ofis-v1',
      consent_timestamp: new Date().toISOString(),
      consent_recorded_by: auth.user,
    })
    .select('id, display_name, company_name, phone_display, city_name, origin, status')
    .single()

  if (error) {
    console.error('Müşteri oluşturulamadı:', error.message)
    return NextResponse.json(
      { ok: false, error: 'Müşteri kaydedilemedi.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, customer: data, existing: false }, { status: 201 })
}

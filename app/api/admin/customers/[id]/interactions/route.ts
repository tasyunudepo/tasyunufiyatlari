import { NextRequest, NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  requireAdminMutationAuth,
  requireOfficeReadAuth,
} from '@/lib/security/adminMutationAuth'
import { interactionCreateSchema } from '@/lib/schemas/customer.schema'

export const dynamic = 'force-dynamic'

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

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
  const { data, error } = await supabase
    .from('customer_interactions')
    .select('*')
    .eq('customer_id', id)
    .order('occurred_at', { ascending: false })

  if (error) {
    console.error('Etkileşimler okunamadı:', error.message)
    return NextResponse.json({ ok: false, error: 'Etkileşimler okunamadı.' }, { status: 500 })
  }

  return NextResponse.json(
    { ok: true, interactions: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/**
 * Görüşme kaydı — teklif OLMADAN da yazılabilir.
 * Bugüne kadarki en büyük boşluk buydu: telefonla gelip sözlü bilgiyle
 * kapanan talep hiçbir yere düşmüyordu.
 *
 * Defter append-only'dir: kayıt güncellenmez, yeni satır eklenir.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const { id: raw } = await params
  const customerId = parseId(raw)
  if (customerId === null) {
    return NextResponse.json({ ok: false, error: 'Geçersiz müşteri kimliği.' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = interactionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Görüşme kaydı doğrulanamadı.',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }

  const d = parsed.data
  const occurredAt = d.occurredAt ?? new Date().toISOString()
  const supabase = createServerSupabaseClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Müşteri bulunamadı.' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('customer_interactions')
    .insert({
      customer_id: customerId,
      quote_id: d.quoteId ?? null,
      kind: d.kind,
      outcome: d.outcome ?? null,
      body: d.body || null,
      occurred_at: occurredAt,
      next_action_at: d.nextActionAt ?? null,
      next_action_note: d.nextActionNote || null,
      created_by: auth.user,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Görüşme kaydedilemedi:', error.message)
    return NextResponse.json({ ok: false, error: 'Görüşme kaydedilemedi.' }, { status: 500 })
  }

  // Son temas anını tazele — "kimi ne zamandır aramadık" listesi buna dayanıyor.
  // Gerçek temas sayılmayan kayıtlar (salt not, hatırlatma) sayılmaz.
  if (['arama_giden', 'arama_gelen', 'whatsapp', 'eposta', 'ziyaret'].includes(d.kind)) {
    await supabase
      .from('customers')
      .update({ last_contact_at: occurredAt })
      .eq('id', customerId)
      .or(`last_contact_at.is.null,last_contact_at.lt.${occurredAt}`)
  }

  return NextResponse.json({ ok: true, interaction: data }, { status: 201 })
}

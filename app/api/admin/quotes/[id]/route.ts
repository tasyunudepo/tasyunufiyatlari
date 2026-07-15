import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth'

// Satış sonucu alanları (v22): completed = kazanıldı, rejected = kaybedildi.
// sales_final_price ve gross_profit ADMIN-ONLY'dir; müşteri yüzeyine çıkmaz.
const quoteUpdateSchema = z
  .object({
    status: z
      .enum(['pending', 'contacted', 'quoted', 'approved', 'rejected', 'completed'])
      .optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    lossCategory: z
      .enum(['fiyat', 'stok_termin', 'vade_odeme', 'ulasilamadi', 'rakip', 'vazgecti', 'diger'])
      .nullable()
      .optional(),
    lossReason: z.string().max(500).nullable().optional(),
    salesFinalPrice: z.number().positive().nullable().optional(),
    grossProfit: z.number().nullable().optional(),
    quotedBy: z.string().max(80).nullable().optional(),
    contactAttemptedAt: z.string().datetime().nullable().optional(),
    contactSuccessful: z.boolean().nullable().optional(),
    followUpDate: z.string().nullable().optional(),
    adminNotes: z.string().max(2000).nullable().optional(),
  })
  .refine((payload) => Object.values(payload).some((v) => v !== undefined), {
    message: 'En az bir alan guncellenmeli.',
  })

const FIELD_MAP: Record<string, string> = {
  status: 'status',
  priority: 'priority',
  lossCategory: 'loss_category',
  lossReason: 'loss_reason',
  salesFinalPrice: 'sales_final_price',
  grossProfit: 'gross_profit',
  quotedBy: 'quoted_by',
  contactAttemptedAt: 'contact_attempted_at',
  contactSuccessful: 'contact_successful',
  followUpDate: 'follow_up_date',
  adminNotes: 'admin_notes',
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Salt-okunur patron hesabı mutasyon yapamaz (audit kırmızısı, 15 Temmuz).
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const quoteId = Number(id)

  if (!Number.isFinite(quoteId)) {
    return NextResponse.json(
      { ok: false, error: 'Gecersiz teklif kimligi.' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = quoteUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Guncelleme verisi gecersiz.' },
      { status: 400 }
    )
  }

  const supabase = createServerSupabaseClient()
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue
    updatePayload[FIELD_MAP[key] ?? key] = value
  }

  const { data, error } = await supabase
    .from('quotes')
    .update(updatePayload)
    .eq('id', quoteId)
    .select('*')
    .single()

  if (error) {
    console.error('Admin quote update failed:', error)
    return NextResponse.json(
      { ok: false, error: 'Teklif guncellenemedi.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    quote: data,
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Silme en yıkıcı mutasyon: patron hesabı ve kimliksiz istek giremez.
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const quoteId = Number(id)

  if (!Number.isFinite(quoteId)) {
    return NextResponse.json({ ok: false, error: 'Geçersiz teklif kimliği.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // İlişkili funnel eventlerini önce sil
  await supabase.from('quote_funnel_events').delete().eq('quote_id', quoteId)

  const { error } = await supabase.from('quotes').delete().eq('id', quoteId)

  if (error) {
    console.error('Admin quote delete failed:', error)
    return NextResponse.json({ ok: false, error: 'Teklif silinemedi.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

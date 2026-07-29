import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth'

// Deney güncelleme/kapatma. Karar sözlüğü sabit; "kazanan" kararı bile
// insan onayıyla verilir — motor (4B) yalnız öneri üretecek.

const experimentUpdateSchema = z
  .object({
    status: z.enum(['yayinda', 'duraklatildi', 'tamamlandi']).optional(),
    decision: z.enum(['yayinla', 'geri_al', 'gelistir', 'veri_yetersiz']).nullable().optional(),
    resultSummary: z.string().max(2000).nullable().optional(),
    endedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    guardrails: z.string().max(1000).nullable().optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), {
    message: 'En az bir alan güncellenmeli.',
  })

const FIELD_MAP: Record<string, string> = {
  status: 'status',
  decision: 'decision',
  resultSummary: 'result_summary',
  endedAt: 'ended_at',
  guardrails: 'guardrails',
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const experimentId = Number(id)
  if (!Number.isFinite(experimentId)) {
    return NextResponse.json({ ok: false, error: 'Geçersiz deney kimliği.' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = experimentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Güncelleme verisi geçersiz.' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue
    updatePayload[FIELD_MAP[key] ?? key] = value
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('sales_experiments')
    .update(updatePayload)
    .eq('id', experimentId)
    .select('*')
    .single()

  if (error) {
    console.error('[experiments] güncellenemedi:', error)
    return NextResponse.json({ ok: false, error: 'Deney güncellenemedi.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, experiment: data })
}

/**
 * Deney silme (audit B5).
 *
 * Rota yoktu; yanlış girilen bir deney defterde kalıcı olarak kalıyordu.
 * Tamamlanmış deneyler öğrenme belleğidir — onlar silinmez, yalnız
 * yayında/duraklatılmış kayıtlar temizlenebilir.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const experimentId = Number(id)
  if (!Number.isFinite(experimentId)) {
    return NextResponse.json({ ok: false, error: 'Geçersiz deney kimliği.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const { data: mevcut, error: okumaHatasi } = await supabase
    .from('sales_experiments')
    .select('id, status')
    .eq('id', experimentId)
    .maybeSingle()

  if (okumaHatasi) {
    console.error('[experiments] okunamadı:', okumaHatasi)
    return NextResponse.json({ ok: false, error: 'Deney okunamadı.' }, { status: 500 })
  }
  if (!mevcut) {
    return NextResponse.json({ ok: false, error: 'Deney bulunamadı.' }, { status: 404 })
  }
  if (mevcut.status === 'tamamlandi') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Tamamlanmış deney silinemez — sonucu öğrenme belleğinin parçasıdır.',
      },
      { status: 409 },
    )
  }

  const { error } = await supabase
    .from('sales_experiments')
    .delete()
    .eq('id', experimentId)

  if (error) {
    console.error('[experiments] silinemedi:', error)
    return NextResponse.json({ ok: false, error: 'Deney silinemedi.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

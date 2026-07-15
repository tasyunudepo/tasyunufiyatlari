import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  requireAdminMutationAuth,
  requireOfficeReadAuth,
} from '@/lib/security/adminMutationAuth'

// Satış deney defteri (Sprint 4A). Her fikir sözleşmeyle kaydedilir;
// "kazanan" ilanı motorun 4B beynine ve yeterli veriye bırakılır.

const experimentCreateSchema = z.object({
  name: z.string().min(3).max(120),
  hypothesis: z.string().min(10).max(2000),
  targetVisitor: z.string().max(300).nullable().optional(),
  surface: z.string().min(3).max(300),
  primaryMetric: z.string().min(3).max(300),
  guardrails: z.string().max(1000).nullable().optional(),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(req: NextRequest) {
  const auth = requireOfficeReadAuth(req)
  if (!auth.ok) return auth.response

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('sales_experiments')
    .select('*')
    .order('started_at', { ascending: false })

  if (error) {
    console.error('[experiments] liste alınamadı:', error)
    return NextResponse.json({ ok: false, error: 'Deneyler alınamadı.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, experiments: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = requireAdminMutationAuth(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = experimentCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Deney sözleşmesi eksik/geçersiz.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('sales_experiments')
    .insert({
      name: parsed.data.name,
      hypothesis: parsed.data.hypothesis,
      target_visitor: parsed.data.targetVisitor ?? null,
      surface: parsed.data.surface,
      primary_metric: parsed.data.primaryMetric,
      guardrails: parsed.data.guardrails ?? null,
      started_at: parsed.data.startedAt,
    })
    .select('*')
    .single()

  if (error) {
    const duplicate = /duplicate|unique/i.test(error.message)
    console.error('[experiments] oluşturulamadı:', error)
    return NextResponse.json(
      { ok: false, error: duplicate ? 'Bu adla bir deney zaten var.' : 'Deney oluşturulamadı.' },
      { status: duplicate ? 409 : 500 },
    )
  }
  return NextResponse.json({ ok: true, experiment: data })
}

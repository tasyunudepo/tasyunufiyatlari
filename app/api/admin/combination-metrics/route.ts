import { NextRequest, NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth'

import type { CombinationMetrics } from './types'

// Audit S1: marka/kombinasyon kırılımı rakip analizine yarayacak ticari
// bilgidir; proxy'ye ek olarak handler seviyesinde de kapalı.
export async function GET(req: NextRequest) {
  const auth = requireOfficeReadAuth(req)
  if (!auth.ok) return auth.response

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_combination_metrics')

  if (error) {
    console.error('combination-metrics rpc failed:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, metrics: data as CombinationMetrics })
}

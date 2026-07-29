import { NextRequest, NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth'

import type { DashboardMetrics } from './types'

// Audit S1: ticari metrikler (ciro, teklif hacmi) proxy'ye ek olarak
// handler seviyesinde de kapalı.
export async function GET(req: NextRequest) {
  const auth = requireOfficeReadAuth(req)
  if (!auth.ok) return auth.response

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_dashboard_metrics')

  if (error) {
    console.error('dashboard-metrics rpc failed:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, metrics: data as DashboardMetrics })
}

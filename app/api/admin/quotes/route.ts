import { NextRequest, NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status')
  const supabase = createServerSupabaseClient()

  let query = supabase.from('quotes').select('*').order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Admin quotes fetch failed:', error)
    return NextResponse.json(
      { ok: false, error: 'Teklif kayıtları alınamadı.' },
      { status: 500 }
    )
  }

  const { data: eventRows, error: eventError } = await supabase
    .from('quote_funnel_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (eventError) {
    console.warn('Admin quote events fetch failed:', eventError.message)
  }

  const eventsByQuoteId = (eventRows ?? []).reduce<Record<string, Record<string, unknown>[]>>((acc, event) => {
    const key = event.quote_id ? String(event.quote_id) : 'unlinked'
    if (!acc[key]) acc[key] = []
    acc[key].push(event)
    return acc
  }, {})

  const funnelSummary = (eventRows ?? []).reduce<Record<string, number>>((acc, event) => {
    const key = event.event_type || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    ok: true,
    quotes: data ?? [],
    eventsByQuoteId,
    funnelSummary,
  })
}

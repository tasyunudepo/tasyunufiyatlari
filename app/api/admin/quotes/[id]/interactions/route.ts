import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth';
import { CONTACT_KINDS, pgBigintId } from '@/lib/admin/quoteSemantics';

export const dynamic = 'force-dynamic';
// Text casts preserve PostgreSQL bigint values before JSON reaches JavaScript.
const columns = 'id::text,quote_id::text,kind,outcome,body,occurred_at,created_by,next_action_at,next_action_note,next_action_done_at';
const headers = { 'Cache-Control': 'no-store' };

/** Read the existing v24 ledger for this exact quote. Customer/phone matches are not project links. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireOfficeReadAuth(req);
  if (!auth.ok) return auth.response;
  const id = pgBigintId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz teklif kimliği.' }, { status: 400, headers });
  const db = createServerSupabaseClient();
  const base = () => db.from('customer_interactions').select(columns).eq('quote_id', id);
  // Independent summary reads cover the full ledger, including success older than the displayed 100 rows.
  const [recent, first, latest] = await Promise.all([
    base().order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(101),
    base().in('kind', [...CONTACT_KINDS]).eq('outcome', 'ulasildi')
      .order('occurred_at', { ascending: true }).order('id', { ascending: true }).limit(1),
    base().in('kind', [...CONTACT_KINDS]).not('outcome', 'is', null)
      .order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(1),
  ]);
  if (recent.error || first.error || latest.error) {
    return NextResponse.json({ ok: false, error: 'Görüşme geçmişi alınamadı. Teklifteki eski alanlar korunuyor.' }, { status: 503, headers });
  }
  return NextResponse.json({
    ok: true, interactions: (recent.data ?? []).slice(0, 100), hasOlder: (recent.data?.length ?? 0) > 100,
    firstSuccess: first.data?.[0] ?? null, latestAttempt: latest.data?.[0] ?? null,
  }, { headers });
}

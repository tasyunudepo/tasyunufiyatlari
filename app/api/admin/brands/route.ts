import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth';

export const dynamic = 'force-dynamic';

// Audit S1: `margin_pct` kâr marjıdır — müşteri yüzeyine asla çıkmaz.
// Proxy'ye ek olarak handler seviyesinde de kapalı.
export async function GET(req: NextRequest) {
  const auth = requireOfficeReadAuth(req);
  if (!auth.ok) return auth.response;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, tier, description, margin_pct')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, brands: data });
}

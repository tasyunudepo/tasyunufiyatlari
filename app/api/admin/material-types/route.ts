import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth';

export const dynamic = 'force-dynamic';

// Audit S1: kademe marjları (tier1/2/3_margin_pct) ticari sırdır.
export async function GET(req: NextRequest) {
  const auth = requireOfficeReadAuth(req);
  if (!auth.ok) return auth.response;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('material_types')
    .select('*')
    .order('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, materialTypes: data });
}

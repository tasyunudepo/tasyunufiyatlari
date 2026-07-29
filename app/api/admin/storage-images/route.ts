import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth';

export const dynamic = 'force-dynamic';

const BUCKET = 'product-images';

// Audit S1: depo dosya listesi yayımlanmamış görselleri de içerir.
export async function GET(req: NextRequest) {
  const auth = requireOfficeReadAuth(req);
  if (!auth.ok) return auth.response;

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlMeta } = supabase.storage.from(BUCKET).getPublicUrl('');
  const baseUrl = urlMeta.publicUrl.replace(/\/$/, '');

  const files = (data ?? [])
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => ({
      name: f.name,
      url: `${baseUrl}/${f.name}`,
    }));

  return NextResponse.json({ files });
}

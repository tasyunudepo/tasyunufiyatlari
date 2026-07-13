import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth';

export const dynamic = 'force-dynamic';

// Marka öncelikli marj (karar günlüğü Tur 4): brands.margin_pct doluysa
// o markanın bütün fiyat yüzeylerinde malzeme kuralını ezer; null ise
// malzeme-tipi kademe kuralı geçerlidir. Yalnız bu alan güncellenebilir.
const brandMarginSchema = z.object({
  margin_pct: z
    .union([z.number().min(0).max(100), z.null()])
    .describe('0-100 arası yüzde veya null (malzeme kuralına düş)'),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdminMutationAuth(req);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Geçersiz ID' }, { status: 400 });
  }

  const body = await req.json();
  const parsed = brandMarginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Marka marjı doğrulanamadı.',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('brands')
    .update({ margin_pct: parsed.data.margin_pct })
    .eq('id', id)
    .select('id, name, tier, description, margin_pct')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Marka bulunamadı.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, brand: data });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth';

export const dynamic = 'force-dynamic';

// Güncellenebilir katalog kural alanları
const ALLOWED_FIELDS = [
  'slug',
  'sales_mode',
  'pricing_visibility_mode',
  'minimum_order_type',
  'minimum_order_value',
  'requires_city_for_pricing',
  'requires_system_context',
  'recommended_bundle_family',
  'catalog_description',
  'meta_title',
  'meta_description',
  'depot_discount',
  'depot_min_m2',
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Salt-okunur patron hesabı mutasyon yapamaz (audit kırmızısı, 15 Temmuz).
  const auth = requireAdminMutationAuth(req);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Geçersiz ID' }, { status: 400 });
  }

  const body = await req.json();

  // Sadece izin verilen alanları al
  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      update[field] = body[field];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  // Slug benzersizlik kontrolü (slug değiştiriliyorsa)
  if (update.slug) {
    const { data: existing } = await supabase
      .from('plates')
      .select('id')
      .eq('slug', update.slug)
      .neq('id', id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Bu slug zaten kullanılıyor' }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from('plates')
    .update(update)
    .eq('id', id)
    .select('id, slug, sales_mode, pricing_visibility_mode')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // plate_prices bazlı stok güncellemesi
  if (Array.isArray(body.plate_prices_depot) && body.plate_prices_depot.length > 0) {
    for (const row of body.plate_prices_depot as { id: number; stock_tuzla: number }[]) {
      await supabase
        .from('plate_prices')
        .update({ stock_tuzla: row.stock_tuzla })
        .eq('id', row.id);
    }
  }

  return NextResponse.json({ ok: true, plate: data });
}

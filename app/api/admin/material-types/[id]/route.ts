import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { materialTypeRulesSchema } from '@/lib/schemas/materialTypeRules.schema';

export const dynamic = 'force-dynamic';

// Güncellenebilir marj kuralları (migration v12)
const ALLOWED_FIELDS = [
  'min_order_m2',
  'tier1_max_m2',
  'tier1_margin_pct',
  'tier2_max_m2',
  'tier2_margin_pct',
  'tier3_margin_pct',
  'full_vehicle_only',
  'special_order_threshold_m2',
  'special_order_note',
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Geçersiz ID' }, { status: 400 });
  }

  const body = await req.json();

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
  const { data: current, error: currentError } = await supabase
    .from('material_types')
    .select(ALLOWED_FIELDS.join(','))
    .eq('id', id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: 'Marj kuralı bulunamadı.' }, { status: 404 });
  }

  const currentRecord = current as unknown as Record<string, unknown>;
  const parsed = materialTypeRulesSchema.safeParse({ ...currentRecord, ...update });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Marj kuralı doğrulanamadı.',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const validatedUpdate = Object.fromEntries(
    Object.keys(update).map((field) => [
      field,
      parsed.data[field as keyof typeof parsed.data],
    ]),
  );

  const { data, error } = await supabase
    .from('material_types')
    .update(validatedUpdate)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, materialType: data });
}

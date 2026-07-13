import { NextResponse } from 'next/server';
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createNewProductsFromFile } from '@/lib/importProductCreator';

// ==========================================
// POST /api/import/[id]/create-new-products
//
// Staging dosyasındaki "new_product" satırlarından aksesuar oluşturur.
//
// Güvenceler:
//   - Dosya mevcut ve status = 'matched' | 'applied' olmalı
//   - Sadece aksesuar oluşturur (levha atlanır)
//   - Duplicate check: name + brand_id çiftine göre
//
// Yanıt:
//   { ok: true, result: CreateNewProductsResult }
//   { ok: false, error: string }
// ==========================================

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = requireAdminMutationAuth(req);
    if (!auth.ok) return auth.response;

    const supabase = createServerSupabaseClient();
    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { ok: false, error: 'id parametresi zorunlu' },
            { status: 400 },
        );
    }

    // Dosya var mı ve uygun durumda mı?
    const { data: fileRow, error: fileErr } = await supabase
        .from('raw_import_files')
        .select('id, status, filename')
        .eq('id', id)
        .single();

    if (fileErr || !fileRow) {
        return NextResponse.json(
            { ok: false, error: `Import dosyası bulunamadı: ${id}` },
            { status: 404 },
        );
    }

    const allowedStatuses = ['matched', 'applied'];
    if (!allowedStatuses.includes(fileRow.status as string)) {
        return NextResponse.json(
            {
                ok: false,
                error: `Dosya uygun durumda değil (status=${fileRow.status}). Önce /api/import ile pipeline'ı çalıştırın.`,
            },
            { status: 422 },
        );
    }

    try {
        const result = await createNewProductsFromFile(supabase, id);

        return NextResponse.json({ ok: true, result });
    } catch (err) {
        const error = err instanceof Error ? err.message : 'Beklenmeyen hata';
        console.error(`[POST /api/import/${id}/create-new-products]`, error);
        return NextResponse.json({ ok: false, error }, { status: 500 });
    }
}

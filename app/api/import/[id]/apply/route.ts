import { NextResponse } from 'next/server';
import { applyImportFile } from '@/lib/importApplier';
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/import/[id]/apply
// Kanonik apply endpoint - staging -> production.
// { ok: true, result } | { ok: false, error }

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = requireAdminMutationAuth(req);
    if (!auth.ok) return auth.response;

    const supabase = createServerSupabaseClient();
    const { id } = await params;
    let allowExtremeDeviation = false;

    if (!id) {
        return NextResponse.json(
            { ok: false, error: 'id parametresi zorunlu' },
            { status: 400 },
        );
    }

    const { data: fileRow, error: fileErr } = await supabase
        .from('raw_import_files')
        .select('id, status')
        .eq('id', id)
        .single();

    if (fileErr || !fileRow) {
        return NextResponse.json(
            { ok: false, error: `Import dosyası bulunamadı: ${id}` },
            { status: 404 },
        );
    }

    if (fileRow.status === 'applied') {
        return NextResponse.json(
            { ok: false, error: 'Bu dosya zaten uygulandı (status=applied). Tekrar uygulama desteklenmez.' },
            { status: 409 },
        );
    }

    if (fileRow.status !== 'matched') {
        return NextResponse.json(
            { ok: false, error: `Dosya henüz eşleşme aşamasında değil (status=${fileRow.status}). Önce /api/import ile pipeline'ı çalıştırın.` },
            { status: 422 },
        );
    }

    try {
        const body = await req.json().catch(() => null) as { allowExtremeDeviation?: boolean } | null;
        allowExtremeDeviation = body?.allowExtremeDeviation === true;
    } catch {
        allowExtremeDeviation = false;
    }

    try {
        const result = await applyImportFile(supabase, id, { allowExtremeDeviation });
        return NextResponse.json({ ok: true, result });
    } catch (err) {
        const error = err instanceof Error ? err.message : 'Beklenmeyen hata';
        console.error(`[POST /api/import/${id}/apply]`, error);
        return NextResponse.json({ ok: false, error }, { status: 500 });
    }
}

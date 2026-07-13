import { NextResponse }        from 'next/server';
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { rollbackImportFile }  from '@/lib/importApplier';

// POST /api/import/[id]/rollback
// En son apply batch'ini geri alır (snapshot-based undo).
// { ok: true, result } | { ok: false, error }

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

    if (fileRow.status === 'rolling_back') {
        return NextResponse.json(
            { ok: false, error: 'Bu dosya zaten geri alınıyor (status=rolling_back).' },
            { status: 409 },
        );
    }

    if (fileRow.status !== 'applied') {
        return NextResponse.json(
            {
                ok:    false,
                error: `Dosya henüz uygulanmamış (status=${fileRow.status}). Sadece status=applied dosyalar geri alınabilir.`,
            },
            { status: 422 },
        );
    }

    try {
        const result = await rollbackImportFile(supabase, id);
        return NextResponse.json({ ok: true, result });
    } catch (err) {
        const error = err instanceof Error ? err.message : 'Beklenmeyen hata';
        console.error(`[POST /api/import/${id}/rollback]`, error);
        return NextResponse.json({ ok: false, error }, { status: 500 });
    }
}

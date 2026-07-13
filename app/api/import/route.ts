import { NextResponse } from 'next/server';
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth';
import { createServerSupabaseClient } from '@/lib/supabase-server';

import { parseExcelBuffer }  from '@/lib/importExcelParser';
import { normalizeImportRow } from '@/lib/importNormalizer';
import {
    matchImportRow,
    buildImportSummary,
    type MatchContext,
    type MatchPlateRecord,
    type MatchPlatePriceRecord,
    type MatchAccessoryRecord,
    type MatchAccessoryTypeRecord,
    type MatchBrandRecord,
    type MatchMaterialTypeRecord,
} from '@/lib/importMatcher';
import type { ImportPreviewRow, ImportPreviewRowDebug } from '@/lib/importTypes';

// ==========================================
// POST /api/import
//
// Akış:
//   multipart/form-data (file)
//     → Excel parse → RawImportRow[]
//     → raw_import_files INSERT (status='parsed')
//     → raw_import_rows INSERT (1 kayıt / satır)
//     → DB context çek (plates, plate_prices, accessories, brands, material_types)
//     → Her satır için: normalizeImportRow → matchImportRow
//     → import_match_results INSERT
//     → raw_import_files status='matched'
//     → { fileId, summary, rows: ImportPreviewRow[], sheetNames }
//
// Hata durumunda: raw_import_files.status='error' + { error }
// ==========================================

export async function POST(req: Request): Promise<NextResponse> {
    const auth = requireAdminMutationAuth(req);
    if (!auth.ok) return auth.response;

    const supabase = createServerSupabaseClient();
    let fileIdForCleanup: string | null = null;

    try {
        // ---- 1. Multipart parse ----
        const form = await req.formData();

        const file       = form.get('file');
        const uploadedBy = auth.user;

        if (!(file instanceof File)) {
            return NextResponse.json(
                { error: "'file' alanı zorunlu (multipart/form-data)" },
                { status: 400 },
            );
        }

        const buffer   = Buffer.from(await file.arrayBuffer());
        const filename = file.name;

        // ---- 2. Excel → RawImportRow[] ----
        const { rows: rawRows, sheetNames, parseWarnings } = parseExcelBuffer(buffer, filename);

        if (rawRows.length === 0) {
            return NextResponse.json(
                { error: `Dosyadan hiç satır çıkarılamadı. ${parseWarnings.join(' ')}` },
                { status: 422 },
            );
        }

        // ---- 3. raw_import_files INSERT ----
        const { data: fileRecord, error: fileInsertErr } = await supabase
            .from('raw_import_files')
            .insert({
                uploaded_by: uploadedBy,
                filename,
                row_count:   rawRows.length,
                status:      'parsed',
            })
            .select('id')
            .single();

        if (fileInsertErr || !fileRecord) {
            throw new Error(`raw_import_files insert hatası: ${fileInsertErr?.message}`);
        }

        const fileId = fileRecord.id as string;
        fileIdForCleanup = fileId;

        // ---- 4. raw_import_rows INSERT ----
        const rowInserts = rawRows.map(r => ({
            file_id:          fileId,
            row_index:        r.rowIndex,
            raw_product_name: r.rawProductName,
            raw_brand_hint:   r.rawBrandHint   ?? null,
            raw_price:        r.rawPrice,
            raw_kdv_hint:     r.rawKdvHint,
            raw_thickness:    r.rawThickness   ?? null,
            raw_isk1:         r.rawIsk1        ?? null,
            raw_isk2:         r.rawIsk2        ?? null,
            raw_package_m2:   r.rawPackageM2   ?? null,
            parse_warnings:   r.parseWarnings,
        }));

        const { error: rowsInsertErr } = await supabase
            .from('raw_import_rows')
            .insert(rowInserts);

        if (rowsInsertErr) {
            throw new Error(`raw_import_rows insert hatası: ${rowsInsertErr.message}`);
        }

        // ---- 5. DB context (eşleşme için) — paralel sorgular ----
        const [
            { data: plates,        error: pErr  },
            { data: platePrices,   error: ppErr },
            { data: accessories,   error: aErr  },
            { data: accessoryTypes,error: atErr },
            { data: brands,        error: bErr  },
            { data: materialTypes, error: mErr  },
            accessoryCatalogResult,
        ] = await Promise.all([
            supabase.from('plates').select('id, brand_id, material_type_id, short_name'),
            supabase.from('plate_prices').select('id, plate_id, thickness, base_price, is_kdv_included'),
            supabase.from('accessories').select('id, brand_id, accessory_type_id, short_name, name, base_price, is_kdv_included, unit, unit_content, is_for_eps, is_for_tasyunu'),
            supabase.from('accessory_types').select('id, slug'),
            supabase.from('brands').select('id, name'),
            supabase.from('material_types').select('id, slug'),
            supabase
                .from('accessory_match_catalog')
                .select('accessory_id, product_class, family_canonical, variant_canonical, size_token, material_scope, commercial_mode, quality_band, package_slot'),
        ]);

        if (pErr || ppErr || aErr || atErr || bErr || mErr) {
            throw new Error(
                `DB context sorgu hatası: ${[pErr, ppErr, aErr, atErr, bErr, mErr]
                    .filter(Boolean).map(e => e!.message).join(', ')}`,
            );
        }

        if (accessoryCatalogResult.error) {
            console.warn('[/api/import] accessory_match_catalog query warning:', accessoryCatalogResult.error.message);
        }

        const accessoryCatalogById = new Map<number, Record<string, unknown>>(
            (accessoryCatalogResult.data ?? []).map(row => [row.accessory_id as number, row as Record<string, unknown>]),
        );

        const ctx: MatchContext = {
            plates:        (plates        ?? []) as MatchPlateRecord[],
            platePrices:   (platePrices   ?? []) as MatchPlatePriceRecord[],
            accessories:   ((accessories  ?? []) as MatchAccessoryRecord[]).map(accessory => ({
                ...accessory,
                ...(accessoryCatalogById.get(accessory.id) ?? {}),
            })),
            brands:        (brands        ?? []) as MatchBrandRecord[],
            materialTypes: (materialTypes ?? []) as MatchMaterialTypeRecord[],
            accessoryTypes:(accessoryTypes ?? []) as MatchAccessoryTypeRecord[],
        };

        // ---- 6. raw_import_rows'tan DB uuid'leri al (rowIndex → uuid map) ----
        const { data: savedRows, error: savedRowsErr } = await supabase
            .from('raw_import_rows')
            .select('id, row_index')
            .eq('file_id', fileId)
            .order('row_index');

        if (savedRowsErr || !savedRows) {
            throw new Error(`raw_import_rows sorgulama hatası: ${savedRowsErr?.message}`);
        }

        const rowIndexToUuid = new Map<number, string>(
            savedRows.map(r => [r.row_index as number, r.id as string]),
        );

        // ---- 7. Normalize + Match ----
        const previewRows:        ImportPreviewRow[] = [];
        const matchResultInserts: object[]           = [];

        for (const raw of rawRows) {
            const normalized = normalizeImportRow(raw);
            const match      = matchImportRow(normalized, ctx);

            const debug: ImportPreviewRowDebug = {
                productType:       normalized.productType,
                materialType:      normalized.materialType,
                thicknessCm:       normalized.thicknessCm       ?? null,
                productClass:      normalized.productClass,
                brandCanonical:    normalized.brandCanonical     ?? null,
                familyCanonical:   normalized.familyCanonical    ?? null,
                variantCanonical:  normalized.variantCanonical   ?? null,
                measurement:       normalized.measurement        ?? null,
                canonicalWarnings: normalized.canonicalWarnings,
                base_price_raw:    normalized.base_price_raw,
                base_price_net:    normalized.base_price_net,
                warnings:          normalized.warnings,
            };

            previewRows.push({ raw, debug, match });

            const rowUuid = rowIndexToUuid.get(raw.rowIndex);
            if (!rowUuid) continue;

            const best = match.bestCandidate;

            matchResultInserts.push({
                row_id:                 rowUuid,
                product_type:           normalized.productType !== 'unknown' ? normalized.productType : null,
                material_type:          normalized.materialType !== 'unknown' ? normalized.materialType : null,
                thickness_cm:           normalized.thicknessCm ?? null,
                base_price_raw:         normalized.base_price_raw,
                base_price_net:         normalized.base_price_net,
                match_status:           match.status,
                confidence:             best?.confidence ?? null,
                matched_plate_id:       best?.plateId ?? null,
                matched_plate_price_id: best?.platePriceId ?? null,
                matched_accessory_id:   best?.accessoryId ?? null,
                price_change_pct:       match.priceChangePct ?? null,
                requires_review:        match.requiresReview,
                warnings:               normalized.warnings,
            });
        }

        // ---- 8. import_match_results INSERT ----
        if (matchResultInserts.length > 0) {
            const { error: matchInsertErr } = await supabase
                .from('import_match_results')
                .insert(matchResultInserts);

            if (matchInsertErr) {
                // Non-fatal: preview döndürebiliriz ama log'a yaz
                console.error('[/api/import] import_match_results insert hatası:', matchInsertErr.message);
            }
        }

        // ---- 9. Dosya durumunu 'matched' yap ----
        await supabase
            .from('raw_import_files')
            .update({ status: 'matched' })
            .eq('id', fileId);

        // ---- 10. Yanıt ----
        const summary = buildImportSummary(previewRows);

        // previewRows zaten { raw, debug, match } yapısında; doğrudan kullan.
        const responseRows = previewRows;

        return NextResponse.json({
            fileId,
            summary,
            rows:       responseRows,
            sheetNames,
        });

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
        console.error('[POST /api/import] error:', message);

        if (fileIdForCleanup) {
            try {
                await supabase
                    .from('raw_import_files')
                    .update({ status: 'error' })
                    .eq('id', fileIdForCleanup);
            } catch { /* ignore cleanup errors */ }
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}

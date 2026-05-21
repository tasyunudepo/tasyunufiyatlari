import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { buildMinimumOrderLabel } from '@/lib/catalog/slug';
import type { SupabasePlateRow, SupabaseAccessoryRow } from '@/lib/catalog/server';
import type {
  CatalogProductView,
  CatalogProductsResponse,
  ProductRules,
  MinimumOrderSummary,
  WizardPrefill,
} from '@/lib/catalog/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const material  = searchParams.get('material');  // 'tasyunu' | 'eps' | 'aksesuar'
  const brand     = searchParams.get('brand');      // brand name
  const kategori  = searchParams.get('kategori');  // material_type.slug veya accessory_type.slug

  const supabase = createServerSupabaseClient();

  // ─── Plates sorgusu ─────────────────────────────────────────
  let platesQuery = supabase
    .from('plates')
    .select(`
      id, name, short_name, slug, base_price, discount_2,
      thickness_options, preferred_thickness, sales_mode, pricing_visibility_mode,
      minimum_order_type, minimum_order_value,
      requires_city_for_pricing, requires_system_context,
      recommended_bundle_family,
      catalog_description, meta_title, meta_description,
      image_cover, image_gallery,
      stock_tuzla, depot_discount, depot_min_m2,
      brands!inner ( id, name, tier ),
      material_types!inner ( id, name, slug )
    `)
    .eq('is_active', true)
    .not('slug', 'is', null);

  // material_types filtreleri: join üzerinden değil, FK kolonu üzerinden
  const MATERIAL_IDS: Record<string, number> = { tasyunu: 2, eps: 1 };
  const materialId = material && MATERIAL_IDS[material];
  const kategoriId = kategori && MATERIAL_IDS[kategori];
  if (materialId) {
    platesQuery = platesQuery.eq('material_type_id', materialId);
  } else if (kategoriId) {
    platesQuery = platesQuery.eq('material_type_id', kategoriId);
  }
  if (brand) {
    platesQuery = platesQuery.ilike('brands.name', `%${brand}%`);
  }

  // aksesuar filtresi varsa plates'i boş döndür
  const fetchPlates = !material || material !== 'aksesuar';

  // ─── Accessories sorgusu (material=aksesuar) ─────────────────
  let accessoriesResult: { data: SupabaseAccessoryRow[] | null; error: unknown } = { data: [], error: null };
  if (material === 'aksesuar') {
    let accQuery = supabase
      .from('accessories')
      .select(`
        id, name, short_name, slug, base_price,
        sales_mode, pricing_visibility_mode,
        minimum_order_type, minimum_order_value,
        requires_system_context,
        recommended_bundle_family, catalog_description,
        image_cover, brand_id,
        brands!inner ( id, name, tier ),
        accessory_types!inner ( id, name, slug )
      `)
      .eq('is_active', true)
      .not('slug', 'is', null)
      .neq('sales_mode', 'system_only'); // Sistem ürünlerini gizle

    if (brand) {
      accQuery = accQuery.ilike('brands.name', `%${brand}%`);
    }

    const result = await accQuery;
    accessoriesResult = {
      data: (result.data ?? []) as unknown as SupabaseAccessoryRow[],
      error: result.error,
    };
  }

  const [platesResult] = await Promise.all([
    fetchPlates ? platesQuery : Promise.resolve({ data: [], error: null }),
  ]);

  if (platesResult.error || accessoriesResult.error) {
    return NextResponse.json({ error: 'Ürünler yüklenemedi' }, { status: 500 });
  }

  // ─── plates → CatalogProductView[] ──────────────────────────
  const platesRows = (platesResult.data ?? []) as unknown as SupabasePlateRow[];
  const products: CatalogProductView[] = platesRows.map((row) => {
    const rules: ProductRules = {
      sales_mode:               row.sales_mode               ?? 'quote_only',
      pricing_visibility_mode:  row.pricing_visibility_mode  ?? 'quote_required',
      minimum_order_type:       row.minimum_order_type       ?? 'm2',
      minimum_order_value:      row.minimum_order_value      ?? null,
      requires_city_for_pricing: row.requires_city_for_pricing ?? true,
      requires_system_context:  row.requires_system_context  ?? false,
      recommended_bundle_family: row.recommended_bundle_family ?? null,
    };

    const minimum_order: MinimumOrderSummary = {
      has_minimum: rules.minimum_order_type !== 'none',
      label: buildMinimumOrderLabel(rules.minimum_order_type, rules.minimum_order_value),
    };

    // Fiyat maskeleme
    const base_price =
      rules.pricing_visibility_mode === 'hidden' ? null : (row.base_price ?? null);

    // Dominant kalınlık: thickness_options'ın ilk elemanı
    const dominantThickness =
      Array.isArray(row.thickness_options) && row.thickness_options.length > 0
        ? row.thickness_options[0]
        : null;

    const wizard_prefill: WizardPrefill = {
      levhaTipi: (row.material_types?.slug as 'tasyunu' | 'eps') ?? null,
      markaId:   row.brands?.id ?? null,
      markaAdi:  row.brands?.name ?? null,
      modelId:   row.id,
      modelAdi:  row.short_name ?? row.name,
      kalinlik:  dominantThickness,
    };

    return {
      id:          row.id,
      slug:        row.slug,
      name:        row.name,
      brand: {
        id:   row.brands?.id   ?? 0,
        name: row.brands?.name ?? '',
        tier: row.brands?.tier ?? '',
      },
      model:             row.short_name ?? null,
      thickness_options: row.thickness_options ?? null,
      category: {
        slug: row.material_types?.slug ?? '',
        name: row.material_types?.name ?? '',
      },
      material_type: row.material_types?.slug ?? '',
      product_type:  'plate' as const,
      base_price,
      thickness_prices: null,
      rules,
      minimum_order,
      catalog_description: row.catalog_description ?? null,
      meta_title:          row.meta_title          ?? null,
      meta_description:    row.meta_description    ?? null,
      image_cover:         row.image_cover         ?? null,
      image_gallery:       row.image_gallery       ?? null,
      wizard_prefill,
      depot_stock:    row.stock_tuzla    ?? 0,
      depot_discount: row.depot_discount ?? 0,
      depot_min_m2:   row.depot_min_m2   ?? 300,
    };
  });

  // ─── accessories → CatalogProductView[] ─────────────────────
  const accProducts: CatalogProductView[] = (accessoriesResult.data ?? []).map((row) => {
    const rules: ProductRules = {
      sales_mode:               row.sales_mode               ?? 'single_or_quote',
      pricing_visibility_mode:  row.pricing_visibility_mode  ?? 'quote_required',
      minimum_order_type:       row.minimum_order_type       ?? 'none',
      minimum_order_value:      row.minimum_order_value      ?? null,
      requires_city_for_pricing: false,
      requires_system_context:  row.requires_system_context  ?? false,
      recommended_bundle_family: row.recommended_bundle_family ?? null,
    };

    const minimum_order: MinimumOrderSummary = {
      has_minimum: rules.minimum_order_type !== 'none',
      label: buildMinimumOrderLabel(rules.minimum_order_type, rules.minimum_order_value),
    };

    const base_price =
      rules.pricing_visibility_mode === 'hidden' ? null : (row.base_price ?? null);

    return {
      id:          row.id,
      slug:        row.slug,
      name:        row.name,
      brand: {
        id:   row.brands?.id   ?? 0,
        name: row.brands?.name ?? '',
        tier: row.brands?.tier ?? '',
      },
      model:             row.short_name ?? null,
      thickness_options: null,
      category: {
        slug: row.accessory_types?.slug ?? 'aksesuar',
        name: row.accessory_types?.name ?? 'Aksesuar',
      },
      material_type: 'aksesuar',
      product_type:  'accessory' as const,
      base_price,
      thickness_prices: null,
      rules,
      minimum_order,
      catalog_description: row.catalog_description ?? null,
      meta_title:          null,
      meta_description:    null,
      image_cover:         row.image_cover         ?? null,
      image_gallery:       null,
      wizard_prefill:      null,
      depot_stock:    null,
      depot_discount: null,
      depot_min_m2:   null,
    };
  });

  products.push(...accProducts);

  const filters_applied: Record<string, string> = {};
  if (material)  filters_applied.material  = material;
  if (brand)     filters_applied.brand     = brand;
  if (kategori)  filters_applied.kategori  = kategori;

  const response: CatalogProductsResponse = {
    products,
    total: products.length,
    filters_applied,
  };

  return NextResponse.json(response);
}

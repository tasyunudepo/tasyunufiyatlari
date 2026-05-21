import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { buildMinimumOrderLabel } from '@/lib/catalog/slug';
import { getDecisionContext } from '@/lib/catalog/decision';
import type { SupabasePlateRow, SupabaseAccessoryRow } from '@/lib/catalog/server';
import type {
  CatalogProductView,
  CatalogProductDetailResponse,
  ProductRules,
  MinimumOrderSummary,
  WizardPrefill,
} from '@/lib/catalog/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createServerSupabaseClient();

  const { data: rawRow, error } = await supabase
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
      brands ( id, name, tier ),
      material_types ( id, name, slug )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  // plates'de bulunamazsa accessories'e bak
  if (error || !rawRow) {
    const { data: rawAccRow, error: accError } = await supabase
      .from('accessories')
      .select(`
        id, name, short_name, slug, base_price,
        sales_mode, pricing_visibility_mode,
        minimum_order_type, minimum_order_value,
        requires_system_context, recommended_bundle_family,
        catalog_description,
        image_cover, brand_id,
        brands ( id, name, tier ),
        accessory_types ( id, name, slug )
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (accError || !rawAccRow) {
      return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 });
    }

    const accRow = rawAccRow as unknown as SupabaseAccessoryRow;
    const rules: ProductRules = {
      sales_mode:               accRow.sales_mode               ?? 'single_or_quote',
      pricing_visibility_mode:  accRow.pricing_visibility_mode  ?? 'quote_required',
      minimum_order_type:       accRow.minimum_order_type       ?? 'none',
      minimum_order_value:      accRow.minimum_order_value      ?? null,
      requires_city_for_pricing: false,
      requires_system_context:  accRow.requires_system_context  ?? false,
      recommended_bundle_family: accRow.recommended_bundle_family ?? null,
    };
    const minimum_order: MinimumOrderSummary = {
      has_minimum: rules.minimum_order_type !== 'none',
      label: buildMinimumOrderLabel(rules.minimum_order_type, rules.minimum_order_value),
    };
    const base_price = rules.pricing_visibility_mode === 'hidden' ? null : (accRow.base_price ?? null);
    const product: CatalogProductView = {
      id:   accRow.id,
      slug: accRow.slug,
      name: accRow.name,
      brand: {
        id:   accRow.brands?.id   ?? 0,
        name: accRow.brands?.name ?? '',
        tier: accRow.brands?.tier ?? '',
      },
      model: accRow.short_name ?? null,
      thickness_options: null,
      category: {
        slug: accRow.accessory_types?.slug ?? 'aksesuar',
        name: accRow.accessory_types?.name ?? 'Aksesuar',
      },
      material_type: 'aksesuar',
      product_type: 'accessory',
      base_price,
      thickness_prices: null,
      rules,
      minimum_order,
      catalog_description: accRow.catalog_description ?? null,
      meta_title:   null,
      meta_description: null,
      image_cover:    accRow.image_cover ?? null,
      image_gallery:  null,
      wizard_prefill: null,
      depot_stock:    null,
      depot_discount: null,
      depot_min_m2:   null,
    };
    const decision = getDecisionContext(rules, null);
    return NextResponse.json({ product, decision } as CatalogProductDetailResponse);
  }

  const row = rawRow as unknown as SupabasePlateRow;
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

  const base_price =
    rules.pricing_visibility_mode === 'hidden' ? null : (row.base_price ?? null);

  const dominantThickness =
    Array.isArray(row.thickness_options) && row.thickness_options.length > 0
      ? row.thickness_options[0]
      : null;

  const wizard_prefill: WizardPrefill = {
    levhaTipi: (row.material_types?.slug as 'tasyunu' | 'eps') ?? null,
    markaId:   row.brands?.id   ?? null,
    markaAdi:  row.brands?.name ?? null,
    modelId:   row.id,
    modelAdi:  row.short_name ?? row.name,
    kalinlik:  dominantThickness,
  };

  const product: CatalogProductView = {
    id:   row.id,
    slug: row.slug,
    name: row.name,
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
    product_type:  'plate',
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

  const decision = getDecisionContext(rules, wizard_prefill);
  const response: CatalogProductDetailResponse = { product, decision };
  return NextResponse.json(response);
}

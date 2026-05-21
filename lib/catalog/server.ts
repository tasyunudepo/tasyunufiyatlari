// ============================================================
// Catalog Server-Side Data Fetching
// Server component'larda kullanılır — HTTP fetch değil, direkt Supabase.
// ============================================================

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { buildMinimumOrderLabel } from '@/lib/catalog/slug';
import { getDecisionContext } from '@/lib/catalog/decision';
import { KATEGORI_MAP } from '@/lib/catalog/categories';
import type {
  CatalogProductView,
  CatalogProductDetailResponse,
  CatalogProductsResponse,
  ProductRules,
  MinimumOrderSummary,
  WizardPrefill,
  SalesMode,
  PricingVisibilityMode,
  MinimumOrderType,
} from '@/lib/catalog/types';

const MATERIAL_IDS: Record<string, number> = { tasyunu: 2, eps: 1 };

// Supabase'den dönen ham satır şekilleri — sadece okuduğumuz alanlar.
// API route'ları aynı select() iskeletini paylaşıyor; tek kaynaktan tüketsinler.
export type SupabasePlateRow = {
  id: number;
  name: string;
  short_name: string | null;
  slug: string;
  base_price: number | null;
  discount_2: number | null;
  thickness_options: number[] | null;
  preferred_thickness: number | null;
  sales_mode: SalesMode | null;
  pricing_visibility_mode: PricingVisibilityMode | null;
  minimum_order_type: MinimumOrderType | null;
  minimum_order_value: number | null;
  requires_city_for_pricing: boolean | null;
  requires_system_context: boolean | null;
  recommended_bundle_family: string | null;
  catalog_description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  image_cover: string | null;
  image_gallery: string[] | null;
  stock_tuzla: number | null;
  depot_discount: number | null;
  depot_min_m2: number | null;
  brands: { id: number; name: string; tier: string } | null;
  material_types: { id: number; name: string; slug: string } | null;
  plate_prices: Array<{
    thickness: number | null;
    base_price: number | string | null;
    is_kdv_included: boolean | null;
    stock_tuzla: number | null;
    package_m2: number | string | null;
    discount_2?: number | null;
  }> | null;
};

export type SupabaseAccessoryRow = {
  id: number;
  name: string;
  short_name: string | null;
  slug: string;
  base_price: number | null;
  sales_mode: SalesMode | null;
  pricing_visibility_mode: PricingVisibilityMode | null;
  minimum_order_type: MinimumOrderType | null;
  minimum_order_value: number | null;
  requires_system_context: boolean | null;
  recommended_bundle_family: string | null;
  catalog_description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  image_cover: string | null;
  brand_id: number;
  brands: { id: number; name: string; tier: string } | null;
  accessory_types: { id: number; name: string; slug: string } | null;
};

// ─── Plates listesi ──────────────────────────────────────────

export async function getCatalogProducts(
  material: string,
  options?: { accessoryTypeSlug?: string; brandId?: number }
): Promise<CatalogProductsResponse> {
  const supabase = createServerSupabaseClient();

  if (material === 'aksesuar') {
    const { data, error } = await supabase
      .from('accessories')
      .select(`
        id, name, short_name, slug, base_price,
        sales_mode, pricing_visibility_mode,
        minimum_order_type, minimum_order_value,
        requires_system_context, recommended_bundle_family,
        catalog_description, meta_title, meta_description,
        image_cover, brand_id,
        brands ( id, name, tier ),
        accessory_types ( id, name, slug )
      `)
      .eq('is_active', true)
      .not('slug', 'is', null)
      .neq('sales_mode', 'system_only');

    if (error) return { products: [], total: 0, filters_applied: { material } };

    let rows = (data ?? []) as unknown as SupabaseAccessoryRow[];
    if (options?.accessoryTypeSlug) {
      rows = rows.filter((r) => r.accessory_types?.slug === options.accessoryTypeSlug);
    }
    if (options?.brandId != null) {
      rows = rows.filter((r) => r.brand_id === options.brandId);
    }

    const products: CatalogProductView[] = rows.map((row) => {
      const rules = buildAccessoryRules(row);
      const minimum_order = buildMinOrder(rules);
      const base_price = rules.pricing_visibility_mode === 'hidden' ? null : (row.base_price ?? null);
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        brand: { id: row.brands?.id ?? 0, name: row.brands?.name ?? '', tier: row.brands?.tier ?? '' },
        model: row.short_name ?? null,
        thickness_options: null,
        category: { slug: row.accessory_types?.slug ?? 'aksesuar', name: row.accessory_types?.name ?? 'Aksesuar' },
        material_type: 'aksesuar',
        product_type: 'accessory' as const,
        base_price,
        thickness_prices: null,
        rules,
        minimum_order,
        catalog_description: row.catalog_description ?? null,
        meta_title:          row.meta_title          ?? null,
        meta_description:    row.meta_description    ?? null,
        image_cover: row.image_cover ?? null,
        image_gallery: null,
        wizard_prefill: null,
        depot_stock:    null,
        depot_discount: null,
        depot_min_m2:   null,
      };
    });

    return { products, total: products.length, filters_applied: { material } };
  }

  // plates
  let query = supabase
    .from('plates')
    .select(`
      id, name, short_name, slug, base_price, discount_2,
      thickness_options, preferred_thickness, sales_mode, pricing_visibility_mode,
      minimum_order_type, minimum_order_value,
      requires_city_for_pricing, requires_system_context,
      recommended_bundle_family, catalog_description, meta_title, meta_description,
      image_cover, image_gallery,
      stock_tuzla, depot_discount, depot_min_m2,
      brands ( id, name, tier ),
      material_types ( id, name, slug ),
      plate_prices ( thickness, base_price, is_kdv_included, stock_tuzla, package_m2 )
    `)
    .eq('is_active', true)
    .not('slug', 'is', null);

  const materialId = MATERIAL_IDS[material];
  if (materialId) {
    query = query.eq('material_type_id', materialId);
  }
  if (options?.brandId != null) {
    query = query.eq('brand_id', options.brandId);
  }

  const { data, error } = await query;
  if (error) return { products: [], total: 0, filters_applied: { material } };

  const products: CatalogProductView[] = ((data ?? []) as unknown as SupabasePlateRow[]).map((row) =>
    buildPlateView(row)
  );

  return { products, total: products.length, filters_applied: { material } };
}

// ─── Brand bazlı katalog (marka sayfaları için) ──────────────

export async function getCatalogProductsByBrand(brandId: number): Promise<{
  plates: CatalogProductView[];
  accessories: CatalogProductView[];
}> {
  const [tasyunu, eps, aksesuar] = await Promise.all([
    getCatalogProducts('tasyunu',  { brandId }),
    getCatalogProducts('eps',      { brandId }),
    getCatalogProducts('aksesuar', { brandId }),
  ]);
  return {
    plates:      [...tasyunu.products, ...eps.products],
    accessories: aksesuar.products,
  };
}

// ─── Tekil ürün detayı ───────────────────────────────────────

export async function getCatalogProduct(
  slug: string,
  kategori?: string
): Promise<CatalogProductDetailResponse | null> {
  const supabase = createServerSupabaseClient();

  // Kategori → KATEGORI_MAP üzerinden material/accessory_type otoritesi.
  // Bilinmeyen kategori 404 (yanlış route).
  const info = kategori ? KATEGORI_MAP[kategori] : undefined;
  if (kategori && !info) return null;

  const wantPlates           = !info || info.material === 'tasyunu' || info.material === 'eps';
  const wantAccessories      = !info || info.material === 'aksesuar';
  const expectedAccessoryType = info?.accessoryTypeSlug ?? null;
  const expectedMaterialId   =
    info?.material === 'tasyunu' ? MATERIAL_IDS.tasyunu :
    info?.material === 'eps'     ? MATERIAL_IDS.eps     : null;

  // Plates sorgusu (aksesuar kategorisinde atla)
  if (wantPlates) {
    let plateQuery = supabase
      .from('plates')
      .select(`
        id, name, short_name, slug, base_price, discount_2,
        thickness_options, preferred_thickness, sales_mode, pricing_visibility_mode,
        minimum_order_type, minimum_order_value,
        requires_city_for_pricing, requires_system_context,
        recommended_bundle_family, catalog_description, meta_title, meta_description,
        image_cover, image_gallery,
        stock_tuzla, depot_discount, depot_min_m2,
        brands ( id, name, tier ),
        material_types ( id, name, slug ),
        plate_prices ( thickness, base_price, is_kdv_included, stock_tuzla, package_m2 )
      `)
      .eq('slug', slug)
      .eq('is_active', true);
    if (expectedMaterialId != null) {
      plateQuery = plateQuery.eq('material_type_id', expectedMaterialId);
    }
    const { data: plateRow } = await plateQuery.single();

    if (plateRow) {
      const product = buildPlateView(plateRow as unknown as SupabasePlateRow);
      const decision = getDecisionContext(product.rules, product.wizard_prefill ?? undefined);
      return { product, decision };
    }
  }

  // Accessories sorgusu (tasyunu/eps kategorisinde atla)
  if (wantAccessories) {
    const { data: accRow } = await supabase
      .from('accessories')
      .select(`
        id, name, short_name, slug, base_price,
        sales_mode, pricing_visibility_mode,
        minimum_order_type, minimum_order_value,
        requires_system_context, recommended_bundle_family,
        catalog_description, meta_title, meta_description,
        image_cover,
        brands ( id, name, tier ),
        accessory_types ( id, name, slug )
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (accRow) {
      const row = accRow as unknown as SupabaseAccessoryRow;
      const accTypeSlug = row.accessory_types?.slug ?? null;

      // Kategori bir aksesuar slug'ı ise, accessory_types.slug eşleşmek zorunda
      if (expectedAccessoryType && accTypeSlug !== expectedAccessoryType) {
        return null;
      }

      const rules = buildAccessoryRules(row);
      const minimum_order = buildMinOrder(rules);
      const base_price = rules.pricing_visibility_mode === 'hidden' ? null : (row.base_price ?? null);

      const product: CatalogProductView = {
        id: row.id,
        slug: row.slug,
        name: row.name,
        brand: {
          id:   row.brands?.id   ?? 0,
          name: row.brands?.name ?? '',
          tier: row.brands?.tier ?? '',
        },
        model: row.short_name ?? null,
        thickness_options: null,
        category: {
          slug: row.accessory_types?.slug ?? 'aksesuar',
          name: row.accessory_types?.name ?? 'Aksesuar',
        },
        material_type: 'aksesuar',
        product_type: 'accessory',
        base_price,
        thickness_prices: null,
        rules,
        minimum_order,
        catalog_description: row.catalog_description ?? null,
        meta_title:          row.meta_title          ?? null,
        meta_description:    row.meta_description    ?? null,
        image_cover: row.image_cover ?? null,
        image_gallery: null,
        wizard_prefill: null,
        depot_stock:    null,
        depot_discount: null,
        depot_min_m2:   null,
      };

      const decision = getDecisionContext(rules, null);
      return { product, decision };
    }
  }

  return null;
}

// ─── Yardımcılar ─────────────────────────────────────────────

function buildPlateView(row: SupabasePlateRow): CatalogProductView {
  const brand = row.brands;
  const materialType = row.material_types;

  const rules: ProductRules = {
    sales_mode:               row.sales_mode               ?? 'quote_only',
    pricing_visibility_mode:  row.pricing_visibility_mode  ?? 'quote_required',
    minimum_order_type:       row.minimum_order_type       ?? 'm2',
    minimum_order_value:      row.minimum_order_value      ?? null,
    requires_city_for_pricing: row.requires_city_for_pricing ?? true,
    requires_system_context:  row.requires_system_context  ?? false,
    recommended_bundle_family: row.recommended_bundle_family ?? null,
  };

  const minimum_order = buildMinOrder(rules);
  const base_price = rules.pricing_visibility_mode === 'hidden' ? null : (row.base_price ?? null);

  // thickness_prices: plate_prices'tan tam fiyat tablosu
  type PriceRow = {
    thickness: number;
    base_price: number;
    is_kdv_included: boolean;
    discount_2: number;
    stock_tuzla: number;
    package_m2: number | null;
  };
  const plateLevelDiscount2: number = row.discount_2 ?? 8;
  const thickness_prices: PriceRow[] | null = (() => {
    if (!Array.isArray(row.plate_prices) || row.plate_prices.length === 0) return null;
    const rows = row.plate_prices
      .filter((p): p is typeof p & { thickness: number; base_price: number | string } =>
        p.thickness != null && p.base_price != null)
      .map(p => ({
        thickness:       p.thickness,
        base_price:      parseFloat(String(p.base_price)),
        is_kdv_included: p.is_kdv_included ?? false,
        discount_2:      p.discount_2 ?? plateLevelDiscount2,
        stock_tuzla:     p.stock_tuzla ?? 0,
        package_m2:      p.package_m2 != null ? parseFloat(String(p.package_m2)) : null,
      }))
      .sort((a, b) => a.thickness - b.thickness);
    return rows.length > 0 ? rows : null;
  })();

  // thickness_options: plate_prices'tan türet (her zaman güncel), fallback: statik dizi
  const derivedThicknesses: number[] | null = (() => {
    if (thickness_prices && thickness_prices.length > 0) {
      return thickness_prices.map(p => p.thickness);
    }
    if (Array.isArray(row.thickness_options) && row.thickness_options.length > 0) {
      return row.thickness_options as number[];
    }
    return null;
  })();

  const dominantThickness = (() => {
    if (!derivedThicknesses || derivedThicknesses.length === 0) return null;
    const preferred = row.preferred_thickness as number | null | undefined;
    if (preferred != null && derivedThicknesses.includes(preferred)) return preferred;
    return derivedThicknesses[0];
  })();

  const wizard_prefill: WizardPrefill = {
    levhaTipi: (materialType?.slug as 'tasyunu' | 'eps') ?? null,
    markaId:   brand?.id   ?? null,
    markaAdi:  brand?.name ?? null,
    modelId:   row.id,
    modelAdi:  row.short_name ?? row.name,
    kalinlik:  dominantThickness,
  };

  return {
    id:   row.id,
    slug: row.slug,
    name: row.name,
    brand: { id: brand?.id ?? 0, name: brand?.name ?? '', tier: brand?.tier ?? '' },
    model:             row.short_name ?? null,
    thickness_options: derivedThicknesses,
    category: { slug: materialType?.slug ?? '', name: materialType?.name ?? '' },
    material_type: materialType?.slug ?? '',
    product_type:  'plate',
    base_price,
    thickness_prices,
    rules,
    minimum_order,
    catalog_description: row.catalog_description ?? null,
    meta_title:          row.meta_title          ?? null,
    meta_description:    row.meta_description    ?? null,
    image_cover:         row.image_cover         ?? null,
    image_gallery:       row.image_gallery       ?? null,
    wizard_prefill,
    depot_stock:    thickness_prices
      ? thickness_prices.reduce((sum, p) => sum + (p.stock_tuzla ?? 0), 0)
      : 0,
    depot_discount: row.depot_discount ?? 0,
    depot_min_m2:   row.depot_min_m2   ?? 300,
  };
}

function buildAccessoryRules(row: SupabaseAccessoryRow): ProductRules {
  return {
    sales_mode:               row.sales_mode               ?? 'single_or_quote',
    pricing_visibility_mode:  row.pricing_visibility_mode  ?? 'quote_required',
    minimum_order_type:       row.minimum_order_type       ?? 'none',
    minimum_order_value:      row.minimum_order_value      ?? null,
    requires_city_for_pricing: false,
    requires_system_context:  row.requires_system_context  ?? false,
    recommended_bundle_family: row.recommended_bundle_family ?? null,
  };
}

function buildMinOrder(rules: ProductRules): MinimumOrderSummary {
  return {
    has_minimum: rules.minimum_order_type !== 'none',
    label: buildMinimumOrderLabel(rules.minimum_order_type, rules.minimum_order_value),
  };
}

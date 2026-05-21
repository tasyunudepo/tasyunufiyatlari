// ============================================================
// /urunler hub sayfası için server-side data fetcher.
// Tek async fonksiyon, paralel sub-queries.
// system_only ürünler aggregate'e DAHİL — çünkü hub kartları
// sistem-içinde aksesuar kategorilerini de göstermeli.
// ============================================================

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { KATEGORI_LIST, type CategoryInfo } from '@/lib/catalog/categories';

export type HubBadge = 'tekil' | 'sistem' | 'mixed';

export type HubKategoriRow = CategoryInfo & {
  slug: string;
  urun_sayisi: number;
  marka_sayisi: number;
  hero_image: string | null;
  badge: HubBadge;
  thickness_range?: string;   // hero kartlar için (örn "4–12 cm")
};

export type HubBrand = {
  slug: string;       // /marka/[slug] route eşlemesi
  name: string;       // chip label
  total: number;      // ürün toplamı (plates + accessories, slug NOT NULL filtreli)
};

export type HubData = {
  totals: {
    kategori: number;
    urun: number;
    marka: number;
  };
  kategoriler: HubKategoriRow[];   // KATEGORI_LIST sırasıyla
  markalar: HubBrand[];            // chip row için, total_urun DESC
};

// Brand id → /marka/[slug] eşlemesi (BRAND_MAP ile uyumlu).
const BRAND_SLUG_BY_ID: Record<number, { slug: string; name: string }> = {
  1:  { slug: 'dalmacyali',  name: 'Dalmaçyalı' },
  2:  { slug: 'filli-boya',  name: 'Fawori Expert' },   // DB'de "Expert" = Fawori Expert
  4:  { slug: 'optimix',     name: 'Fawori Optimix' },
  6:  { slug: 'tekno',       name: 'TEKNO' },
  11: { slug: 'oem',         name: 'Ekonomik' },         // 2.kalite line
};

const HUB_BRAND_IDS = [1, 2, 4, 6, 11];

export async function getUrunlerHubData(): Promise<HubData> {
  const supabase = createServerSupabaseClient();

  // ── Paralel queries ─────────────────────────────────────────
  const [platesResult, accessoriesResult, brandPlatesResult, brandAccsResult] =
    await Promise.all([
      // 1. Plates: tasyunu + eps için aggregate kaynağı
      supabase
        .from('plates')
        .select(`
          id, brand_id, image_cover, thickness_options,
          material_types ( id, slug )
        `)
        .eq('is_active', true)
        .not('slug', 'is', null),

      // 2. Accessories: her tip için aggregate kaynağı
      //    NOT: system_only DAHİL — hub kartlarında sayım için lazım
      supabase
        .from('accessories')
        .select(`
          id, brand_id, image_cover, sales_mode,
          accessory_types ( id, slug )
        `)
        .eq('is_active', true),

      // 3. Brand totals — plates kısmı
      supabase
        .from('plates')
        .select('id, brand_id')
        .eq('is_active', true)
        .not('slug', 'is', null)
        .in('brand_id', HUB_BRAND_IDS),

      // 4. Brand totals — accessories kısmı (sadece slug'lı = listelenebilir ürünler;
      //    /marka/[brand] sayfaları aynı filtreyi uyguluyor, chip sayısı tutarlı kalsın)
      supabase
        .from('accessories')
        .select('id, brand_id')
        .eq('is_active', true)
        .not('slug', 'is', null)
        .in('brand_id', HUB_BRAND_IDS),
    ]);

  type HubPlateRow = {
    brand_id: number | null;
    image_cover: string | null;
    thickness_options: number[] | null;
    material_types: { id: number; slug: string } | null;
  };
  type HubAccessoryRow = {
    brand_id: number | null;
    image_cover: string | null;
    sales_mode: string | null;
    accessory_types: { id: number; slug: string } | null;
  };
  type BrandIdRow = { brand_id: number };

  const platesRows  = (platesResult.data ?? []) as unknown as HubPlateRow[];
  const accsRows    = (accessoriesResult.data ?? []) as unknown as HubAccessoryRow[];
  const brandPlates = (brandPlatesResult.data ?? []) as unknown as BrandIdRow[];
  const brandAccs   = (brandAccsResult.data ?? []) as unknown as BrandIdRow[];

  // ── Plates aggregate per material ──────────────────────────
  const platesByMaterial: Record<string, {
    urun: number; brands: Set<number>; thicknesses: Set<number>; firstImg: string | null;
  }> = {};

  for (const row of platesRows) {
    const matSlug: string | undefined = row.material_types?.slug;
    if (!matSlug) continue;
    const bucket = platesByMaterial[matSlug] ??= {
      urun: 0, brands: new Set(), thicknesses: new Set(), firstImg: null,
    };
    bucket.urun += 1;
    if (row.brand_id) bucket.brands.add(row.brand_id);
    const tks: unknown = row.thickness_options;
    if (Array.isArray(tks)) tks.forEach((t) => typeof t === 'number' && bucket.thicknesses.add(t));
    if (!bucket.firstImg && row.image_cover) bucket.firstImg = row.image_cover;
  }

  // ── Accessories aggregate per type ─────────────────────────
  const accsByType: Record<string, {
    urun: number; brands: Set<number>; tekil: number; sysOnly: number; firstImg: string | null;
  }> = {};

  for (const row of accsRows) {
    const typeSlug: string | undefined = row.accessory_types?.slug;
    if (!typeSlug) continue;
    const bucket = accsByType[typeSlug] ??= {
      urun: 0, brands: new Set(), tekil: 0, sysOnly: 0, firstImg: null,
    };
    bucket.urun += 1;
    if (row.brand_id) bucket.brands.add(row.brand_id);
    if (row.sales_mode === 'system_only') bucket.sysOnly += 1;
    else bucket.tekil += 1;
    if (!bucket.firstImg && row.image_cover) bucket.firstImg = row.image_cover;
  }

  // ── KATEGORI_LIST sırasında HubKategoriRow üret ────────────
  const kategoriler: HubKategoriRow[] = KATEGORI_LIST.map(({ slug, info }) => {
    if (info.material === 'aksesuar' && info.accessoryTypeSlug) {
      const a = accsByType[info.accessoryTypeSlug];
      if (!a) {
        return { ...info, slug, urun_sayisi: 0, marka_sayisi: 0, hero_image: null, badge: 'tekil' };
      }
      const badge: HubBadge =
        a.tekil === 0 && a.sysOnly > 0 ? 'sistem' :
        a.tekil > 0 && a.sysOnly === 0 ? 'tekil'  : 'mixed';
      return {
        ...info, slug,
        urun_sayisi: a.urun,
        marka_sayisi: a.brands.size,
        hero_image: a.firstImg,
        badge,
      };
    }
    // plates kategorisi (tasyunu-levha / eps-levha)
    const matKey = info.material;
    const p = platesByMaterial[matKey];
    if (!p) {
      return { ...info, slug, urun_sayisi: 0, marka_sayisi: 0, hero_image: null, badge: 'tekil' };
    }
    const tks = Array.from(p.thicknesses).sort((a, b) => a - b);
    const thickness_range = tks.length > 0 ? `${tks[0]}–${tks[tks.length - 1]} cm` : undefined;
    return {
      ...info, slug,
      urun_sayisi: p.urun,
      marka_sayisi: p.brands.size,
      hero_image: p.firstImg,
      badge: 'tekil',
      thickness_range,
    };
  });

  // ── Brand totals ───────────────────────────────────────────
  const brandTotals: Record<number, number> = {};
  for (const r of brandPlates) brandTotals[r.brand_id] = (brandTotals[r.brand_id] ?? 0) + 1;
  for (const r of brandAccs)   brandTotals[r.brand_id] = (brandTotals[r.brand_id] ?? 0) + 1;

  const markalar: HubBrand[] = HUB_BRAND_IDS
    .map((id) => ({
      slug: BRAND_SLUG_BY_ID[id].slug,
      name: BRAND_SLUG_BY_ID[id].name,
      total: brandTotals[id] ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  // ── Toplam istatistikler ───────────────────────────────────
  const totalUrun = kategoriler.reduce((sum, k) => sum + k.urun_sayisi, 0);
  const totals = {
    kategori: kategoriler.length,
    urun: totalUrun,
    marka: HUB_BRAND_IDS.length,
  };

  return { totals, kategoriler, markalar };
}

import type { MetadataRoute } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { KATEGORI_MAP } from '@/lib/catalog/categories';
import { formatThicknessSegment } from '@/lib/catalog/thickness-url';
import { HUB_THICKNESSES, density150HubPath, thicknessHubPath } from '@/lib/compare/hubs';
import { getDensity150HubThicknesses } from '@/lib/compare/hubPages.server';
import { isStorefrontHiddenBrandId } from '@/lib/catalog/storefrontBrands';

const BASE_URL = 'https://www.tasyunufiyatlari.com';

// Tam statik: build'de bir kez üret → CDN'den servis (ISR read unit = 0).
// İçerik tazeliği aylık cron redeploy ile sağlanır.
export const dynamic = 'force-static';

// Statik sayfalar — her zaman sitemap'te
const STATIC_PATHS = [
  { path: '/',                   priority: 1.0,  changeFrequency: 'weekly' as const },
  { path: '/urunler',            priority: 0.9,  changeFrequency: 'weekly' as const },
  { path: '/tasyunu-karsilastir', priority: 0.9,  changeFrequency: 'weekly' as const },
  { path: '/tasyunu-yogunluk/150-kg-m3', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/tasyunu-yogunluk/120-kg-m3', priority: 0.7, changeFrequency: 'weekly' as const },
  { path: '/hakkimizda',         priority: 0.7,  changeFrequency: 'monthly' as const },
  { path: '/iletisim',           priority: 0.7,  changeFrequency: 'monthly' as const },
  { path: '/kiralik-jenerator',  priority: 0.4,  changeFrequency: 'monthly' as const },
  { path: '/dis-mekan-saksi-malzemesi', priority: 0.4, changeFrequency: 'monthly' as const },
  { path: '/kvkk',               priority: 0.3,  changeFrequency: 'yearly' as const },
  { path: '/cerez-politikasi',   priority: 0.3,  changeFrequency: 'yearly' as const },
  { path: '/kullanim-kosullari', priority: 0.3,  changeFrequency: 'yearly' as const },
  { path: '/iade-ve-iptal',      priority: 0.3,  changeFrequency: 'yearly' as const },
];

// Marka detay sayfaları — BRAND_MAP ile aynı slug listesi
// Düzeltme: aynı slug taksonomisini lib/catalog/hub.ts'teki BRAND_SLUG_BY_ID ile paralel tut
// TEKNO 26 Ekim 2026'dan beri ön yüzde yok (lib/catalog/storefrontBrands).
const BRAND_SLUGS = ['dalmacyali', 'filli-boya', 'optimix', 'oem'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const supabase = createServerSupabaseClient();

  const entries: MetadataRoute.Sitemap = [];

  // 1) Statikler
  for (const s of STATIC_PATHS) {
    entries.push({
      url: `${BASE_URL}${s.path}`,
      lastModified: now,
      changeFrequency: s.changeFrequency,
      priority: s.priority,
    });
  }

  // 1b) Hub sayfaları: kalınlık ve 150/kalınlık (14 Ekim 2026)
  for (const t of HUB_THICKNESSES) {
    entries.push({ url: `${BASE_URL}${thicknessHubPath(t)}`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 });
  }
  try {
    for (const t of await getDensity150HubThicknesses()) {
      entries.push({ url: `${BASE_URL}${density150HubPath(t)}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 });
    }
  } catch {
    // Fiyat verisi okunamazsa 150/kalınlık hub'ları bu derlemede haritaya girmez (sayfaları da üretilmez).
  }

  // 2) Kategori sayfaları (/urunler/[kategori])
  for (const slug of Object.keys(KATEGORI_MAP)) {
    entries.push({
      url: `${BASE_URL}/urunler/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  // 3) Markalar (/marka/[brand])
  for (const slug of BRAND_SLUGS) {
    entries.push({
      url: `${BASE_URL}/marka/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  // 4) Plate ürün detay sayfaları (/urunler/[kategori]/[slug])
  try {
    const { data: plates } = await supabase
      .from('plates')
      .select('slug, thickness_options, material_types(slug)')
      .eq('is_active', true)
      .not('slug', 'is', null);

    for (const row of (plates ?? []) as unknown as Array<{ slug: string; thickness_options: number[] | null; material_types: { slug: string } | null }>) {
      const matSlug = row.material_types?.slug;
      if (!matSlug || !row.slug) continue;
      // tasyunu → tasyunu-levha, eps → eps-levha
      const kategoriSlug = matSlug === 'tasyunu' ? 'tasyunu-levha' : matSlug === 'eps' ? 'eps-levha' : null;
      if (!kategoriSlug) continue;
      entries.push({
        url: `${BASE_URL}/urunler/${kategoriSlug}/${row.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });

      for (const thickness of row.thickness_options ?? []) {
        entries.push({
          url: `${BASE_URL}/urunler/${kategoriSlug}/${row.slug}/${formatThicknessSegment(thickness)}`,
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.72,
        });
      }
    }
  } catch {
    /* DB erişilemezse statikler yine sitemap'te kalır */
  }

  // 5) Aksesuar ürün detay sayfaları (/urunler/[kategori]/[slug])
  try {
    const { data: accs } = await supabase
      .from('accessories')
      .select('slug, brand_id, accessory_types(slug)')
      .eq('is_active', true)
      .not('slug', 'is', null);

    for (const row of (accs ?? []) as unknown as Array<{ slug: string; brand_id: number | null; accessory_types: { slug: string } | null }>) {
      if (isStorefrontHiddenBrandId(row.brand_id)) continue;
      const accTypeSlug = row.accessory_types?.slug;
      if (!accTypeSlug || !row.slug) continue;
      // accessory_types.slug ile KATEGORI_MAP'taki accessoryTypeSlug eşleşeni bul
      const kategoriEntry = Object.entries(KATEGORI_MAP).find(
        ([, info]) => info.accessoryTypeSlug === accTypeSlug
      );
      if (!kategoriEntry) continue;
      entries.push({
        url: `${BASE_URL}/urunler/${kategoriEntry[0]}/${row.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  } catch {
    /* yoksay */
  }

  return entries;
}

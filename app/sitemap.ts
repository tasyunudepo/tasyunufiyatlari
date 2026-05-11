import type { MetadataRoute } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { KATEGORI_MAP } from '@/lib/catalog/categories';

const BASE_URL = 'https://www.tasyunufiyatlari.com';

// Statik sayfalar — her zaman sitemap'te
const STATIC_PATHS = [
  { path: '/',                   priority: 1.0,  changeFrequency: 'weekly' as const },
  { path: '/urunler',            priority: 0.9,  changeFrequency: 'weekly' as const },
  { path: '/hakkimizda',         priority: 0.7,  changeFrequency: 'monthly' as const },
  { path: '/iletisim',           priority: 0.7,  changeFrequency: 'monthly' as const },
  { path: '/depomuz',            priority: 0.6,  changeFrequency: 'monthly' as const },
  { path: '/kvkk',               priority: 0.3,  changeFrequency: 'yearly' as const },
  { path: '/cerez-politikasi',   priority: 0.3,  changeFrequency: 'yearly' as const },
  { path: '/kullanim-kosullari', priority: 0.3,  changeFrequency: 'yearly' as const },
];

// Marka detay sayfaları — BRAND_MAP ile aynı slug listesi
// Düzeltme: aynı slug taksonomisini lib/catalog/hub.ts'teki BRAND_SLUG_BY_ID ile paralel tut
const BRAND_SLUGS = ['dalmacyali', 'filli-boya', 'optimix', 'tekno', 'oem'];

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
      .select('slug, material_types(slug)')
      .eq('is_active', true)
      .not('slug', 'is', null);

    for (const row of (plates ?? []) as unknown as Array<{ slug: string; material_types: { slug: string } | null }>) {
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
    }
  } catch {
    /* DB erişilemezse statikler yine sitemap'te kalır */
  }

  // 5) Aksesuar ürün detay sayfaları (/urunler/[kategori]/[slug])
  try {
    const { data: accs } = await supabase
      .from('accessories')
      .select('slug, accessory_types(slug)')
      .eq('is_active', true)
      .not('slug', 'is', null);

    for (const row of (accs ?? []) as unknown as Array<{ slug: string; accessory_types: { slug: string } | null }>) {
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

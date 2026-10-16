// Ürün sayfasından kategori sayfasına metin içi bağlantı (GCR işi #05e174, 16 Ekim 2026).
// "taşyünü levha" aramasında kategori sayfası 6,7 → 13,5. sıraya geriledi; aynı sorguda SW035 10 cm sayfası 9,1. sırada
// (yamyamlık). Yol satırı ve altbilgi zaten "Taşyünü Levha" diye bağlıyor; eksik olan metin içi bağlantıydı.
// Tek sayfaya uygulanır ki önce/sonra gözlemde etki ayrı okunsun; genişletmeden önce sonucu bekle.
// Adres sitenin kategori yoludur (lib/catalog/categories.ts KATEGORI_MAP); ürünün category.slug'ı ('tasyunu') değil.
export const CATEGORY_LINK_PAGES: readonly { slug: string; thicknesses: readonly number[]; href: string }[] = [
  { slug: 'dalmacyali-sw035-tasyunu', thicknesses: [10], href: '/urunler/tasyunu-levha' },
]

/** Bu ürün ve kalınlıkta metin içi kategori bağlantısının adresi; yoksa null. */
export function categoryLinkFor(slug: string, thicknessCm: number | null | undefined): string | null {
  if (thicknessCm == null) return null
  return CATEGORY_LINK_PAGES.find((page) => page.slug === slug && page.thicknesses.includes(thicknessCm))?.href ?? null
}

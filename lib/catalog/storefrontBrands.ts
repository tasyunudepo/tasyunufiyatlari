// Sitenin ön yüzünde (katalog, ürün ve marka sayfaları, ürün merkezi, site
// haritası) gösterilmeyen markalar.
//
// Emrah, 26 Ekim 2026: "TEKNO'nun 21 ürün sayfası, /marka/tekno sayfası ve
// bayilik logosu çıkaralım." Kayıtlar veritabanında ve ofis teklif ekranında
// durur; eski adresler next.config redirects ile kategori sayfasına 301
// yönlenir. Hesaplayıcıdaki toz seti kuralı ayrıdır (lib/wizard/eligibility).

/** brands.id — 6 = TEKNO */
export const STOREFRONT_HIDDEN_BRAND_IDS: readonly number[] = [6]

export function isStorefrontHiddenBrandId(brandId: number | null | undefined): boolean {
  return brandId != null && STOREFRONT_HIDDEN_BRAND_IDS.includes(brandId)
}

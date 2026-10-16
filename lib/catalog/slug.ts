// ============================================================
// Slug Üretici — Türkçe normalize + çakışma koruması
// ============================================================

const TR_MAP: Record<string, string> = {
  ş: 's', Ş: 's',
  ç: 'c', Ç: 'c',
  ğ: 'g', Ğ: 'g',
  ü: 'u', Ü: 'u',
  ö: 'o', Ö: 'o',
  ı: 'i', İ: 'i',
};

export function normalizeTurkish(text: string): string {
  return text
    .split('')
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('');
}

/**
 * Bir metni URL-güvenli slug'a çevirir.
 * Türkçe karakterleri normalize eder.
 */
export function toSlug(text: string): string {
  return normalizeTurkish(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ürün için deterministik slug bileşeni üretir.
 *
 * Format: {brand}-{model}-{material}[-{thickness}cm]
 *
 * Örnekler:
 *   isover-tp3-tasyunu-5cm
 *   rockwool-fasrock-tasyonu-10cm
 *   knauf-eps-70-eps-5cm
 */
export function buildProductSlugBase(params: {
  brandName: string;
  modelName: string | null;
  materialSlug: string; // 'tasyunu' | 'eps' | accessory_type.slug
  dominantThickness?: number | null;
}): string {
  const parts: string[] = [
    toSlug(params.brandName),
    params.modelName ? toSlug(params.modelName) : null,
    toSlug(params.materialSlug),
  ].filter(Boolean) as string[];

  if (params.dominantThickness) {
    parts.push(`${params.dominantThickness}cm`);
  }

  return parts.join('-');
}

/**
 * Slug çakışma durumunda numeric suffix ekler.
 *
 * Kullanım:
 *   const base = buildProductSlugBase({...});
 *   const existing = await db query slugs starting with base;
 *   const final = resolveSlugConflict(base, existingSlugs);
 */
export function resolveSlugConflict(base: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(base)) return base;

  let counter = 2;
  while (existingSlugs.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

/**
 * Minimum sipariş labelı üret.
 * Örnek: (40, 'm2') → "minimum 40 m²"
 */
export function buildMinimumOrderLabel(
  type: string,
  value: number | null
): string | null {
  if (type === 'none' || value === null) return null;

  const unitMap: Record<string, string> = {
    m2: 'm²',
    package: 'paket',
    pallet: 'palet',
    quantity: 'adet',
  };

  const unit = unitMap[type] ?? type;
  return `minimum ${value} ${unit}`;
}

// ============================================================
// Adı değişen ürünler — eski adres yeni adrese kalıcı yönlenir
// ============================================================
//
// Yönlendirme next.config'te değil ürün sayfasında yapılır: eski slug
// veritabanında hâlâ duruyorsa sayfa normal açılır, kayıt yeni slug'a
// geçince eski adres yeni adrese gider. Kod ile veri hangi sırayla canlıya
// çıkarsa çıksın ürün sayfası 404 vermez.

export const RENAMED_PRODUCT_SLUGS: Readonly<Record<string, string>> = {
  // Optimix Karbonlu: adreste marka iki kez yazılıyordu (16 Ekim 2026).
  'optimix-optimix-karbonlu-eps': 'optimix-karbonlu-eps',
};

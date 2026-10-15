// Ürün kalınlık sayfasının başlığı (Emrah onayı, 14 Ekim 2026 — hub planı Faz 3).
//
// NEDEN: bütün taşyünü ürünlerinin kalınlık sayfası "10 cm Taş Yünü Fiyatları - Ekim 2026 | <ürün>" kalıbıyla
// aynı genel aramada birbiriyle yarışıyordu. Genel arama artık kalınlık hub'ının ("/tasyunu-fiyatlari/10-cm");
// ürün sayfası ürün adıyla başlar, çünkü ürün aramaları da öyle başlıyor ("dalmaçyalı taşyünü fiyatları").
// Föy beyanı 120 ya da 150 olan üründe yoğunluk da başlıkta ("taş yünü 10 cm 150 yoğunluk" aramaları).
//
// SW035 sayfaları sitenin tıklamalarının %38'ini getiriyor (14 Tem–12 Eki 2026). Hub'lar Google'a girene kadar
// eski başlıkta bekletilmişti (Faz 5); Emrah 15 Ekim 2026'da beklemeden değiştirilmesini istedi ("unuturum").
// Liste boş kaldı; ileride bir ürünü eski başlıkta tutmak gerekirse slug'ı buraya eklemek yeter.
// EPS ürünleri bu işin kapsamında değil.

import { getProfileByModel } from '@/lib/technical-profiles'

export const LEGACY_TITLE_SLUGS: ReadonlySet<string> = new Set<string>()

interface Input {
  kategori: string
  slug: string
  productName: string
  model: string | null
  thicknessCm: number
  searchLabel: string
  monthYear: string
}

export function productThicknessTitle(input: Input): string {
  const legacy = `${input.thicknessCm} cm ${input.searchLabel} Fiyatları - ${input.monthYear} | ${input.productName}`
  if (input.kategori !== 'tasyunu-levha' || LEGACY_TITLE_SLUGS.has(input.slug)) return legacy
  const profile = input.model ? getProfileByModel(input.model) : null
  const name = (profile?.displayName ?? input.productName).replace(/\s+Taşyünü.*$/u, '').trim()
  const density = profile?.density?.sourceType === 'datasheet' && [120, 150].includes(profile.density.minKgM3)
    ? `${profile.density.minKgM3} Yoğunluk `
    : ''
  return `${name} ${input.thicknessCm} cm ${density}Taş Yünü Fiyatı - ${input.monthYear}`
}

/** Veritabanındaki meta başlık bazen site adını içeriyor; kök şablon ("%s | Taşyünü Fiyatları") yeniden ekler. */
export function stripSiteSuffix(title: string | null | undefined): string | null {
  if (!title) return null
  return title.replace(/(\s*[|–—-]\s*Taşyünü Fiyatları)+\s*$/u, '').trim() || null
}

/**
 * Ürün sayfası başlık/açıklama düzeltmeleri (veritabanına dokunmadan).
 * 14 Ekim 2026 (Emrah): rabitz telli şilte "rulo taşyünü şilte" diye aranıyor (3 ayda 671 gösterim
 * "rulo taşyünü fiyatları"); fiyat fabrikadan teklif ile verilir, endüstriyel kullanım.
 */
export const PRODUCT_META_OVERRIDES: Readonly<Record<string, { title: string; description: string }>> = {
  'bonus-endustriyel-silte-tasyunu': {
    title: 'Rulo Taşyünü Şilte (Rabitz Telli) Fiyatı — Bonus Endüstriyel Şilte',
    description:
      'Rabitz telli rulo taşyünü şilte: Bonus Endüstriyel Şilte 650, 700, 720 ve 750 (80–125 kg/m³). Kazan, tesisat ve egzoz boruları, bacalar ve çelik konstrüksiyon yalıtımı için; fiyat fabrikadan teklif ile verilir.',
  },
}

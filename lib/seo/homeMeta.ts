// Ana sayfa başlığı ve Google açıklaması (17 Ekim 2026 — "taş yünü fiyatları" yuvarlak masası, Emrah onayı + Astra uzlaşısı).
// Ana sayfa "taş yünü fiyatları" ve "taş yünü" aramalarının hedef sayfasıdır. Açıklamadaki rakamlar görünen fiyat
// tablosuyla AYNI satırlardan ve aynı koşuldan gelir (1 kamyon, İstanbul Avrupa Yakası, KDV hariç).

import type { HomePriceRow } from '@/components/home/HomePriceTable';

const tl = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Mantolama levhası": rakamlar levhanın m² fiyatıdır, bütün uygulamanın maliyeti değil (Astra, 17 Ekim). */
export function homeTitle(monthYear: string): string {
  return `Taş Yünü Fiyatları ${monthYear} — Mantolama Levhası m² Fiyatı`;
}

/** En ince ve en kalın fiyatlı kalınlığın en düşük m² fiyatı; satır yoksa rakamsız cümle. */
export function homeDescription(rows: HomePriceRow[], monthYear: string, cityLabel: string): string {
  const priced = rows.filter((r): r is HomePriceRow & { min: NonNullable<HomePriceRow['min']> } => !!r.min);
  const first = priced[0];
  const last = priced[priced.length - 1];
  const range =
    first && last && first !== last
      ? `mantolama levhası m² fiyatı ${first.thicknessCm} cm’de ${tl(first.min.unit)} ₺, ${last.thicknessCm} cm’de ${tl(last.min.unit)} ₺’den başlar`
      : first
        ? `${first.thicknessCm} cm mantolama levhası m² fiyatı ${tl(first.min.unit)} ₺’den başlar`
        : 'kalınlığa göre mantolama levhası m² fiyatları';
  // Koşullar başta: Google açıklamayı kısaltırsa "KDV hariç" fiyatın arkasında kalmasın (editör, 17 Ekim).
  return `${monthYear} taş yünü fiyatları (KDV hariç, 1 kamyon, ${cityLabel}): ${range}. Kalınlığa göre liste ve teslim fiyatı hesabı.`;
}

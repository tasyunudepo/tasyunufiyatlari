// Teklif geçerliliği — tek kaynak.
//
// Site teklifleri (sihirbaz, ürün sayfası) düzenlendiği günden sonra
// SITE_QUOTE_VALIDITY_DAYS gün geçerlidir (Emrah kararı, 13 Ekim 2026).
// Ofisten yazılan teklif gün sayısını kendisi verir (varsayılan 7).
//
// Gün, müşterinin cihaz saatine değil Türkiye saatine göre sayılır;
// belgede "… günü sonuna kadar geçerlidir" diye okunur.

export const SITE_QUOTE_VALIDITY_DAYS = 3

const TZ = 'Europe/Istanbul'
const DAY_MS = 24 * 60 * 60 * 1000

/** Teklifin geçerli olduğu son gün (o günün içinde bir an). */
export function offerValidUntil(issuedAt: Date = new Date(), days: number = SITE_QUOTE_VALIDITY_DAYS): Date {
  return new Date(issuedAt.getTime() + days * DAY_MS)
}

/** "09.10.2026" */
export function formatValidUntil(date: Date): string {
  return date.toLocaleDateString('tr-TR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
}

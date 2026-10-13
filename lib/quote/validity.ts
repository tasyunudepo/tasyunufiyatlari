// Teklif geçerliliği — tek kaynak.
//
// Site teklifleri (sihirbaz, ürün sayfası) düzenlendiği günden sonra
// SITE_QUOTE_VALIDITY_DAYS gün geçerlidir (Emrah kararı, 13 Ekim 2026).
// Ofisten yazılan teklif gün sayısını kendisi verir (varsayılan 7).
//
// Gün, müşterinin cihaz saatine değil Türkiye saatine göre sayılır;
// belgede "… günü sonuna kadar geçerlidir" diye okunur.
//
// Dışarıya bir an (Date) değil SON GEÇERLİ GÜN verilir: düzenleme anına
// gün eklemek o günün ortasında bir an üretir ve bu an bitiş saati gibi
// karşılaştırılırsa belgedeki "gün sonu" ile çelişir. Bitiş anı gerekirse
// sınır son geçerli günün ertesi günü 00:00'dır (Europe/Istanbul).

export const SITE_QUOTE_VALIDITY_DAYS = 3

const TZ = 'Europe/Istanbul'
const DAY_MS = 24 * 60 * 60 * 1000

/** Teklifin geçerli olduğu son gün, belgede yazıldığı biçimde: "09.10.2026". */
export function lastValidDay(issuedAt: Date = new Date(), days: number = SITE_QUOTE_VALIDITY_DAYS): string {
  // Türkiye'de yaz saati uygulaması yok; 24 saatlik adım takvim gününü kaydırmaz.
  return formatDay(new Date(issuedAt.getTime() + days * DAY_MS))
}

/** "09.10.2026" — Türkiye saatine göre takvim günü. */
export function formatDay(date: Date): string {
  return date.toLocaleDateString('tr-TR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
}

// "Ekim 2026" — fiyat sayfalarının başlığındaki ay etiketi (İstanbul saatine göre, derleme anı).
export function formatMonthYear(date = new Date()): string {
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(date)
}

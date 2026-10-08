export type OfficeCalendar = { timeZone: 'Europe/Istanbul'; weekdays: number[]; opens: string; closes: string; firstContactMinutes: number; example?: boolean };
export const istanbulDate = (value: string | number | Date) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
export function calendarFromJson(raw: string | undefined): OfficeCalendar | null {
  try {
    const c = JSON.parse(raw ?? 'null');
    if (!c || c.timeZone !== 'Europe/Istanbul' || !Array.isArray(c.weekdays) || !c.weekdays.length
      || c.weekdays.some((d: unknown) => !Number.isInteger(d) || Number(d) < 0 || Number(d) > 6)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.opens) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.closes)
      || c.closes <= c.opens || !Number.isInteger(c.firstContactMinutes) || c.firstContactMinutes < 1 || c.firstContactMinutes > 1440) return null;
    return c;
  } catch { return null; }
}
/** İstanbul günündeki mesai dakikalarını tüketir; kapalı gün/saatler hedefi tüketmez. */
export function initialContactDue(arrival: string, c: OfficeCalendar): string {
  let cursor = new Date(arrival).getTime();
  if (!Number.isFinite(cursor)) throw Error('Talep zamanı geçersiz');
  let remaining = c.firstContactMinutes * 60000;
  for (let day = 0; day < 370; day++) {
    const date = istanbulDate(cursor);
    const weekday = new Date(date + 'T12:00:00+03:00').getUTCDay();
    const start = Date.parse(`${date}T${c.opens}:00+03:00`);
    const end = Date.parse(`${date}T${c.closes}:00+03:00`);
    if (c.weekdays.includes(weekday)) {
      const from = Math.max(cursor, start);
      if (from < end) {
        if (remaining <= end - from) return new Date(from + remaining).toISOString();
        remaining -= end - from;
      }
    }
    cursor = Date.parse(date + 'T00:00:00+03:00') + 86400000;
  }
  throw Error('Mesai takvimi hedefi karşılamıyor');
}

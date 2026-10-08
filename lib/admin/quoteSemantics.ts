/** Existing v22/v24 fields only. This module never creates a project or writes data. */
export const QUOTE_STATUS_LABELS = {
  pending: 'Bekliyor', contacted: 'İletişimde', quoted: 'Teklif Verildi',
  approved: 'Onaylandı', completed: 'Tamamlandı', rejected: 'Reddedildi',
} as const;
export type QuoteStatus = keyof typeof QUOTE_STATUS_LABELS;
export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === 'string' && Object.hasOwn(QUOTE_STATUS_LABELS, value);
}
export function quoteStatusLabel(value: unknown): string {
  return isQuoteStatus(value) ? QUOTE_STATUS_LABELS[value] : 'Durumu belirsiz';
}
export function quoteStatusDistribution(quotes: readonly { status?: string | null }[]) {
  const counts = { pending: 0, contacted: 0, quoted: 0, approved: 0, completed: 0, rejected: 0, unknown: 0 };
  for (const quote of quotes) counts[isQuoteStatus(quote.status) ? quote.status : 'unknown']++;
  return { total: quotes.length, counts };
}
export function pgBigintId(value: unknown): string | null {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value);
  if (!/^[1-9]\d{0,18}$/.test(text)) return null;
  return BigInt(text) <= BigInt('9223372036854775807') ? text : null;
}
export const CONTACT_KINDS = ['arama_giden', 'arama_gelen', 'whatsapp', 'eposta', 'ziyaret'] as const;
export const CONTACT_RESULTS = ['ulasildi', 'ulasilamadi', 'mesaj_birakildi'] as const;
export type QuoteInteraction = {
  id: string | number; quote_id: string | number | null;
  kind: string; outcome: string | null; occurred_at: string;
  body?: string | null; created_by?: string;
  next_action_at?: string | null; next_action_note?: string | null; next_action_done_at?: string | null;
};
export type InteractionHistory = {
  interactions: QuoteInteraction[];
  firstSuccess: QuoteInteraction | null;
  latestAttempt: QuoteInteraction | null;
  hasOlder: boolean;
};
type LegacyContact = { id: string | number; contact_attempted_at?: string | null; contact_successful?: boolean | null };
const validTime = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const isContactRecord = (row: QuoteInteraction) => (CONTACT_KINDS as readonly string[]).includes(row.kind) && row.outcome != null;
const isUncertain = (row: QuoteInteraction) => (row.created_by === 'backfill-v24' && row.outcome !== 'ulasildi')
  || !(CONTACT_RESULTS as readonly string[]).includes(row.outcome ?? '');
export function summarizeQuoteContact(quote: LegacyContact, history: InteractionHistory | undefined) {
  const rows = [...(history?.interactions ?? []), history?.firstSuccess, history?.latestAttempt]
    .filter((row): row is QuoteInteraction => !!row && String(row.quote_id) === String(quote.id) && isContactRecord(row));
  const ordered = rows.filter(row => validTime(row.occurred_at) !== null).sort((a, b) => {
    const time = Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
    if (time) return time;
    const aId = pgBigintId(a.id), bId = pgBigintId(b.id);
    return aId && bId ? (BigInt(aId) < BigInt(bId) ? -1 : BigInt(aId) > BigInt(bId) ? 1 : 0) : 0;
  });
  const success = ordered.find(row => row.outcome === 'ulasildi');
  const hasSuccess = quote.contact_successful === true || rows.some(row => row.outcome === 'ulasildi');
  const legacyTime = validTime(quote.contact_attempted_at);
  const last = ordered.at(-1);
  const latestFromLegacy = legacyTime !== null && (!last || legacyTime > Date.parse(last.occurred_at));
  const latest = latestFromLegacy ? {
    occurredAt: quote.contact_attempted_at!, source: 'legacy' as const, kind: null,
    outcome: quote.contact_successful === true ? 'ulasildi' : quote.contact_successful === false ? 'ulasilamadi' : null,
  } : last ? { occurredAt: last.occurred_at, source: last.created_by === 'backfill-v24' ? 'legacy-import' as const : 'history' as const, kind: last.kind, outcome: last.created_by === 'backfill-v24' && last.outcome !== 'ulasildi' ? null : last.outcome } : null;
  const state = hasSuccess ? 'successful' : !history ? 'unavailable' : rows.some(isUncertain) ? 'uncertain' : (rows.length || legacyTime !== null) ? 'attempted' : 'none';
  return {
    state,
    label: { successful: 'Başarılı temas kaydı var', attempted: 'Yalnız deneme kaydı var', none: 'Temas kaydı yok', unavailable: 'Temas geçmişi doğrulanamadı', uncertain: 'Eski temas sonucu belirsiz' }[state],
    latest,
    // Earliest recorded success is not claimed to be the first real conversation.
    firstRecordedSuccessAt: success?.occurred_at ?? null,
    legacySuccess: quote.contact_successful === true,
  };
}
export const INTERACTION_LABELS: Record<string, string> = {
  arama_giden: 'Telefon araması', arama_gelen: 'Gelen arama', whatsapp: 'WhatsApp',
  eposta: 'E-posta', ziyaret: 'Ziyaret', not: 'Not', teklif_gonderildi: 'Teklif gönderimi',
  kvkk_aydinlatma: 'Aydınlatma kaydı', hatirlatma: 'Hatırlatma',
};
export const INTERACTION_RESULT_LABELS: Record<string, string> = {
  ulasildi: 'Ulaşıldı', ulasilamadi: 'Ulaşılamadı', mesaj_birakildi: 'Mesaj bırakıldı',
  randevu: 'Randevu', ilgilenmiyor: 'İlgilenmiyor', fiyat_verildi: 'Fiyat verildi',
};

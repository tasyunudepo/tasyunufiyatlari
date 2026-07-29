import { useQuery, useQueryClient } from '@tanstack/react-query';

// Audit (26 Temmuz 2026): DashboardTab, QuotesTab ve ExperimentsTab üçü de
// aynı tam tabloyu bağımsız `useEffect + fetch` ile çekiyordu. Dört sekmelik
// bir gezintide /api/admin/quotes **7 kez** çağrılıyordu; her yanıt 34 kayıt
// için ~114 KB ve tam müşteri PII'si taşıyor. Proje `@tanstack/react-query`
// kullanıyor (lib/hooks/*) ama /ofis bu altyapıyı tamamen atlıyordu.
//
// Tek anahtar (`['admin','quotes']`) üç sekmenin de aynı önbelleği
// paylaşmasını sağlar.

export interface AdminQuotesPayload {
  quotes: Record<string, unknown>[];
  eventsByQuoteId: Record<string, Record<string, unknown>[]>;
  funnelSummary: Record<string, number>;
}

export const ADMIN_QUOTES_KEY = ['admin', 'quotes'] as const;

async function fetchAdminQuotes(): Promise<AdminQuotesPayload> {
  const res = await fetch('/api/admin/quotes', { cache: 'no-store' });
  const payload = await res.json().catch(() => null);

  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `Teklifler alınamadı (HTTP ${res.status}).`);
  }

  return {
    quotes: payload.quotes ?? [],
    eventsByQuoteId: payload.eventsByQuoteId ?? {},
    funnelSummary: payload.funnelSummary ?? {},
  };
}

/**
 * Ofis panelindeki teklif verisi — tek kaynak.
 *
 * @example
 * const { data, isLoading, refresh } = useAdminQuotes();
 */
export function useAdminQuotes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ADMIN_QUOTES_KEY,
    queryFn: fetchAdminQuotes,
    // Ofis verisi dakikalık tazelikte yeterli; sekme değiştirmek yeniden
    // çekmeyi tetiklemez.
    staleTime: 60_000,
    retry: 1,
  });

  return {
    quotes: query.data?.quotes ?? [],
    eventsByQuoteId: query.data?.eventsByQuoteId ?? {},
    funnelSummary: query.data?.funnelSummary ?? {},
    /**
     * Verinin çekildiği an (ms). Saatlik kovalar buna göre hesaplanır;
     * render sırasında `Date.now()` çağırmak React'in saflık kuralını
     * bozuyor ve her render'da kaymaya yol açıyordu.
     */
    dataUpdatedAt: query.dataUpdatedAt,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    /** Mutasyon sonrası tazeleme — tam yeniden çekim yerine geçersiz kılma. */
    refresh: () => queryClient.invalidateQueries({ queryKey: ADMIN_QUOTES_KEY }),
  };
}

"use client";
import { useQuery } from '@tanstack/react-query';
import { INTERACTION_LABELS, INTERACTION_RESULT_LABELS, summarizeQuoteContact, type InteractionHistory } from '@/lib/admin/quoteSemantics';

type Quote = { id: string | number; contact_attempted_at?: string | null; contact_successful?: boolean | null };
const date = (value: string) => new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
export function QuoteContactHistory({ quote }: { quote: Quote }) {
  const query = useQuery<InteractionHistory>({
    queryKey: ['admin', 'quote-interactions', String(quote.id)],
    queryFn: async () => {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(String(quote.id))}/interactions`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Görüşme geçmişi alınamadı.');
      return payload;
    }, staleTime: 30_000, retry: false,
  });
  const summary = summarizeQuoteContact(quote, query.isError ? undefined : query.data);
  return <section className="admin-nexus-subtle p-4" data-testid="quote-contact-history" aria-label="Görüşme geçmişi">
    <h4 className="mb-3 font-semibold">Görüşme geçmişi</h4>
    {query.isPending ? <p>Görüşme geçmişi yükleniyor…</p> : <>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-[var(--nx-text-muted)]">Temas durumu</dt><dd className="font-semibold" data-testid="contact-state">{summary.label}</dd></div>
        <div><dt className="text-sm text-[var(--nx-text-muted)]">Son girişim</dt><dd data-testid="contact-latest">{summary.latest
          ? `${INTERACTION_RESULT_LABELS[summary.latest.outcome ?? ''] ?? 'Sonuç belirtilmedi'} · ${date(summary.latest.occurredAt)}${summary.latest.source === 'legacy' ? ' · Eski teklif alanı' : summary.latest.source === 'legacy-import' ? ' · Eski aktarım' : ''}`
          : query.isError ? 'Son girişim doğrulanamadı' : 'Girişim kaydı yok'}</dd></div>
        <div><dt className="text-sm text-[var(--nx-text-muted)]">Kayıtlı en eski başarı</dt><dd>{summary.firstRecordedSuccessAt ? date(summary.firstRecordedSuccessAt) : summary.legacySuccess ? 'Eski alanda başarılı temas var; ilk tarih bilinmiyor' : query.isError ? 'Başarı geçmişi doğrulanamadı' : 'Başarı tarihi kayıtlı değil'}</dd></div>
      </dl>
      {query.isError && <div className="mt-3" role="status"><p>{query.error.message}</p><button type="button" className="ofis-secondary mt-2" onClick={() => void query.refetch()}>Tekrar dene</button></div>}
      {!query.isError && <>
        <p className="mt-3 text-sm text-[var(--nx-text-muted)]">Yalnız bu teklife bağlı görüşmeler. Müşteri veya telefon benzerliğiyle başka kayıt eklenmez.</p>
        {query.data?.hasOlder && <p className="mt-2 text-sm">Son 100 kayıt gösteriliyor. Başarı ve son girişim özeti tüm geçmişten alınır.</p>}
        <ol className="mt-4 space-y-3">
          {query.data?.interactions.map(row => <li key={String(row.id)} className="border-t border-[var(--nx-border)] pt-3">
            <div className="flex flex-wrap justify-between gap-2"><strong>{row.created_by === 'backfill-v24' ? 'Eski temas aktarımı' : INTERACTION_LABELS[row.kind] ?? row.kind}{row.outcome && ` · ${row.created_by === 'backfill-v24' && row.outcome !== 'ulasildi' ? 'Sonuç doğrulanamadı' : INTERACTION_RESULT_LABELS[row.outcome] ?? row.outcome}`}</strong><time dateTime={row.occurred_at} className="text-sm text-[var(--nx-text-muted)]">{date(row.occurred_at)}</time></div>
            {row.body && <p className="mt-1 whitespace-pre-wrap">{row.body}</p>}
            {row.created_by === 'backfill-v24' && <p className="text-sm text-[var(--nx-text-muted)]">Eski alandan aktarılmış kayıt; iletişim kanalı ayrıca doğrulanmamış.</p>}
            {row.next_action_at && <p className="mt-1 text-sm">Planlı geri dönüş: {date(row.next_action_at)}{row.next_action_done_at ? ' · Eski kayıtta tamamlanmış' : ''}{row.next_action_note ? ` · ${row.next_action_note}` : ''}</p>}
          </li>)}
        </ol>
        {query.data?.interactions.length === 0 && <p className="mt-3">Bu teklife bağlı görüşme kaydı yok.</p>}
      </>}
    </>}
  </section>;
}

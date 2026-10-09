'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOffice } from '@/lib/hooks/useOffice';
import { useAdminRole } from '@/lib/admin/useAdminRole';
import { formatGecikme } from '@/lib/admin/formatDuration';
import { INTERACTION_LABELS, INTERACTION_RESULT_LABELS } from '@/lib/admin/quoteSemantics';

// Hızlı erişim görünümleri. Her biri var olan bir kaynağı okur; yazma yok.

const tarih = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }) : '—';

interface Customer {
  id: number; display_name: string; company_name: string | null; phone_display: string | null;
  city_name: string | null; origin: string | null; owner: string | null; status: string | null; last_contact_at: string | null;
}

/** Müşteri kütüğü — /api/admin/customers (sayfalı, aramalı). */
export function CustomersView() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'customers', term],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (term) params.set('q', term);
      const res = await fetch('/api/admin/customers?' + params, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Müşteriler alınamadı (HTTP ${res.status}).`);
      return json as { customers: Customer[]; total?: number };
    },
  });
  return <div className="ofis-sheet-page" data-testid="office-customers">
    <header className="ofis-page-heading ofis-sheet-head"><div><h1>Müşteriler</h1><p className="ofis-day-line">{list.data ? <span><strong>{list.data.total ?? list.data.customers.length}</strong> kayıt</span> : null}</p></div></header>
    <form className="ofis-sheet-bar" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
      <div className="ofis-sheet-search"><span aria-hidden="true">⌕</span><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Müşterilerde ara" placeholder="Ad, firma ya da telefon" /></div>
      <button className="ofis-secondary" type="submit">Ara</button>
    </form>
    <section className="ofis-panel">
      {list.isPending ? <p>Müşteriler yükleniyor…</p> : list.error ? <p role="status">{(list.error as Error).message}</p> : list.data!.customers.length === 0 ? <p className="ofis-empty">Aramaya uyan müşteri yok.</p> : <div className="ofis-table-scroll"><table className="ofis-table">
        <thead><tr><th scope="col">Müşteri</th><th scope="col">Telefon</th><th scope="col">Şehir</th><th scope="col">Kaynak</th><th scope="col">Sorumlu</th><th scope="col">Son temas</th></tr></thead>
        <tbody>{list.data!.customers.map((c) => <tr key={c.id}>
          <th scope="row">{c.display_name}{c.company_name ? <span className="ofis-helper"> · {c.company_name}</span> : null}</th>
          <td className="num-left">{c.phone_display ?? '—'}</td><td>{c.city_name ?? '—'}</td><td>{c.origin ?? '—'}</td><td>{c.owner ?? '—'}</td><td className="num-left">{tarih(c.last_contact_at)}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </div>;
}

/** Tüm açık görevler — günlük kuyruk yalnız bugünü gösterir, burası hepsini. */
export function TasksView() {
  const query = useOffice();
  if (query.isPending) return <p>Görevler yükleniyor…</p>;
  if (query.error) return <p role="status">{query.error.message}</p>;
  const data = query.data!, now = Date.parse(data.asOf);
  const open = data.tasks.filter((t) => t.status === 'open').sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  return <div className="ofis-sheet-page" data-testid="office-tasks">
    <header className="ofis-page-heading ofis-sheet-head"><div><h1>Görevler</h1><p className="ofis-day-line"><span><strong>{open.length}</strong> açık görev</span><span><strong>{open.filter((t) => Date.parse(t.due_at) < now).length}</strong> gecikmiş</span></p></div></header>
    <section className="ofis-panel">
      {open.length === 0 ? <p className="ofis-empty">Açık görev yok.</p> : <div className="ofis-table-scroll"><table className="ofis-table">
        <thead><tr><th scope="col">Hedef</th><th scope="col">Proje</th><th scope="col">Konu</th><th scope="col">Sorumlu</th><th scope="col">Durum</th></tr></thead>
        <tbody>{open.map((t) => { const late = Date.parse(t.due_at) < now; return <tr key={t.id}>
          <td className="num-left">{tarih(t.due_at)}</td>
          <th scope="row">{data.projects.find((p) => p.id === t.project_id)?.name ?? 'Proje bulunamadı'}</th>
          <td>{t.kind === 'initial_contact' ? 'İlk temas' : 'Takip görüşmesi'}</td><td>{t.owner}</td>
          <td><span className="ofis-status" data-state={late ? 'late' : 'waiting'}>{late ? formatGecikme(Math.floor((now - Date.parse(t.due_at)) / 60000)) + ' gecikti' : 'Bekliyor'}</span></td>
        </tr>; })}</tbody>
      </table></div>}
    </section>
  </div>;
}

/** Proje notları — görüşme kayıtlarına yazılmış notlar, en yeni üstte. */
export function NotesView() {
  const query = useOffice();
  if (query.isPending) return <p>Notlar yükleniyor…</p>;
  if (query.error) return <p role="status">{query.error.message}</p>;
  const data = query.data!;
  const notes = data.interactions.filter((i) => (i.body ?? '').trim().length > 0).sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  return <div className="ofis-sheet-page" data-testid="office-notes">
    <header className="ofis-page-heading ofis-sheet-head"><div><h1>Proje Notları</h1><p className="ofis-day-line"><span><strong>{notes.length}</strong> not</span></p></div></header>
    <section className="ofis-panel">
      {notes.length === 0 ? <p className="ofis-empty">Görüşme kayıtlarında not yok.</p> : <ol className="ofis-history">{notes.slice(0, 100).map((n) => <li key={String(n.id)}>
        <strong>{data.projects.find((p) => p.id === n.project_id)?.name ?? 'Projesiz kayıt'}</strong>
        <time dateTime={n.occurred_at}>{tarih(n.occurred_at)} · {n.created_by || 'Kayıtlı değil'} · {INTERACTION_LABELS[n.kind] ?? n.kind}{n.outcome ? ', ' + (INTERACTION_RESULT_LABELS[n.outcome] ?? n.outcome) : ''}</time>
        <p>{n.body}</p>
      </li>)}</ol>}
    </section>
  </div>;
}

/** Ayarlar — panelin çalıştığı yapılandırma, salt okunur. */
export function SettingsView() {
  const query = useOffice(), role = useAdminRole();
  const cal = query.data?.calendar ?? null;
  return <div className="ofis-sheet-page" data-testid="office-settings">
    <header className="ofis-page-heading ofis-sheet-head"><div><h1>Ayarlar</h1><p className="ofis-day-line"><span>Bu ekran salt okunurdur; değerler sunucu yapılandırmasından gelir.</span></p></div></header>
    <section className="ofis-panel"><h2>Hesap</h2><dl className="ofis-kv"><div><dt>Kullanıcı</dt><dd>{role.user || '—'}</dd></div><div><dt>Yetki</dt><dd>{role.canMutate ? 'Yönetici (kayıt değiştirebilir)' : 'Salt okunur'}</dd></div></dl></section>
    <section className="ofis-panel"><h2>Mesai takvimi ve ilk temas hedefi</h2>
      {query.isPending ? <p>Yükleniyor…</p> : !cal ? <p role="status">Mesai takvimi yapılandırılmamış. Yeni ilk temas işi otomatik zamanlanamaz.</p> : <dl className="ofis-kv">
        <div><dt>Çalışma saatleri</dt><dd>{cal.opens}–{cal.closes}</dd></div>
        <div><dt>İlk temas hedefi</dt><dd>{cal.firstContactMinutes} mesai dakikası</dd></div>
        <div><dt>Saat dilimi</dt><dd>Europe/Istanbul</dd></div>
        {cal.example && <div><dt>Not</dt><dd>Örnek test takvimi; üretim ayarı değildir.</dd></div>}
      </dl>}
    </section>
    <section className="ofis-panel"><h2>Eski kayıt sınırı</h2><p>{query.data?.legacyCutoff ? `${tarih(query.data.legacyCutoff)} öncesindeki, temas ve planlı işi olmayan teklifler "İncelenecek eski kayıtlar" kuyruğunda durur.` : 'Yapılandırılmamış; yaşa göre otomatik kuyruk oluşturulmaz.'}</p></section>
  </div>;
}

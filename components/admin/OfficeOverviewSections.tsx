'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/admin/utils';
import { shippingText, type OfficeData } from '@/lib/admin/officeModel';
import { popularProducts, recentActivity, sourceSummary, teamPlan, tomorrowPlan, type PlanRow } from '@/lib/admin/officeOverview';

// Genel Bakış'ın alt bölümleri. Sayıların tamamı yüklenen kayıtlardan
// hesaplanır (lib/admin/officeOverview.ts); kayıt yoksa bölüm bunu söyler,
// örnek sayı göstermez.

type AdminQuote = Record<string, unknown> & { id: string | number; created_at: string };

const saat = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const gun = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' });
const kisaTarih = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const basHarf = (ad: string) => ad.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toLocaleUpperCase('tr-TR')).join('') || '?';
const KONU: Record<PlanRow['kind'], string> = { initial_contact: 'İlk temas', followup: 'Takip görüşmesi' };
const DURUM: Record<PlanRow['state'], string> = { late: 'Gecikti', waiting: 'Bekliyor', done: 'Tamamlandı', cancelled: 'İptal' };

function Kisi({ ad }: { ad: string }) {
  return <span className="ofis-person"><span className="ofis-avatar" aria-hidden="true">{basHarf(ad)}</span>{ad}</span>;
}

export function OfficeOverviewSections({ data, quotes, selectedQuoteId, onNavigate }: {
  data: OfficeData; quotes: AdminQuote[]; selectedQuoteId?: string; onNavigate?: (section: string) => void;
}) {
  const sources = sourceSummary(data.projects, quotes as never, data.asOf);
  const plan = teamPlan(data);
  const tomorrow = tomorrowPlan(data);
  const activity = recentActivity(data, quotes as never, 6);
  const products = popularProducts(quotes as never, data.asOf);
  const selected = data.quotes.find((q) => String(q.id) === String(selectedQuoteId));
  const selectedFull = quotes.find((q) => String(q.id) === String(selectedQuoteId));
  const maxProjects = Math.max(1, ...sources.rows.map((r) => r.projects));

  // Fiyat listesinde sürüm ya da güncelleme kaydı tutulmuyor; tabloda tarih
  // alanı varsa en yenisi gösterilir, yoksa uydurulmaz.
  const prices = useQuery({
    queryKey: ['ofis', 'fiyat-listesi-durumu'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('plate_prices').select('*');
      if (error) throw new Error(error.message);
      const list = (rows ?? []) as Record<string, unknown>[];
      const dates = list.map((r) => String(r.updated_at ?? r.created_at ?? '')).filter(Boolean).sort();
      return { count: list.length, latest: dates.at(-1) ?? null };
    },
  });

  return <div className="ofis-overview" data-testid="office-overview">
    <div className="ofis-overview-pair">
      <section className="ofis-panel" aria-labelledby="ofis-kaynak">
        <h2 id="ofis-kaynak">Talep kalitesi ve kaynaklar</h2>
        <p className="ofis-helper">Son {sources.days} günde açılan tekil projeler, ilk tekliflerinin geldiği kaynağa göre.</p>
        {sources.rows.length === 0 ? <p className="ofis-empty">Bu dönemde açılmış proje yok.</p> : <div className="ofis-table-scroll"><table className="ofis-table">
          <thead><tr><th scope="col">Kaynak</th><th scope="col" aria-hidden="true"></th><th scope="col" className="num">Tekil proje</th><th scope="col" className="num">Kazanılan</th><th scope="col" className="num">Kazanma oranı</th></tr></thead>
          <tbody>{sources.rows.map((r) => <tr key={r.source}>
            <th scope="row">{r.label}</th>
            <td><span className="ofis-bar"><span style={{ width: Math.round((r.projects / maxProjects) * 100) + '%' }} /></span></td>
            <td className="num">{r.projects}</td><td className="num">{r.won}</td><td className="num">{r.winRate == null ? '—' : '%' + r.winRate}</td>
          </tr>)}</tbody>
        </table></div>}
        <p className="ofis-helper">{gun(sources.from)} – {gun(data.asOf)} · toplam {sources.total} proje. Kazanma oranı = kazanılan / tekil proje.{sources.unlinkedQuotes > 0 && ` ${sources.unlinkedQuotes} teklif henüz projeye bağlı değil; tabloya girmez.`}</p>
      </section>

      <section className="ofis-panel" aria-labelledby="ofis-plan">
        <h2 id="ofis-plan">Bugünkü ekip planı</h2>
        <p className="ofis-helper">Günlük sayaçla aynı işler: gecikenler, bugün hedeflenenler ve bugün kapananlar.</p>
        {plan.length === 0 ? <p className="ofis-empty">Bugün için kayıtlı iş yok.</p> : <div className="ofis-table-scroll"><table className="ofis-table">
          <thead><tr><th scope="col">Hedef</th><th scope="col">Sorumlu</th><th scope="col">Proje · konu</th><th scope="col">Durum</th></tr></thead>
          <tbody>{plan.slice(0, 8).map((r) => <tr key={r.id}>
            <td className="num-left">{new Date(r.dueAt).toDateString() === new Date(data.asOf).toDateString() ? saat(r.dueAt) : kisaTarih(r.dueAt)}</td>
            <td><Kisi ad={r.owner} /></td><td>{r.projectName}<span className="ofis-helper ofis-block">{KONU[r.kind]}</span></td>
            <td><span className="ofis-status" data-state={r.state}>{DURUM[r.state]}</span></td>
          </tr>)}</tbody>
        </table></div>}
        {plan.length > 8 && <p className="ofis-helper">İlk 8 iş gösteriliyor; tamamı Görevler görünümünde.</p>}
      </section>
    </div>

    <section className="ofis-panel" aria-labelledby="ofis-fiyat">
      <h2 id="ofis-fiyat">Fiyat ve ürün kontrolü</h2>
      <p className="ofis-helper">Teklif edilen fiyatlar ve fiyat listesinin durumu.</p>
      <div className="ofis-overview-trio">
        <div className="ofis-subpanel">
          <h3>Fiyat listesi</h3>
          {prices.isPending ? <p className="ofis-helper">Yükleniyor…</p> : prices.error ? <p role="status">Fiyat listesi okunamadı.</p> : prices.data!.count === 0
            ? <p>Fiyat listesinde kayıt yok.</p>
            : <><p><strong>{prices.data!.count}</strong> fiyat satırı</p><p className="ofis-helper">{prices.data!.latest ? `Son kayıt: ${gun(prices.data!.latest)}` : 'Güncelleme tarihi sistemde tutulmuyor.'}</p></>}
          {onNavigate && <button className="ofis-secondary" onClick={() => onNavigate('pricing')}>Fiyat listesini görüntüle</button>}
        </div>
        <div className="ofis-subpanel">
          <h3>En çok teklif verilenler <span className="ofis-helper">son 30 gün · KDV hariç</span></h3>
          {products.length === 0 ? <p>Bu dönemde teklif yok.</p> : <ul className="ofis-product-list">{products.map((p) => <li key={p.key}>
            <span><strong>{p.label}</strong><span className="ofis-helper">{p.count} teklif</span></span>
            <span className="num">{p.unitPrice == null ? '—' : p.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺/m²'}</span>
          </li>)}</ul>}
          <p className="ofis-helper">Fiyat, o ürüne verilen tekliflerin birim fiyat ortancasıdır; liste fiyatı değildir.</p>
        </div>
        <div className="ofis-subpanel">
          <h3>Seçili teklifin fiyat bilgisi</h3>
          {!selected ? <p>Yukarıdan bir iş seçin.</p> : <dl className="ofis-kv">
            <div><dt>Teklif</dt><dd className="font-mono">{selected.quote_code ?? selected.id}</dd></div>
            <div><dt>Ürün</dt><dd>{selected.material_type === 'eps' ? 'EPS' : 'Taşyünü'} {selected.thickness_cm} cm</dd></div>
            <div><dt>Marka</dt><dd>{String(selectedFull?.brand_name ?? '—')}</dd></div>
            <div><dt>Birim fiyat</dt><dd>{Number(selected.price_per_m2 ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺/m² (KDV hariç)</dd></div>
            <div><dt>KDV hariç tutar</dt><dd>{formatCurrency(Number(selected.price_without_vat ?? 0))}</dd></div>
            <div><dt>Nakliye</dt><dd>{shippingText(selected)}</dd></div>
          </dl>}
          <p className="ofis-helper">Tutarlar teklif kaydından gelir; güncel fiyat listesiyle değiştirilmez.</p>
        </div>
      </div>
    </section>

    <div className="ofis-overview-pair">
      <section className="ofis-panel" aria-labelledby="ofis-akis">
        <h2 id="ofis-akis">Son işlemler</h2>
        <p className="ofis-helper">Görüşme kayıtları, yeni teklifler ve revizyonlar.</p>
        {activity.length === 0 ? <p className="ofis-empty">Henüz kayıtlı işlem yok.</p> : <div className="ofis-table-scroll"><table className="ofis-table">
          <tbody>{activity.map((a, i) => <tr key={i}><td className="num-left">{kisaTarih(a.at)}</td><td><Kisi ad={a.by} /></td><td>{a.text}</td></tr>)}</tbody>
        </table></div>}
      </section>

      <section className="ofis-panel" aria-labelledby="ofis-yarin">
        <h2 id="ofis-yarin">Yarınki planlananlar</h2>
        <p className="ofis-helper">Yarına tarihlenmiş açık görüşme ve takipler.</p>
        {tomorrow.length === 0 ? <p className="ofis-empty">Yarın için planlanmış iş yok.</p> : <div className="ofis-table-scroll"><table className="ofis-table">
          <thead><tr><th scope="col">Saat</th><th scope="col">Proje</th><th scope="col">Konu</th><th scope="col">Sorumlu</th></tr></thead>
          <tbody>{tomorrow.map((r) => <tr key={r.id}><td className="num-left">{saat(r.dueAt)}</td><td>{r.projectName}</td><td>{KONU[r.kind]}</td><td><Kisi ad={r.owner} /></td></tr>)}</tbody>
        </table></div>}
      </section>
    </div>
  </div>;
}

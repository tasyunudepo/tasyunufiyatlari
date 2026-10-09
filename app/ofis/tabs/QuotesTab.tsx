"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Trash2, ChevronDown, Layers, Download, PencilLine, Copy } from "lucide-react";
import { OfficeProjectPanel } from '@/components/admin/OfficeProjectPanel';
import { QuoteTechnicalSummary } from '@/components/admin/QuoteTechnicalSummary';
import { useOfficeMobile } from '@/lib/hooks/useOfficeMobile';
import { QuoteContactHistory } from "@/components/admin/QuoteContactHistory";
import { isQuoteStatus, quoteStatusDistribution, quoteStatusLabel, summarizeQuoteContact } from "@/lib/admin/quoteSemantics";
import { QuoteMoreActions } from "@/components/admin/QuoteMoreActions";
import { formatCurrency } from "@/lib/admin/utils";
import {
    groupQuotesIntoSeries,
    formatSeriesDuration,
    formatThicknesses,
    type QuoteRow,
    type QuoteSeries,
} from "@/lib/admin/groupQuotesIntoSeries";
import SalesOutcomePanel from "./SalesOutcomePanel";
import { useAdminRole } from "@/lib/admin/useAdminRole";
import { useAdminQuotes } from "@/lib/hooks/useAdminQuotes";
import { quoteToDuplicateSource } from "@/components/admin/quote-editor/QuoteDuplicateDialog";
import type { QuoteBuilderSeed } from "./quotes/QuoteBuilder";
import { useOffice } from '@/lib/hooks/useOffice';
import { projectContact } from '@/lib/admin/officeModel';
import { buildQuotesCsvBlob, csvFileName, type CsvQuote } from "@/lib/admin/quotesCsv";

const ofisPanel = "rounded-2xl border border-[var(--nx-border)] bg-[rgba(13,15,18,0.72)] shadow-[0_18px_44px_rgba(0,0,0,0.24)]";
const ofisInner = "rounded-xl border border-[rgba(92,98,108,0.18)] bg-[rgba(255,255,255,0.025)]";
const ofisControl = "rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.82)] text-[var(--nx-text-soft)] transition-colors focus:outline-none focus-visible:border-[var(--nx-border-accent)] focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.14)]";

type OfficeQuote = QuoteRow & {
    // DB: quotes.request_type text NOT NULL DEFAULT 'whatsapp_order'
    // QuoteRow defansif olarak string | null tutar; burada non-null'a daraltıyoruz.
    request_type: string;
    quote_code?: string | null;
    priority?: string | null;
    pdf_url?: string | null;
    pdf_storage_path?: string | null;
    price_per_m2?: number | null;
    total_price?: number | null;
    price_without_vat?: number | null;
    vat_amount?: number | null;
    vehicle_type?: string | null;
    package_count?: number | null;
    lorry_fill_percentage?: number | null;
    truck_fill_percentage?: number | null;
    customer_address?: string | null;
    // Satış sonucu alanları (migration v22 — Sprint 0.3/3)
    contact_attempted_at?: string | null;
    contact_successful?: boolean | null;
    follow_up_date?: string | null;
    admin_notes?: string | null;
    quoted_by?: string | null;
    sales_final_price?: number | null;
    gross_profit?: number | null;
    loss_category?: string | null;
    loss_reason?: string | null;
    closed_at?: string | null;
};

type QuoteEvent = {
    id: number | string;
    quote_id?: number | string | null;
    // DB: quote_funnel_events.event_type text NOT NULL — non-null tipi.
    event_type: string;
    brand_name?: string | null;
    package_name?: string | null;
    metadata?: Record<string, string | number | boolean | null | undefined>;
    created_at: string;
};

/** Teklif durum sözlüğü (v22 CHECK kısıtıyla aynı anahtarlar). */


/**
 * Mutasyon yanıtını tek yerden okur ve başarısızlığı GÖRÜNÜR hale getirir.
 * Audit B2 (26 Temmuz 2026): üç mutasyon da `if (res.ok && payload?.ok)` ile
 * sarılıydı, `else` dalı yoktu — 403/500/ağ hatası sessizce yutuluyordu ve
 * kullanıcı işlemin geçtiğini sanıyordu.
 */
async function readMutationResult(res: Response): Promise<{ ok: true } | { ok: false; message: string }> {
    const payload = await res.json().catch(() => null);
    if (res.ok && payload?.ok) return { ok: true };
    if (res.status === 403) {
        return { ok: false, message: "Bu hesabın veri değiştirme yetkisi yok — işlem uygulanmadı." };
    }
    if (res.status === 401) {
        return { ok: false, message: "Oturum doğrulanamadı. Sayfayı yenileyip tekrar giriş yapın." };
    }
    return {
        ok: false,
        message: payload?.error ?? `İşlem başarısız (HTTP ${res.status}). Değişiklik kaydedilmedi.`,
    };
}

export function QuotesTab({
    onOpenInBuilder,
}: {
    /** Teklifi yazma ekranında açar: revize (yerinde güncelle) ya da çoğalt. */
    onOpenInBuilder?: (seed: QuoteBuilderSeed) => void;
} = {}) {
    const { canMutate, isReadOnly } = useAdminRole();
    const isMobile = useOfficeMobile();
    const office = useOffice();
    function contactLabel(id: number | string) {
        if (!office.data) return office.error ? 'Temas geçmişi doğrulanamadı' : 'Temas geçmişi yükleniyor…';
        const quote = office.data.quotes.find(q => q.id === String(id));
        if (!quote) return 'Temas geçmişi bu görünümde yüklenmedi';
        if (quote.project_id) return 'Proje · ' + projectContact(office.data, quote.project_id).label;
        return summarizeQuoteContact(quote, {
            interactions: office.data.interactions.filter(i => String(i.quote_id) === quote.id),
            firstSuccess: null, latestAttempt: null, hasOlder: false,
        }).label;
    }
    const listRef = useRef<HTMLDivElement | null>(null);
    const savedScroll = useRef({page:0,list:0});
    const [viewName,setViewName] = useState("");
    const [savedViews,setSavedViews] = useState<{name:string;search:string;status:string;request:string;days:number}[]>([]);
    const [actionError, setActionError] = useState<string | null>(null);
    // Veri artık react-query üzerinden gelir ve DashboardTab/ExperimentsTab
    // ile aynı önbelleği paylaşır (audit: aynı tablo 7 kez çekiliyordu).
    const {
        quotes: rawQuotes,
        eventsByQuoteId: rawEvents,
        isLoading: loading,
        dataUpdatedAt: loadedAt,
        refresh,
    } = useAdminQuotes();
    const quotes = rawQuotes as unknown as OfficeQuote[];
    const quoteEventsById = rawEvents as unknown as Record<string, QuoteEvent[]>;
    const [selectedQuote, setSelectedQuote] = useState<OfficeQuote | null>(null);
    function selectQuote(quote:OfficeQuote | null) {
        if(quote) savedScroll.current={page:window.scrollY,list:listRef.current?.scrollTop??0};
        setSelectedQuote(quote);
        if(quote) requestAnimationFrame(()=>document.querySelector(`[data-testid="quote-row-${quote.id}"]`)?.scrollIntoView({block:'nearest'}));
        if(!quote) requestAnimationFrame(()=>{window.scrollTo(0,savedScroll.current.page);if(listRef.current)listRef.current.scrollTop=savedScroll.current.list});
    }

    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [requestTypeFilter, setRequestTypeFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    // Seri açıklık state — varsayılan kapalı, çok teklifli serilerde toggle.
    // Tek teklifli seriler her zaman açık görünür.
    const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});
    const modalRef = useRef<HTMLDivElement | null>(null);
    const PAGE_SIZE = 12;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [dateRangeDays, setDateRangeDays] = useState(0);

    // Filtre/arama değişince sayfalama başa döner — aksi hâlde kullanıcı
    // 3. sayfadayken filtre daraltınca boş liste görüyor.
    function resetPagination() {
        setVisibleCount(PAGE_SIZE);
    }

    /** Mutasyon sonrası önbelleği geçersiz kıl — tam yeniden çekim değil. */
    function loadQuotes() {
        void refresh();
    }

    /** Teklifi yazma ekranında açar; kalemi olmayan kayıt açılamaz. */
    function openInBuilder(quote: OfficeQuote, mode: QuoteBuilderSeed["mode"]) {
        const source = quoteToDuplicateSource(quote as unknown as Record<string, unknown>);
        if (!source) {
            setActionError("Bu teklifin kalem kaydı yok; yazma ekranında açılamıyor.");
            return;
        }
        selectQuote(null);
        onOpenInBuilder?.({ mode, source });
    }

    /** Kalemi olan teklif yazma ekranında açılabilir. */
    function hasLineItems(quote: OfficeQuote): boolean {
        const items = (quote as unknown as { package_items?: { items?: unknown[] } | null }).package_items?.items;
        return Array.isArray(items) && items.length > 0;
    }

    async function deleteQuote(quoteId: number | string) {
        // QuoteRow.id `number | string`; URL template literal her ikisini de string'e
        // çevirir. API tarafı (app/api/admin/quotes/[id]/route.ts) Number(id) ile coerce
        // eder, dolayısıyla burada cast gereksiz.
        setActionError(null);
        let res: Response;
        try {
            res = await fetch(`/api/admin/quotes/${quoteId}`, { method: "DELETE" });
        } catch {
            setActionError("Bağlantı hatası — teklif silinemedi.");
            return;
        }
        const result = await readMutationResult(res);
        if (!result.ok) {
            setActionError(result.message);
            return;
        }
        if (selectedQuote?.id === quoteId) selectQuote(null);
        loadQuotes();
    }

    // Audit E9: teklif detayı bir modal ama Esc ile kapanmıyordu ve odağı
    // tuzaklamıyordu — klavye kullanıcısı arkadaki listeye sekmeyle
    // kaçabiliyordu. Açıkken arka plan kaydırması da kilitlenir.
    useEffect(() => {
        if (!selectedQuote) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                selectQuote(null);
                return;
            }
            if (e.key !== "Tab" || !isMobile) return;

            const root = modalRef.current;
            if (!root) return;
            const odaklanabilir = root.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (odaklanabilir.length === 0) return;
            const ilk = odaklanabilir[0];
            const son = odaklanabilir[odaklanabilir.length - 1];

            if (e.shiftKey && document.activeElement === ilk) {
                e.preventDefault();
                son.focus();
            } else if (!e.shiftKey && document.activeElement === son) {
                e.preventDefault();
                ilk.focus();
            }
        };

        const oncekiOdak = document.activeElement as HTMLElement | null;
        const oncekiOverflow = document.body.style.overflow;
        if(isMobile) document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);
        modalRef.current?.focus();

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = oncekiOverflow;
            oncekiOdak?.focus?.();
        };
    }, [selectedQuote, isMobile]);

    async function updateQuoteStatus(quoteId: number | string, newStatus: string) {
        setActionError(null);
        let res: Response;
        try {
            res = await fetch(`/api/admin/quotes/${quoteId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
        } catch {
            setActionError("Bağlantı hatası — durum güncellenemedi.");
            return;
        }
        const result = await readMutationResult(res);
        if (!result.ok) {
            setActionError(result.message);
            return;
        }
        loadQuotes();
        if (selectedQuote?.id === quoteId) {
            setSelectedQuote({ ...selectedQuote, status: newStatus });
        }
    }

    async function updateQuotePriority(quoteId: number | string, newPriority: string) {
        setActionError(null);
        let res: Response;
        try {
            res = await fetch(`/api/admin/quotes/${quoteId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priority: newPriority }),
            });
        } catch {
            setActionError("Bağlantı hatası — öncelik güncellenemedi.");
            return;
        }
        const result = await readMutationResult(res);
        if (!result.ok) {
            setActionError(result.message);
            return;
        }
        loadQuotes();
        if (selectedQuote?.id === quoteId) {
            setSelectedQuote({ ...selectedQuote, priority: newPriority });
        }
    }

    const getRequestTypeBadge = (requestType: string) => {
        const style = requestType === "pdf_quote"
            ? "border-[rgba(201,168,76,0.26)] bg-[rgba(201,168,76,0.10)] text-[var(--nx-gold)]"
            : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
        const label = requestType === "manual_quote" ? "Ofis Teklifi" : requestType === "pdf_quote" ? "PDF Teklif" : requestType === "whatsapp_order" ? "Sipariş Onayı" : "Diğer";
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium border ${style}`}>
                {label}
            </span>
        );
    };

    const getEventLabel = (eventType: string) => {
        const labels: Record<string, string> = {
            calculator_results_shown: "Sonuçlar Gösterildi",
            quote_modal_opened: "Teklif Formu Açıldı",
            quote_submitted: "Teklif Kaydı Oluştu",
            pdf_quote_requested: "PDF Teklifi İstendi",
            whatsapp_order_requested: "WhatsApp Sipariş Onayı",
            whatsapp_opened: "WhatsApp Açıldı",
            pdf_downloaded: "PDF İndirildi",
        };
        return labels[eventType] || eventType;
    };

    const selectedQuoteEvents = selectedQuote ? (quoteEventsById[String(selectedQuote.id)] ?? []) : [];

    // Audit E3: tarih aralığı filtresi yoktu — "bu ay ne oldu?" sorusunun
    // cevabı panelde yoktu. Gün sayısı 0 = tümü.
    const rangeCutoff = dateRangeDays > 0 && loadedAt
        ? loadedAt - dateRangeDays * 24 * 60 * 60 * 1000
        : null;

    const filteredQuotes = useMemo(() => quotes.filter((quote) => {
        const matchesRange = rangeCutoff == null
            || new Date(quote.created_at).getTime() >= rangeCutoff;
        if (!matchesRange) return false;
        const matchesStatus = statusFilter === "all" || (statusFilter === "unknown" ? !isQuoteStatus(quote.status) : quote.status === statusFilter);
        const matchesRequestType = requestTypeFilter === "all" || quote.request_type === requestTypeFilter;
        const haystack = [quote.customer_name, quote.customer_email, quote.customer_phone, quote.brand_name, quote.package_name, quote.city_name, quote.quote_code]
            .filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
        const matchesSearch = searchTerm.trim().length === 0 || haystack.includes(searchTerm.trim().toLocaleLowerCase("tr-TR"));
        return matchesStatus && matchesRequestType && matchesSearch;
    }), [quotes, rangeCutoff, statusFilter, requestTypeFilter, searchTerm]);

    const totalQuoteValue = filteredQuotes.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0);
    const distribution = quoteStatusDistribution(filteredQuotes);

    // Filtrelenmiş quote'ları "teklif serileri" olarak grupla.
    // Filtre quote seviyesinde uygulanır → seri içinde sadece filtreyi
    // geçen teklifler kalır. Bu yüzden bir seri kısmen filtrelenmiş
    // görünebilir; sürpriz değil, beklenen davranış.
    // Generic any: orijinal quote shape'i loose tutuluyor; helper sadece
    // gerekli alanları okuyor, geri kalan alanlar olduğu gibi geçiyor.
    const filteredSeries = useMemo<QuoteSeries<OfficeQuote>[]>(
        () => groupQuotesIntoSeries<OfficeQuote>(filteredQuotes),
        [filteredQuotes]
    );
    const multiQuoteSeriesCount = filteredSeries.filter(s => s.quoteCount > 1).length;

    /** Ekrandaki filtrelenmiş listeyi CSV olarak indirir (audit E4). */
    function exportCsv() {
        const blob = buildQuotesCsvBlob(filteredQuotes as CsvQuote[]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // loadedAt react-query damgası; veri yüklenmeden düğme zaten kapalı.
        a.download = csvFileName(new Date(loadedAt));
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }


    // Audit E2: 34 teklifte sayfa 4.410px'ti; her kayıt DOM'daydı.
    // Filtreleme aynı veri anındaki teklif kümesini kullandığı için veri tek
    // seferde çekilmeye devam ediyor; sayfalanan yalnız RENDER edilen liste.
    const visibleSeries = filteredSeries.slice(0, visibleCount);
    const hasMore = filteredSeries.length > visibleCount;


    const urgencyLabel: Record<string, string> = { urgent: "Acil", high: "Yüksek", normal: "Normal", low: "Düşük" };

    // Gerçek ciro yalnız KAZANILMIŞ (completed) siparişlerden hesaplanır;
    // teklif toplamı ciro değildir (ölçüm sözleşmesi, Sprint 0.5).
    const wonQuotes = filteredQuotes.filter((q) => q.status === "completed");
    const wonRevenue = wonQuotes.reduce(
        (sum, q) => sum + (Number(q.sales_final_price) || 0),
        0,
    );
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className={`${ofisPanel} h-36 animate-pulse`} />
                    ))}
                </div>
                <div className={`${ofisPanel} p-8 text-center text-[var(--nx-text-muted)]`}>
                    Teklifler yükleniyor…
                </div>
            </div>
        );
    }

    return (
        <div className="ofis-sheet-page">
            {/* Mutasyon hata bandı — sessiz başarısızlık yasağı (audit B2). */}
            {actionError && (
                <div
                    role="alert"
                    data-testid="quote-action-error"
                    className="flex items-start justify-between gap-4 rounded-xl border border-red-400/35 bg-red-400/10 px-4 py-3 text-base text-red-200"
                >
                    <span>{actionError}</span>
                    <button
                        type="button"
                        onClick={() => setActionError(null)}
                        aria-label="Uyarıyı kapat"
                        className="shrink-0 rounded-lg px-2 text-red-300 transition-colors hover:bg-red-400/15 hover:text-red-100"
                    >
                        ×
                    </button>
                </div>
            )}
            {isReadOnly && (
                <div
                    data-testid="quotes-read-only-note"
                    className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-base text-sky-200"
                >
                    Salt okunur hesap — teklifleri görüntüleyebilir, değiştiremezsiniz.
                </div>
            )}
            <header className="ofis-page-heading ofis-sheet-head">
                <div>
                    <h1>Teklifler</h1>
                    <p className="ofis-day-line">
                        <span><strong>{filteredQuotes.length}</strong> teklif</span>
                        <span><strong>{formatCurrency(totalQuoteValue)}</strong> KDV dahil belge toplamı, alternatifler dahil</span>
                        {wonQuotes.length === 0
                            ? <span>Kayıtlı satış yok</span>
                            : <span><strong>{formatCurrency(wonRevenue)}</strong> KDV hariç kayıtlı satış · {wonQuotes.filter(q=>q.sales_final_price==null).length} tutarı eksik</span>}
                    </p>
                </div>
                <button className="ofis-secondary" onClick={loadQuotes}>Yenile</button>
            </header>

            {/* Filtre çubuğu tam genişlikte, listenin ÜSTÜNDE durur. Dar sol
                sütuna sıkışınca arama kutusu kesiliyor, ilk teklif ikinci
                ekrana düşüyordu (9 Ekim 2026). */}
            <section className="ofis-sheet-bar" aria-label="Teklif filtreleri">
                <div className="ofis-sheet-search">
                    <span aria-hidden="true">⌕</span>
                    <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); resetPagination(); }}
                        aria-label="Tekliflerde ara"
                        placeholder="Müşteri, marka, şehir ya da teklif kodu" />
                </div>
                <select value={requestTypeFilter} onChange={(e) => { setRequestTypeFilter(e.target.value); resetPagination(); }}
                    aria-label="Talep türüne göre filtrele">
                    <option value="all">Tüm talep türleri</option>
                    <option value="pdf_quote">PDF Teklif</option>
                    <option value="whatsapp_order">WhatsApp Onay</option>
                    <option value="manual_quote">Ofis Teklifi</option>
                </select>
                <select value={dateRangeDays} onChange={(e) => { setDateRangeDays(Number(e.target.value)); resetPagination(); }}
                    aria-label="Tarih aralığına göre filtrele">
                    <option value={0}>Tüm zamanlar</option>
                    <option value={7}>Son 7 gün</option>
                    <option value={30}>Son 30 gün</option>
                    <option value={90}>Son 90 gün</option>
                </select>
                {/* Audit E4: panelde hiç dışa aktarım yoktu. Filtrelenmiş
                    liste indirilir — ekranda ne görüyorsa o iner. */}
                <button
                    type="button"
                    onClick={exportCsv}
                    disabled={filteredQuotes.length === 0}
                    data-testid="quotes-export-csv"
                    title="Filtrelenmiş teklifleri CSV olarak indir"
                    className="ofis-secondary"
                >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    CSV ({filteredQuotes.length})
                </button>
            </section>
            <div className="ofis-filter-row ofis-status-row" aria-label="Duruma göre filtrele">
                {[
                    { value: "all", label: "Tümü" },
                    { value: "pending", label: "Bekliyor" },
                    { value: "contacted", label: "İletişimde" },
                    { value: "quoted", label: "Teklif Verildi" },
                    { value: "approved", label: "Onaylandı" },
                    { value: "rejected", label: "Reddedildi" },
                    { value: "completed", label: "Tamamlandı" },
                    { value: "unknown", label: "Durumu belirsiz" },
                ].map((f) => (
                    <button key={f.value} type="button" className="ofis-filter" aria-pressed={statusFilter === f.value}
                        onClick={() => { setStatusFilter(f.value); resetPagination(); }}>
                        {f.label}
                    </button>
                ))}
            </div>
            <div className="ofis-saved-views">
                    <label><span className="ofis-helper">Görünüm adı</span><input aria-label="Görünüm adı" value={viewName} onChange={e=>setViewName(e.target.value)} maxLength={60}/></label>
                    <button className="ofis-secondary" disabled={!viewName.trim()} onClick={()=>{const view={name:viewName.trim(),search:searchTerm,status:statusFilter,request:requestTypeFilter,days:dateRangeDays};try{const old=JSON.parse(localStorage.getItem('ofis-quote-views')??'[]');const next=[...(Array.isArray(old)?old:[]).filter(v=>v.name!==view.name),view].slice(-10);localStorage.setItem('ofis-quote-views',JSON.stringify(next));setSavedViews(next);setViewName('')}catch{setActionError('Görünüm bu tarayıcıya kaydedilemedi.')}}}>Görünümü kaydet</button>
                    <button className="ofis-secondary" onClick={()=>{try{const rows=JSON.parse(localStorage.getItem('ofis-quote-views')??'[]');setSavedViews(Array.isArray(rows)?rows.filter(v=>typeof v.name==='string'&&typeof v.search==='string'&&['all','unknown','pending','contacted','quoted','approved','completed','rejected'].includes(v.status)&&['all','pdf_quote','whatsapp_order','manual_quote'].includes(v.request)&&[0,7,30,90].includes(v.days)):[])}catch{setActionError('Kayıtlı görünümler okunamadı.')}}}>Kayıtlı görünümler</button>
                    {savedViews.map(v=><button key={v.name} className="ofis-filter" onClick={()=>{setSearchTerm(v.search);setStatusFilter(v.status);setRequestTypeFilter(v.request);setDateRangeDays(v.days);resetPagination()}}>{v.name}</button>)}
                </div>
            <div className="ofis-filter-row" aria-label="Etkin filtreler">
                    {searchTerm&&<button className="ofis-filter" onClick={()=>setSearchTerm('')}>Arama: {searchTerm} ×</button>}
                    {statusFilter!=='all'&&<button className="ofis-filter" onClick={()=>setStatusFilter('all')}>{quoteStatusLabel(statusFilter)} ×</button>}
                    {requestTypeFilter!=='all'&&<button className="ofis-filter" onClick={()=>setRequestTypeFilter('all')}>Talep türü ×</button>}
                    {dateRangeDays>0&&<button className="ofis-filter" onClick={()=>setDateRangeDays(0)}>Son {dateRangeDays} gün ×</button>}
                </div>

            <div className="ofis-sheet-workspace" data-has-selection={Boolean(selectedQuote)}>
            {/* Teklif Masası */}
            <div ref={listRef} className="ofis-panel ofis-sheet-list">
                <div className="ofis-sheet-list-head">
                    <h2>Teklif Masası</h2>
                    <p className="ofis-helper">
                        {filteredSeries.length} seri · {filteredQuotes.length} / {quotes.length} teklif
                        {multiQuoteSeriesCount > 0 && ` · ${multiQuoteSeriesCount} çoklu seri`}
                    </p>
                </div>
                <div className="ofis-sheet-columns" aria-hidden="true"><span>Tarih · teklif no</span><span>Müşteri</span><span>Ürün · marka</span><span>Miktar</span><span>Birim fiyat (KDV hariç)</span><span>Tutar (KDV dahil)</span><span>Durum · temas</span></div>
                <div>
                    {filteredSeries.length === 0 ? (
                        <div className="ofis-empty px-5">Seçili filtrelerde teklif talebi bulunmuyor.</div>
                    ) : visibleSeries.map((series) => {
                        const isMulti = series.quoteCount > 1;
                        // Tek teklifli seriler default açık; çok teklifliler default kapalı.
                        const isOpen = isMulti ? (expandedSeries[series.seriesKey] ?? false) : true;
                        return (
                            <div key={series.seriesKey} className="ofis-series" data-multi={isMulti}>
                                {/* ── Seri başlık satırı ── */}
                                {isMulti && (
                                    <button
                                        type="button"
                                        onClick={() => setExpandedSeries(prev => ({ ...prev, [series.seriesKey]: !isOpen }))}
                                        aria-expanded={isOpen}
                                        aria-controls={`series-body-${series.seriesKey}`}
                                        className="ofis-series-head"
                                    >
                                        <Layers className="h-4 w-4" aria-hidden="true" />
                                        <span className="ofis-quote-who">
                                            <strong>{series.customerCompany || series.customerName || "Müşteri yok"}</strong>
                                            <span className="ofis-helper">
                                                Teklif serisi · {series.quoteCount} teklif
                                                {series.durationMinutes > 0 ? ` · ${formatSeriesDuration(series.durationMinutes)}` : ""}
                                                {series.cityName ? ` · ${series.cityName}` : ""}
                                                {series.thicknesses.length > 0 ? ` · ${formatThicknesses(series.thicknesses)}` : ""}
                                            </span>
                                        </span>
                                        <span className="ofis-quote-sum">
                                            <strong>
                                                {series.minPrice != null && series.maxPrice != null
                                                    ? series.minPrice === series.maxPrice
                                                        ? `${Math.round(series.maxPrice).toLocaleString("tr-TR")} ₺`
                                                        : `${Math.round(series.minPrice).toLocaleString("tr-TR")} – ${Math.round(series.maxPrice).toLocaleString("tr-TR")} ₺`
                                                    : "—"}
                                            </strong>
                                            <small>
                                                {series.minPrice != null && series.maxPrice != null && series.minPrice !== series.maxPrice
                                                    ? "Teklif aralığı"
                                                    : "Teklif tutarı"}
                                            </small>
                                        </span>
                                        <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                                    </button>
                                )}

                                {/* ── Seri içindeki teklif satırları ── */}
                                {isOpen && (
                                    <div id={`series-body-${series.seriesKey}`}>
                                        {series.quotes.map((quote) => {
                                            const priorityKey = quote.priority ?? "normal";
                                            return (
                                            <div key={quote.id} data-testid={`quote-row-${quote.id}`} className="ofis-quote-row" data-selected={selectedQuote?.id === quote.id}>
                                                {/* Satırın tamamı tek ana eylemdir: teklifi sağdaki föyde açar. */}
                                                <button type="button" onClick={() => selectQuote(quote)} className="ofis-quote-main" aria-label={`${quote.customer_name}: Detay`}>
                                                    <span className="ofis-helper ofis-q-date">{new Date(quote.created_at).toLocaleDateString("tr-TR")}</span>
                                                    <span className="ofis-helper ofis-q-code">
                                                        {quote.quote_code ? <span className="font-mono">{quote.quote_code}</span> : null}
                                                        {quote.quote_code ? " · " : ""}
                                                        {quote.request_type === "manual_quote" ? "Ofis" : quote.request_type === "pdf_quote" ? "PDF" : quote.request_type === "whatsapp_order" ? "WhatsApp" : "Diğer"}
                                                        {priorityKey !== "normal" ? ` · ${urgencyLabel[priorityKey] ?? priorityKey}` : ""}
                                                    </span>
                                                    <span className="ofis-q-name">
                                                        <strong>{quote.customer_name}</strong>
                                                        <span className="ofis-helper">{quote.city_name || "—"}</span>
                                                    </span>
                                                    <span className="ofis-q-product">
                                                        {quote.material_type === "tasyunu" ? "Taşyünü" : "EPS"} {quote.thickness_cm} cm · {quote.brand_name || "Marka yok"}
                                                    </span>
                                                    <span className="ofis-q-qty">{Number(quote.area_m2 ?? 0).toLocaleString("tr-TR")} m²</span>
                                                    <span className="ofis-q-unit">{(quote.price_per_m2 ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                                                    <strong className="ofis-q-amount">{(quote.total_price ?? 0).toLocaleString("tr-TR")} ₺</strong>
                                                    <span className="ofis-q-state">
                                                        <span className="ofis-status" data-status={quote.status ?? "unknown"}>{quoteStatusLabel(quote.status)}</span>
                                                        <span className="ofis-helper" data-testid={`quote-contact-${quote.id}`}>{contactLabel(quote.id)}</span>
                                                        {quote.status === "completed" && quote.gross_profit != null ? <span className="ofis-helper">kâr {Number(quote.gross_profit).toLocaleString("tr-TR")} ₺</span> : null}
                                                    </span>
                                                </button>
                                                <QuoteMoreActions compact name={quote.customer_name ?? "Teklif"}>
                                                        {/* Salt-okunur hesapta değiştirme kontrolü hiç render edilmez;
                                                            bilgi rozet olarak kalır (audit B1). */}
                                                        {canMutate ? (
                                                            <select value={isQuoteStatus(quote.status) ? quote.status : ""} onChange={(e) => updateQuoteStatus(quote.id, e.target.value)}
                                                                aria-label={`${quote.customer_name} teklif durumu`}
                                                                className={`${ofisControl} px-3 py-2 text-sm min-w-[130px]`}>
                                                                {!isQuoteStatus(quote.status) && <option value="" disabled>Durumu belirsiz</option>}
                                                                <option value="pending">Bekliyor</option>
                                                                <option value="contacted">İletişimde</option>
                                                                <option value="quoted">Teklif Verildi</option>
                                                                <option value="approved">Onaylandı</option>
                                                                <option value="rejected">Reddedildi</option>
                                                                <option value="completed">Tamamlandı</option>
                                                            </select>
                                                        ) : (
                                                            <span className={`${ofisInner} px-3 py-2 text-sm min-w-[130px] text-center text-slate-300`}>
                                                                {quoteStatusLabel(quote.status)}
                                                            </span>
                                                        )}
                                                        {canMutate ? (
                                                            <select value={quote.priority ?? "normal"} onChange={(e) => updateQuotePriority(quote.id, e.target.value)}
                                                                aria-label={`${quote.customer_name} teklif önceliği`}
                                                                className={`${ofisControl} px-3 py-2 text-sm min-w-[100px]`}>
                                                                <option value="low">Düşük</option>
                                                                <option value="normal">Normal</option>
                                                                <option value="high">Yüksek</option>
                                                                <option value="urgent">Acil</option>
                                                            </select>
                                                        ) : null}
                                                        {(quote.pdf_storage_path || quote.pdf_url) && (
                                                            <a
                                                                href={`/api/admin/quotes/${quote.id}/pdf`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`${ofisControl} px-3 py-2 text-sm text-sky-300 hover:bg-sky-400/10 whitespace-nowrap`}
                                                                title="PDF Görüntüle"
                                                            >
                                                                PDF görüntüle
                                                            </a>
                                                        )}
                                                        {canMutate && onOpenInBuilder && hasLineItems(quote) && (
                                                            <>
                                                                {quote.request_type === "manual_quote" && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openInBuilder(quote, "revize")}
                                                                        data-testid={`quote-revise-${quote.id}`}
                                                                        title="Teklifi aynı numarayla düzenle"
                                                                        className={`${ofisControl} inline-flex items-center gap-1.5 px-3 py-2 text-sm text-sky-200 hover:bg-sky-400/10 whitespace-nowrap`}
                                                                    >
                                                                        <PencilLine className="h-3.5 w-3.5" />
                                                                        Revize et
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openInBuilder(quote, "cogalt")}
                                                                    data-testid={`quote-duplicate-${quote.id}`}
                                                                    title="Müşteri ve kalemlerle yeni teklif aç"
                                                                    className={`${ofisControl} inline-flex items-center gap-1.5 px-3 py-2 text-sm hover:bg-[rgba(255,255,255,0.06)] whitespace-nowrap`}
                                                                >
                                                                    <Copy className="h-3.5 w-3.5" />
                                                                    Çoğalt
                                                                </button>
                                                            </>
                                                        )}

                                                        {canMutate && (
                                                            <button onClick={() => { if (confirm(`"${quote.customer_name}" teklifini silmek istiyor musunuz?\nBu işlem geri alınamaz.`)) { deleteQuote(quote.id); } }}
                                                                className="rounded-xl border border-red-500/20 bg-red-500/[0.08] p-2 text-red-400/70 transition-colors hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/25" title="Teklifi sil" aria-label="Teklifi sil">
                                                                <Trash2 className="w-3.5 h-3.5" /> Sil
                                                            </button>
                                                        )}
                                                </QuoteMoreActions>
                                            </div>
                                        )})}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {hasMore && (
                        <button
                            type="button"
                            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                            data-testid="quotes-load-more"
                            className="ofis-secondary ofis-load-more"
                        >
                            Daha fazla göster · {filteredSeries.length - visibleCount} seri daha
                        </button>
                    )}
                </div>
            </div>

            {/* Quote Detail Modal */}
            {selectedQuote && (
                <div
                    className="ofis-sheet-detail"
                    onClick={(e) => { if (e.target === e.currentTarget) selectQuote(null); }}
                >
                    <div
                        ref={modalRef}
                        role={isMobile ? "dialog" : "region"}
                        aria-modal={isMobile || undefined}
                        aria-label={`Teklif detayı ${selectedQuote.id}`}
                        tabIndex={-1}
                        className="ofis-sheet-content"
                    >
                        <div className="ofis-sheet-top sticky top-0">
                            <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                    <h3>{selectedQuote.customer_name}</h3>
                                    <p className="ofis-muted">
                                        <span className="font-mono">{selectedQuote.quote_code ?? `#${selectedQuote.id}`}</span>
                                        {" · "}{new Date(selectedQuote.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                                        {" · "}{quoteStatusLabel(selectedQuote.status)}
                                    </p>
                                    {canMutate && onOpenInBuilder && hasLineItems(selectedQuote) && (
                                        <div className="ofis-actions mt-3">
                                            {selectedQuote.request_type === "manual_quote" && (
                                                <button
                                                    type="button"
                                                    onClick={() => openInBuilder(selectedQuote, "revize")}
                                                    data-testid="quote-detail-revise"
                                                    className="ofis-secondary"
                                                >
                                                    <PencilLine className="h-3.5 w-3.5" />
                                                    Teklifi revize et
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => openInBuilder(selectedQuote, "cogalt")}
                                                data-testid="quote-detail-duplicate"
                                                className="ofis-secondary"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                                Çoğalt
                                            </button>
                                        </div>
                                    )}
                                    {(selectedQuote.pdf_storage_path || selectedQuote.pdf_url) && (
                                        <div className="ofis-actions mt-3">
                                            <a
                                                href={`/api/admin/quotes/${selectedQuote.id}/pdf`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ofis-secondary"
                                            >
                                                PDF Görüntüle
                                            </a>
                                            <a
                                                href={`/api/admin/quotes/${selectedQuote.id}/pdf?download=1`}
                                                download
                                                className="ofis-secondary"
                                            >
                                                ↓ İndir
                                            </a>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => selectQuote(null)} className="ofis-secondary ofis-icon-button" aria-label="Listeye dön">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="ofis-sheet-body">
                            <QuoteTechnicalSummary quote={selectedQuote as unknown as Record<string,unknown>} />
                            <OfficeProjectPanel quoteId={String(selectedQuote.id)} />
                            <details className="space-y-4"><summary>Belgedeki müşteri, ürün ve lojistik ayrıntıları</summary>
                            <div className="admin-nexus-subtle p-4">
                                <h4 className="font-semibold text-[var(--nx-text)] mb-3">Müşteri Bilgileri</h4>
                                <div className="grid grid-cols-2 gap-3 text-base">
                                    <div><span className="text-slate-400">Ad Soyad:</span><div className="font-medium text-white">{selectedQuote.customer_name}</div></div>
                                    <div><span className="text-slate-400">E-posta:</span><div className="font-medium text-white">{selectedQuote.customer_email}</div></div>
                                    <div><span className="text-slate-400">Telefon:</span><div className="font-medium text-white">{selectedQuote.customer_phone}</div></div>
                                    {selectedQuote.customer_company && <div><span className="text-slate-400">Firma:</span><div className="font-medium text-white">{selectedQuote.customer_company}</div></div>}
                                    {selectedQuote.customer_address && <div className="col-span-2"><span className="text-slate-400">Adres:</span><div className="font-medium text-white">{selectedQuote.customer_address}</div></div>}
                                </div>
                            </div>
                            <div className="admin-nexus-subtle p-4">
                                <h4 className="font-semibold text-[var(--nx-gold)] mb-3">Sipariş Detayları</h4>
                                <div className="grid grid-cols-2 gap-3 text-base">
                                    <div><span className="text-slate-400">Paket:</span><div className="font-medium text-white">{selectedQuote.package_name}</div></div>
                                    <div><span className="text-slate-400">Marka:</span><div className="font-medium text-white">{selectedQuote.brand_name}</div></div>
                                    <div><span className="text-slate-400">Talep Türü:</span><div className="mt-1">{getRequestTypeBadge(selectedQuote.request_type)}</div></div>
                                    <div><span className="text-slate-400">Malzeme:</span><div className="font-medium text-white">{selectedQuote.material_type === "tasyunu" ? "Taşyünü" : "EPS"} {selectedQuote.thickness_cm}cm</div></div>
                                    <div><span className="text-slate-400">Metraj:</span><div className="font-medium text-white">{selectedQuote.area_m2} m²</div></div>
                                    <div><span className="text-slate-400">Şehir:</span><div className="font-medium text-white">{selectedQuote.city_name}</div></div>
                                    <div><span className="text-slate-400">Paket Sayısı:</span><div className="font-medium text-white">{selectedQuote.package_count} paket</div></div>
                                </div>
                            </div>
                            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4">
                                <h4 className="font-semibold text-green-300 mb-3">Fiyat Bilgileri</h4>
                                <div className="grid grid-cols-2 gap-3 text-base">
                                    <div><span className="text-slate-400">KDV Hariç:</span><div className="font-medium text-white">{(selectedQuote.price_without_vat ?? 0).toLocaleString("tr-TR")} ₺</div></div>
                                    <div><span className="text-slate-400">KDV:</span><div className="font-medium text-white">{(selectedQuote.vat_amount ?? 0).toLocaleString("tr-TR")} ₺</div></div>
                                    <div><span className="text-slate-400">Toplam:</span><div className="font-bold text-green-400 text-lg">{(selectedQuote.total_price ?? 0).toLocaleString("tr-TR")} ₺</div></div>
                                    <div><span className="text-slate-400">m² Fiyatı:</span><div className="font-medium text-white">{(selectedQuote.price_per_m2 ?? 0).toFixed(2)} ₺/m²</div></div>
                                </div>
                            </div>
                            {selectedQuote.vehicle_type && (
                                <div className="rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(255,255,255,0.03)] p-4">
                                    <h4 className="font-semibold text-[var(--nx-text)] mb-3">Lojistik Bilgileri</h4>
                                    <div className="grid grid-cols-2 gap-3 text-base">
                                        <div><span className="text-slate-400">Araç Tipi:</span><div className="font-medium text-white">{selectedQuote.vehicle_type === "lorry" && "Kamyon"}{selectedQuote.vehicle_type === "truck" && "Tır"}{selectedQuote.vehicle_type === "multiple" && "Birden Fazla Araç"}</div></div>
                                        <div><span className="text-slate-400">Paket Sayısı:</span><div className="font-medium text-white">{selectedQuote.package_count} paket</div></div>
                                        {selectedQuote.lorry_fill_percentage && <div><span className="text-slate-400">Kamyon Doluluk:</span><div className="font-medium text-white">{selectedQuote.lorry_fill_percentage.toFixed(0)}%</div></div>}
                                        {selectedQuote.truck_fill_percentage && <div><span className="text-slate-400">Tır Doluluk:</span><div className="font-medium text-white">{selectedQuote.truck_fill_percentage.toFixed(0)}%</div></div>}
                                    </div>
                                </div>
                            )}
                            </details>
                            <details><summary>Yalnız bu teklifin eski görüşme kayıtları</summary><QuoteContactHistory key={String(selectedQuote.id)} quote={selectedQuote} /></details>

                            {/* Satış Sonucu (Sprint 3): temas, takip, kazanıldı/kaybedildi, brüt kâr */}
                            <details><summary>Teklif belgesinin satış alanları</summary>
                            <SalesOutcomePanel
                                hideContact
                                quote={selectedQuote}
                                controlClass={ofisControl}
                                onSaved={() => {
                                    void loadQuotes();
                                    selectQuote(null);
                                }}
                            /></details>

                            <div className="admin-nexus-subtle p-4">
                                <h4 className="mb-3 font-semibold text-amber-300">Site etkileşimleri</h4>
                                <div className="space-y-3">
                                    {selectedQuoteEvents.length > 0 ? selectedQuoteEvents.map((event) => (
                                        <div key={event.id} className="flex items-start justify-between gap-4 rounded-xl border border-[rgba(92,98,108,0.20)] bg-[rgba(255,255,255,0.025)] p-4">
                                            <div>
                                                <p className="font-medium text-slate-100">{getEventLabel(event.event_type)}</p>
                                                <p className="mt-1 text-sm text-[var(--nx-text-muted)]">{event.brand_name || selectedQuote.brand_name || "Marka yok"} • {event.package_name || selectedQuote.package_name || "Paket yok"}</p>
                                                {event.metadata && Object.keys(event.metadata).length > 0 && (
                                                    <p className="mt-2 text-sm text-[var(--nx-text-muted)]">Kanal: {event.metadata.sourceChannel || "bilinmiyor"}</p>
                                                )}
                                            </div>
                                            <div className="text-right text-sm text-[var(--nx-text-muted)]">
                                                {new Date(event.created_at).toLocaleDateString("tr-TR")}
                                                <div className="mt-1">{new Date(event.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="rounded-xl border border-[rgba(92,98,108,0.20)] bg-[rgba(255,255,255,0.025)] p-4 text-base text-[var(--nx-text-muted)]">Bu teklif için henüz funnel event kaydı görünmüyor.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
            <details className="ofis-panel" data-testid="quote-status-distribution"><summary>Teklif durum dağılımı</summary><p data-testid="status-denominator" className="ofis-helper">Seçili filtrelerde {distribution.total} teklif · Her teklif bir kez sayılır.</p><div className="ofis-state-counts">{Object.entries(distribution.counts).map(([status,count])=><span key={status}>{quoteStatusLabel(status)} <strong data-testid={`status-count-${status}`}>{count}</strong></span>)}</div></details>
        </div>
    );
}

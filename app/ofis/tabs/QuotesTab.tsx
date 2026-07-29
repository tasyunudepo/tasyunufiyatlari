"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Trash2, ChevronDown, Layers, Download } from "lucide-react";
import { formatCurrency, formatAmount } from "@/lib/admin/utils";
import {
    groupQuotesIntoSeries,
    formatSeriesDuration,
    formatThicknesses,
    type QuoteRow,
    type QuoteSeries,
} from "@/lib/admin/groupQuotesIntoSeries";
import SalesOutcomePanel, { LOSS_CATEGORY_LABELS } from "./SalesOutcomePanel";
import { useAdminRole } from "@/lib/admin/useAdminRole";
import { useAdminQuotes } from "@/lib/hooks/useAdminQuotes";
import { SIDDET_RENGI, bekleyisSuresi, sureGosterimi } from "@/lib/admin/formatDuration";
import { buildQuotesCsvBlob, csvFileName, type CsvQuote } from "@/lib/admin/quotesCsv";

const ofisPanel = "rounded-2xl border border-[var(--nx-border)] bg-[rgba(13,15,18,0.72)] shadow-[0_18px_44px_rgba(0,0,0,0.24)]";
const ofisInner = "rounded-xl border border-[rgba(92,98,108,0.18)] bg-[rgba(255,255,255,0.025)]";
const ofisControl = "rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.82)] text-[var(--nx-text-soft)] transition-colors focus:outline-none focus-visible:border-[var(--nx-border-accent)] focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.14)]";
const ofisChip = "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.16)]";

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
const STATUS_LABELS: Record<string, string> = {
    pending: "Bekliyor",
    contacted: "İletişimde",
    quoted: "Teklif Verildi",
    approved: "Onaylandı",
    rejected: "Reddedildi",
    completed: "Tamamlandı",
};

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

export function QuotesTab() {
    const { canMutate, isReadOnly } = useAdminRole();
    const [actionError, setActionError] = useState<string | null>(null);
    // Veri artık react-query üzerinden gelir ve DashboardTab/ExperimentsTab
    // ile aynı önbelleği paylaşır (audit: aynı tablo 7 kez çekiliyordu).
    const {
        quotes: rawQuotes,
        eventsByQuoteId: rawEvents,
        funnelSummary,
        isLoading: loading,
        dataUpdatedAt: loadedAt,
        refresh,
    } = useAdminQuotes();
    const quotes = rawQuotes as unknown as OfficeQuote[];
    const quoteEventsById = rawEvents as unknown as Record<string, QuoteEvent[]>;
    const [selectedQuote, setSelectedQuote] = useState<OfficeQuote | null>(null);
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
        if (selectedQuote?.id === quoteId) setSelectedQuote(null);
        loadQuotes();
    }

    // Audit E9: teklif detayı bir modal ama Esc ile kapanmıyordu ve odağı
    // tuzaklamıyordu — klavye kullanıcısı arkadaki listeye sekmeyle
    // kaçabiliyordu. Açıkken arka plan kaydırması da kilitlenir.
    useEffect(() => {
        if (!selectedQuote) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSelectedQuote(null);
                return;
            }
            if (e.key !== "Tab") return;

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
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);
        modalRef.current?.focus();

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = oncekiOverflow;
            oncekiOdak?.focus?.();
        };
    }, [selectedQuote]);

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
        const label = requestType === "pdf_quote" ? "PDF Teklif" : "Sipariş Onayı";
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
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

    const quoteSummary = {
        total: quotes.length,
        pending: quotes.filter((q) => q.status === "pending").length,
        pdfQuote: quotes.filter((q) => q.request_type === "pdf_quote").length,
        whatsappOrder: quotes.filter((q) => q.request_type === "whatsapp_order").length,
    };

    const totalQuoteValue = quotes.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0);
    const averageQuoteValue = quotes.length > 0 ? totalQuoteValue / quotes.length : 0;
    const todayQuoteCount = quotes.filter((q) => {
        const created = new Date(q.created_at);
        const now = new Date();
        return created.getFullYear() === now.getFullYear() &&
            created.getMonth() === now.getMonth() &&
            created.getDate() === now.getDate();
    }).length;
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
        const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
        const matchesRequestType = requestTypeFilter === "all" || quote.request_type === requestTypeFilter;
        const haystack = [quote.customer_name, quote.customer_email, quote.customer_phone, quote.brand_name, quote.package_name, quote.city_name, quote.quote_code]
            .filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
        const matchesSearch = searchTerm.trim().length === 0 || haystack.includes(searchTerm.trim().toLocaleLowerCase("tr-TR"));
        return matchesStatus && matchesRequestType && matchesSearch;
    }), [quotes, rangeCutoff, statusFilter, requestTypeFilter, searchTerm]);

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
    // KPI ve huni panelleri TÜM tekliflere ihtiyaç duyduğu için veri tek
    // seferde çekilmeye devam ediyor; sayfalanan yalnız RENDER edilen liste.
    const visibleSeries = filteredSeries.slice(0, visibleCount);
    const hasMore = filteredSeries.length > visibleCount;

    const approvedCount = quotes.filter((q) => q.status === "approved").length;

    const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - 5 + i);
        const y = d.getFullYear(), m = d.getMonth();
        return {
            label: d.toLocaleDateString("tr-TR", { month: "short" }),
            count: quotes.filter((q) => { const qd = new Date(q.created_at); return qd.getFullYear() === y && qd.getMonth() === m; }).length,
        };
    });
    const maxMonthly = Math.max(...last6Months.map((d) => d.count), 1);

    const urgencyStyle: Record<string, string> = {
        urgent: "border-red-400/30 bg-red-400/10 text-red-200",
        high:   "border-amber-400/30 bg-amber-400/10 text-amber-200",
        normal: "border-[rgba(201,168,76,0.22)] bg-[rgba(201,168,76,0.08)] text-[var(--nx-gold)]",
        low:    "border-[rgba(92,98,108,0.24)] bg-[rgba(255,255,255,0.03)] text-[var(--nx-text-soft)]",
    };
    const urgencyLabel: Record<string, string> = { urgent: "Acil", high: "Yüksek", normal: "Normal", low: "Düşük" };

    // ─── Satış hunisi (Sprint 3) — ölçüm sözleşmesindeki alt metrikler ───
    const isOpen = (q: OfficeQuote) => !["completed", "rejected"].includes(q.status ?? "");
    const contactedQuotes = quotes.filter((q) => q.contact_attempted_at != null);
    const lostQuotes = quotes.filter((q) => q.status === "rejected");
    const uncontactedOpen = quotes.filter((q) => isOpen(q) && !q.contact_attempted_at);
    const avgFirstContactHours = contactedQuotes.length > 0
        ? Math.round(
            contactedQuotes.reduce((sum, q) =>
                sum + (new Date(q.contact_attempted_at as string).getTime() - new Date(q.created_at).getTime()) / 36e5, 0)
            / contactedQuotes.length)
        : null;
    const lossBreakdown = lostQuotes.reduce<Record<string, number>>((acc, q) => {
        const key = q.loss_category ?? "belirtilmedi";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {});
    const todayStr = new Date().toISOString().slice(0, 10);
    const dueFollowUps = quotes
        .filter((q) => isOpen(q) && q.follow_up_date && q.follow_up_date.slice(0, 10) <= todayStr)
        .sort((a, b) => (a.follow_up_date ?? "").localeCompare(b.follow_up_date ?? ""));

    // Gerçek ciro yalnız KAZANILMIŞ (completed) siparişlerden hesaplanır;
    // teklif toplamı ciro değildir (ölçüm sözleşmesi, Sprint 0.5).
    const wonQuotes = quotes.filter((q) => q.status === "completed");
    const wonRevenue = wonQuotes.reduce(
        (sum, q) => sum + (Number((q as { sales_final_price?: number | null }).sales_final_price ?? q.total_price) || 0),
        0,
    );
    // Audit G2: KPI kartlarındaki ilerleme çubukları kaldırıldı. "Toplam Talep"
    // çubuğu `Math.min(100, total * 4)` ile doluyordu — 25 teklifte %100 olup
    // orada kalıyordu, yani ölçtüğü bir şey yoktu. Sayı zaten kartın üstünde;
    // çubuk yalnızca gürültüydü. Anlamlı olan tek oran (kazanılan/teklif)
    // aşağıdaki satış hunisinde zaten var.
    const kpis = [
        { label: "Toplam Talep", value: String(quoteSummary.total), sub: `Bugün ${todayQuoteCount} yeni`, accent: "from-[rgba(201,168,76,0.16)] to-transparent", border: "border-[rgba(201,168,76,0.24)]", icon: "◈" },
        { label: "Toplam Teklif Tutarı", value: formatAmount(totalQuoteValue), sub: `Ort. ${formatCurrency(averageQuoteValue)} / teklif — ciro değildir`, accent: "from-sky-400/10 to-transparent", border: "border-sky-400/20", icon: "⬢" },
        { label: "Gerçek Ciro (kazanılan)", value: formatAmount(wonRevenue), sub: wonQuotes.length > 0 ? `${wonQuotes.length} kazanılmış sipariş` : "Henüz kazanılmış sipariş yok", accent: "from-emerald-400/10 to-transparent", border: "border-emerald-400/20", icon: "₺" },
    ];

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
        <div className="space-y-5">
            {/* Mutasyon hata bandı — sessiz başarısızlık yasağı (audit B2). */}
            {actionError && (
                <div
                    role="alert"
                    data-testid="quote-action-error"
                    className="flex items-start justify-between gap-4 rounded-xl border border-red-400/35 bg-red-400/10 px-4 py-3 text-sm text-red-200"
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
                    className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-200"
                >
                    Salt okunur hesap — teklifleri görüntüleyebilir, değiştiremezsiniz.
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="text-xs uppercase tracking-[0.26em] text-[var(--nx-text-muted)]">Operasyon • Canlı</div>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">Teklif Komuta Merkezi</h1>
                    <p className="mt-1 text-sm text-slate-400 max-w-xl">
                        Teklif akışını, durum dağılımını ve kanal performansını tek ekrandan izleyin.
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    {todayQuoteCount > 0 && (
                        <span className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200 shadow-lg shadow-amber-500/10">
                            Bugün {todayQuoteCount} teklif
                        </span>
                    )}
                    <button onClick={loadQuotes} className={`${ofisControl} px-4 py-2 text-sm hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--nx-text)]`}>
                        Yenile
                    </button>
                </div>
            </div>

            {/* KPI Kartlar */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {kpis.map((item) => (
                    <div key={item.label} className={`relative overflow-hidden rounded-2xl border ${item.border} bg-[rgba(13,15,18,0.76)] p-5 shadow-[0_16px_38px_rgba(0,0,0,0.24)]`}>
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.accent}`} />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between">
                                <div className="text-[11px] uppercase tracking-[0.32em] text-slate-400">{item.label}</div>
                                <div className="text-xl text-white/70">{item.icon}</div>
                            </div>
                            <div className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</div>
                            <div className="mt-4 text-xs text-slate-400">{item.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Satış Hunisi (Sprint 3) ─── */}
            <div className={`${ofisPanel} p-5`} data-testid="sales-funnel">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-[0.28em] text-amber-300/80">Satış Operasyonu</div>
                        <h2 className="mt-1.5 text-xl font-semibold">Teklif → Temas → Satış hunisi</h2>
                    </div>
                    {uncontactedOpen.length > 0 && (
                        <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs text-red-200">
                            {uncontactedOpen.length} açık teklif temassız
                        </span>
                    )}
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                    {[
                        { label: "Teklif", value: quotes.length },
                        { label: "Temas", value: contactedQuotes.length },
                        { label: "Fiyat verildi", value: quotes.filter((q) => q.status === "quoted").length },
                        { label: "Teyit", value: quotes.filter((q) => q.status === "approved").length },
                        { label: "Kazanıldı", value: wonQuotes.length },
                        { label: "Kaybedildi", value: lostQuotes.length },
                    ].map((step, i, arr) => (
                        <div key={step.label} className="flex items-center gap-2">
                            <div className={`${ofisInner} px-3 py-2 text-center`}>
                                <div className="text-lg font-semibold text-white tabular-nums">{step.value}</div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">{step.label}</div>
                            </div>
                            {i < arr.length - 1 && <span className="text-[var(--nx-text-muted)]">→</span>}
                        </div>
                    ))}
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-3">
                    {/* Audit V3: burada canlıda "1674 saat" yazıyordu — 70 günü
                        saat cinsinden okumak metriği kullanılamaz kılıyor ve
                        alarm nötr görünüyordu. */}
                    <div className={`${ofisInner} p-3`}>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Ortalama ilk temas</div>
                        {(() => {
                            const g = sureGosterimi(avgFirstContactHours);
                            if (!g) return <div className="mt-1 font-semibold text-[var(--nx-text-muted)]">veri yok</div>;
                            return (
                                <div className={`mt-1 font-semibold ${SIDDET_RENGI[g.siddet]}`} title={`${Math.round(g.saat)} saat`}>
                                    {g.metin}
                                </div>
                            );
                        })()}
                    </div>
                    <div className={`${ofisInner} p-3`}>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Kazanılan brüt kâr</div>
                        <div className="mt-1 font-semibold text-emerald-300">
                            {wonQuotes.reduce((s, q) => s + (Number(q.gross_profit) || 0), 0).toLocaleString("tr-TR")} ₺
                        </div>
                    </div>
                    <div className={`${ofisInner} p-3`}>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Kayıp nedenleri</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {Object.keys(lossBreakdown).length === 0 && <span className="text-[var(--nx-text-muted)]">henüz yok</span>}
                            {Object.entries(lossBreakdown).map(([cat, count]) => (
                                <span key={cat} className="rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-[10px] text-red-200">
                                    {(LOSS_CATEGORY_LABELS[cat] ?? cat)} · {count}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {dueFollowUps.length > 0 && (
                    <div className="mt-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300/90">
                            Bugünkü takipler ({dueFollowUps.length})
                        </div>
                        <div className="space-y-2">
                            {dueFollowUps.map((q) => (
                                <button
                                    key={q.id}
                                    type="button"
                                    onClick={() => setSelectedQuote(q)}
                                    className={`${ofisInner} flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)]`}
                                >
                                    <span className="min-w-0 truncate text-white">
                                        {q.customer_name} <span className="text-[var(--nx-text-muted)]">· {q.customer_phone}</span>
                                    </span>
                                    <span className="shrink-0 text-xs text-amber-300">
                                        takip: {new Date(q.follow_up_date as string).toLocaleDateString("tr-TR")}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Teklif Ritmi + Markalar */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-5">
                <div className={`${ofisPanel} p-5`}>
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="text-xs uppercase tracking-[0.28em] text-amber-300/80">Canlı Görünüm</div>
                            <h2 className="mt-1.5 text-xl font-semibold">Teklif Ritmi</h2>
                        </div>
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">{quotes.length} toplam</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr] gap-4">
                        <div className={`${ofisInner} p-4`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-slate-300">Aylık Teklif Hacmi</div>
                                <div className="text-xs text-[var(--nx-text-muted)]">Son 6 ay</div>
                            </div>
                            <div className="h-40 flex items-end gap-3 px-1">
                                {last6Months.map((m, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                        <div className="w-full rounded-t-lg border border-[rgba(201,168,76,0.18)] bg-gradient-to-t from-[rgba(201,168,76,0.22)] to-[rgba(201,168,76,0.72)] min-h-[6px]"
                                            style={{ height: `${Math.max(6, (m.count / maxMonthly) * 100)}%` }} />
                                        <span className="text-[10px] text-[var(--nx-text-muted)]">{m.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className={`${ofisInner} p-4`}>
                                <div className="text-sm text-slate-300 mb-3">Durum Akışı</div>
                                {[
                                    { label: "Bekliyor", value: quoteSummary.pending, gradient: "from-amber-300 to-orange-400" },
                                    { label: "Teklif Verildi", value: quotes.filter((q) => q.status === "quoted").length, gradient: "from-[var(--nx-gold)] to-amber-500" },
                                    { label: "Onaylandı", value: approvedCount, gradient: "from-emerald-400 to-teal-400" },
                                    { label: "İletişimde", value: quotes.filter((q) => q.status === "contacted").length, gradient: "from-sky-300 to-sky-500" },
                                ].map(({ label, value, gradient }) => (
                                    <div key={label} className="mb-3 last:mb-0">
                                        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
                                            <span>{label}</span><span>{value}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                                            <div className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                                                style={{ width: `${quoteSummary.total > 0 ? Math.max(value > 0 ? 6 : 0, Math.round((value / quoteSummary.total) * 100)) : 0}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className={`${ofisPanel} p-5`}>
                        <div className="text-xs uppercase tracking-[0.28em] text-[var(--nx-text-muted)]">Kanal</div>
                        <h3 className="mt-1.5 text-xl font-semibold">Talep Türleri</h3>
                        {/* Audit G3: çubuk genişliği `value * 8` ile hesaplanıyordu —
                            33 teklif de %100 doluyordu, 13 teklif de. Ortak bir ölçek
                            olmadığı için çubuklar birbiriyle kıyaslanamıyordu. Artık
                            hepsi grubun en büyüğüne göre normalize ediliyor. */}
                        <div className="mt-4 space-y-3">
                            {(() => {
                                const kanallar = [
                                    { label: "PDF Teklif", value: quoteSummary.pdfQuote, gradient: "from-[var(--nx-gold)] to-amber-500" },
                                    { label: "WhatsApp Onay", value: quoteSummary.whatsappOrder, gradient: "from-emerald-400 to-teal-400" },
                                    { label: "PDF İndirme", value: funnelSummary.pdf_downloaded || 0, gradient: "from-[var(--nx-gold)] to-amber-500" },
                                    { label: "WA Açılışı", value: funnelSummary.whatsapp_opened || 0, gradient: "from-green-400 to-emerald-500" },
                                ];
                                const enBuyuk = Math.max(...kanallar.map((k) => k.value), 1);
                                return kanallar.map(({ label, value, gradient }) => (
                                    <div key={label}>
                                        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300"><span>{label}</span><span>{value}</span></div>
                                        <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                                            <div
                                                className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                                                style={{ width: `${value === 0 ? 0 : Math.max(4, Math.round((value / enBuyuk) * 100))}%` }}
                                            />
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Teklif Masası */}
            <div className={`${ofisPanel} p-5`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                    <div>
                        <div className="text-xs uppercase tracking-[0.28em] text-[var(--nx-text-muted)]">Operasyon</div>
                        <h2 className="mt-1.5 text-xl font-semibold">Teklif Masası</h2>
                        <p className="mt-1 text-xs text-[var(--nx-text-muted)]">
                            {filteredSeries.length} seri • {filteredQuotes.length} / {quotes.length} teklif gösteriliyor
                            {multiQuoteSeriesCount > 0 && (
                                <span className="ml-1 text-[var(--nx-gold)]">· {multiQuoteSeriesCount} çoklu seri</span>
                            )}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                        {[
                            { value: "all", label: "Tümü" },
                            { value: "pending", label: "Bekliyor" },
                            { value: "quoted", label: "Teklif Verildi" },
                            { value: "approved", label: "Onaylandı" },
                            { value: "rejected", label: "Reddedildi" },
                            { value: "completed", label: "Tamamlandı" },
                        ].map((f) => (
                            <button key={f.value} onClick={() => { setStatusFilter(f.value); resetPagination(); }}
                                className={`${ofisChip} ${statusFilter === f.value ? "border-[var(--nx-gold)] bg-[var(--nx-gold)] text-[#101114]" : "border-[rgba(92,98,108,0.24)] bg-[rgba(255,255,255,0.03)] text-[var(--nx-text-soft)] hover:bg-[rgba(255,255,255,0.055)] hover:text-[var(--nx-text)]"}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[180px_180px_1fr_auto] mb-5">
                    <select value={requestTypeFilter} onChange={(e) => { setRequestTypeFilter(e.target.value); resetPagination(); }}
                        aria-label="Talep türüne göre filtrele"
                        className={`${ofisControl} px-4 py-2.5 text-sm`}>
                        <option value="all">Tüm Talep Türleri</option>
                        <option value="pdf_quote">PDF Teklif</option>
                        <option value="whatsapp_order">WhatsApp Onay</option>
                        <option value="manual_quote">Ofis Teklifi</option>
                    </select>
                    <select value={dateRangeDays} onChange={(e) => { setDateRangeDays(Number(e.target.value)); resetPagination(); }}
                        aria-label="Tarih aralığına göre filtrele"
                        className={`${ofisControl} px-4 py-2.5 text-sm [color-scheme:dark]`}>
                        <option value={0}>Tüm zamanlar</option>
                        <option value={7}>Son 7 gün</option>
                        <option value={30}>Son 30 gün</option>
                        <option value={90}>Son 90 gün</option>
                    </select>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--nx-text-muted)] text-sm">⌕</span>
                        <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); resetPagination(); }}
                            aria-label="Tekliflerde ara"
                            placeholder="Müşteri, marka, şehir veya paket ara…"
                            className={`${ofisControl} w-full pl-9 pr-4 py-2.5 text-sm placeholder:text-[var(--nx-text-muted)]`} />
                    </div>
                    {/* Audit E4: panelde hiç dışa aktarım yoktu. Filtrelenmiş
                        liste indirilir — ekranda ne görüyorsa o iner. */}
                    <button
                        type="button"
                        onClick={exportCsv}
                        disabled={filteredQuotes.length === 0}
                        data-testid="quotes-export-csv"
                        title="Filtrelenmiş teklifleri CSV olarak indir"
                        className={`${ofisControl} inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--nx-text)] disabled:opacity-40`}
                    >
                        <Download className="h-3.5 w-3.5" />
                        CSV ({filteredQuotes.length})
                    </button>
                </div>
                <div className="space-y-3">
                    {filteredSeries.length === 0 ? (
                        <div className={`${ofisInner} p-8 text-center text-[var(--nx-text-muted)]`}>Seçili filtrelerde teklif talebi bulunmuyor.</div>
                    ) : visibleSeries.map((series) => {
                        const isMulti = series.quoteCount > 1;
                        // Tek teklifli seriler default açık; çok teklifliler default kapalı.
                        const isOpen = isMulti ? (expandedSeries[series.seriesKey] ?? false) : true;
                        const requestTypes = Array.from(new Set(series.quotes.map(q => q.request_type).filter(Boolean)));
                        const matLabel = series.materialType === "tasyunu"
                            ? "Taşyünü"
                            : series.materialType === "eps"
                                ? "EPS"
                                : (series.materialType ?? "");
                        return (
                            <div key={series.seriesKey} className={`${ofisInner}`}>
                                {/* ── Seri başlık satırı ── */}
                                {isMulti && (
                                    <button
                                        type="button"
                                        onClick={() => setExpandedSeries(prev => ({ ...prev, [series.seriesKey]: !isOpen }))}
                                        aria-expanded={isOpen}
                                        aria-controls={`series-body-${series.seriesKey}`}
                                        className="w-full text-left px-5 py-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between hover:bg-[rgba(255,255,255,0.025)] transition-colors rounded-xl"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Layers className="w-4 h-4 text-[var(--nx-gold)]" />
                                                <span className="text-base font-semibold text-white">
                                                    {series.customerCompany || series.customerName || "Müşteri yok"}
                                                </span>
                                                <span className="rounded-full border border-[rgba(201,168,76,0.26)] bg-[rgba(201,168,76,0.10)] px-2.5 py-0.5 text-xs text-[var(--nx-gold)]">
                                                    Teklif Serisi · {series.quoteCount} teklif
                                                </span>
                                                {series.durationMinutes > 0 && (
                                                    <span className="rounded-full border border-[rgba(92,98,108,0.24)] bg-[rgba(255,255,255,0.03)] px-2.5 py-0.5 text-xs text-slate-300">
                                                        {formatSeriesDuration(series.durationMinutes)}
                                                    </span>
                                                )}
                                                {requestTypes.map((rt) => (
                                                    <span key={String(rt)} className={`rounded-full px-2.5 py-0.5 text-xs border ${rt === "pdf_quote" ? "border-[rgba(201,168,76,0.26)] bg-[rgba(201,168,76,0.10)] text-[var(--nx-gold)]" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"}`}>
                                                        {rt === "pdf_quote" ? "PDF" : "WhatsApp"}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="mt-1 text-sm text-slate-400 truncate">
                                                {series.customerPhone === "no_phone" ? "Telefon yok" : series.customerPhone}
                                                {series.cityName ? ` • ${series.cityName}` : ""}
                                                {matLabel ? ` • ${matLabel}` : ""}
                                                {series.thicknesses.length > 0 ? ` • ${formatThicknesses(series.thicknesses)}` : ""}
                                            </div>
                                            <div className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
                                                {series.brands.length > 0 ? series.brands.join(" / ") : "—"}
                                                {series.packageNames.length > 0 ? ` · ${series.packageNames.join(" / ")}` : ""}
                                            </div>
                                            <div className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
                                                Son teklif: {new Date(series.endedAt).toLocaleDateString("tr-TR")} {new Date(series.endedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="text-right">
                                                <div className="text-xs text-[var(--nx-text-muted)]">
                                                    {series.minPrice != null && series.maxPrice != null && series.minPrice !== series.maxPrice
                                                        ? "Teklif aralığı"
                                                        : "Teklif tutarı"}
                                                </div>
                                                <div className="text-lg font-semibold text-white">
                                                    {series.minPrice != null && series.maxPrice != null
                                                        ? series.minPrice === series.maxPrice
                                                            ? `${Math.round(series.maxPrice).toLocaleString("tr-TR")} ₺`
                                                            : `${Math.round(series.minPrice).toLocaleString("tr-TR")} – ${Math.round(series.maxPrice).toLocaleString("tr-TR")} ₺`
                                                        : "—"}
                                                </div>
                                            </div>
                                            <ChevronDown className={`w-5 h-5 text-[var(--nx-text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                        </div>
                                    </button>
                                )}

                                {/* ── Seri içindeki teklif satırları ── */}
                                {isOpen && (
                                    <div id={`series-body-${series.seriesKey}`} className={isMulti ? "border-t border-[rgba(92,98,108,0.18)] divide-y divide-[rgba(92,98,108,0.12)]" : ""}>
                                        {series.quotes.map((quote) => {
                                            const priorityKey = quote.priority ?? "normal";
                                            return (
                                            <div key={quote.id} className={`${isMulti ? "px-5 py-4" : "px-5 py-4"} transition-colors hover:bg-[rgba(255,255,255,0.045)]`}>
                                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-base font-semibold text-white">{quote.customer_name}</span>
                                                            {quote.quote_code && (
                                                                <span className="rounded-md px-2 py-0.5 text-xs font-mono bg-[rgba(255,255,255,0.04)] text-slate-400 border border-[rgba(92,98,108,0.22)]">
                                                                    {quote.quote_code}
                                                                </span>
                                                            )}
                                                            <span className={`rounded-full px-2.5 py-0.5 text-xs border ${urgencyStyle[priorityKey] ?? urgencyStyle.normal}`}>
                                                                {urgencyLabel[priorityKey] ?? "Normal"}
                                                            </span>
                                                            <span className={`rounded-full px-2.5 py-0.5 text-xs border ${quote.request_type === "pdf_quote" ? "border-[rgba(201,168,76,0.26)] bg-[rgba(201,168,76,0.10)] text-[var(--nx-gold)]" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"}`}>
                                                                {quote.request_type === "pdf_quote" ? "PDF" : "WhatsApp"}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 text-sm text-slate-400 truncate">
                                                            {quote.brand_name || "Marka yok"} • {quote.package_name || "Paket yok"} • {quote.material_type === "tasyunu" ? "Taşyünü" : "EPS"} {quote.thickness_cm}cm • {quote.area_m2} m² • {quote.city_name || "—"}
                                                        </div>
                                                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--nx-text-muted)]">
                                                            <span>
                                                                {new Date(quote.created_at).toLocaleDateString("tr-TR")} {new Date(quote.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                                            </span>
                                                            {/* Temas SLA rozeti (Sprint 3): açık teklif temassızsa yaşını göster */}
                                                            {!quote.contact_attempted_at && !["completed", "rejected"].includes(quote.status ?? "") && (() => {
                                                                const hours = (loadedAt - new Date(quote.created_at).getTime()) / 36e5;
                                                                if (!Number.isFinite(hours) || hours < 0) return null;
                                                                return (
                                                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                                                        hours >= 24
                                                                            ? "border-red-400/40 bg-red-400/10 text-red-300"
                                                                            : "border-amber-400/40 bg-amber-400/10 text-amber-300"
                                                                    }`}>
                                                                        ⏱ {bekleyisSuresi(hours)} temassız
                                                                    </span>
                                                                );
                                                            })()}
                                                            {quote.status === "completed" && quote.gross_profit != null && (
                                                                <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                                                                    kâr {Number(quote.gross_profit).toLocaleString("tr-TR")} ₺
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-5 flex-shrink-0">
                                                        <div className="text-right">
                                                            <div className="text-xl font-semibold text-white">{(quote.total_price ?? 0).toLocaleString("tr-TR")} ₺</div>
                                                            <div className="text-xs text-[var(--nx-text-muted)]">{(quote.price_per_m2 ?? 0).toFixed(2)} ₺/m²</div>
                                                        </div>
                                                        {/* Salt-okunur hesapta değiştirme kontrolü hiç render edilmez;
                                                            bilgi rozet olarak kalır (audit B1). */}
                                                        {canMutate ? (
                                                            <select value={quote.status ?? "pending"} onChange={(e) => updateQuoteStatus(quote.id, e.target.value)}
                                                                aria-label={`${quote.customer_name} teklif durumu`}
                                                                className={`${ofisControl} px-3 py-2 text-xs min-w-[130px]`}>
                                                                <option value="pending">Bekliyor</option>
                                                                <option value="contacted">İletişimde</option>
                                                                <option value="quoted">Teklif Verildi</option>
                                                                <option value="approved">Onaylandı</option>
                                                                <option value="rejected">Reddedildi</option>
                                                                <option value="completed">Tamamlandı</option>
                                                            </select>
                                                        ) : (
                                                            <span className={`${ofisInner} px-3 py-2 text-xs min-w-[130px] text-center text-slate-300`}>
                                                                {STATUS_LABELS[quote.status ?? "pending"] ?? quote.status}
                                                            </span>
                                                        )}
                                                        {canMutate ? (
                                                            <select value={quote.priority ?? "normal"} onChange={(e) => updateQuotePriority(quote.id, e.target.value)}
                                                                aria-label={`${quote.customer_name} teklif önceliği`}
                                                                className={`${ofisControl} px-3 py-2 text-xs min-w-[100px]`}>
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
                                                                className={`${ofisControl} px-3 py-2 text-xs text-sky-300 hover:bg-sky-400/10 whitespace-nowrap`}
                                                                title="PDF Görüntüle"
                                                            >
                                                                PDF
                                                            </a>
                                                        )}
                                                        <button onClick={() => setSelectedQuote(quote)}
                                                            className={`${ofisControl} border-[rgba(201,168,76,0.26)] bg-[rgba(201,168,76,0.10)] px-4 py-2 text-xs text-[var(--nx-gold)] hover:bg-[rgba(201,168,76,0.14)] whitespace-nowrap`}>
                                                            Detay →
                                                        </button>
                                                        {canMutate && (
                                                            <button onClick={() => { if (confirm(`"${quote.customer_name}" teklifini silmek istiyor musunuz?\nBu işlem geri alınamaz.`)) { deleteQuote(quote.id); } }}
                                                                className="rounded-xl border border-red-500/20 bg-red-500/[0.08] p-2 text-red-400/70 transition-colors hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/25" title="Teklifi sil" aria-label="Teklifi sil">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
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
                            className={`${ofisInner} w-full py-3 text-sm text-slate-300 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-white`}
                        >
                            Daha fazla göster — {filteredSeries.length - visibleCount} seri daha
                        </button>
                    )}
                </div>
            </div>

            {/* Quote Detail Modal */}
            {selectedQuote && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setSelectedQuote(null); }}
                >
                    <div
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Teklif detayı ${selectedQuote.id}`}
                        tabIndex={-1}
                        className="admin-nexus-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl focus:outline-none"
                    >
                        <div className="sticky top-0 rounded-t-2xl border-b border-[rgba(92,98,108,0.24)] bg-[rgba(15,17,21,0.96)] p-6 text-white shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-bold mb-2">
                                        Teklif Detayı #{selectedQuote.id}
                                        {selectedQuote.quote_code && (
                                            <span className="ml-3 text-base font-mono font-normal text-amber-300/80">{selectedQuote.quote_code}</span>
                                        )}
                                    </h3>
                                        <p className="text-[var(--nx-text-soft)] text-sm">{new Date(selectedQuote.created_at).toLocaleString("tr-TR")}</p>
                                    {(selectedQuote.pdf_storage_path || selectedQuote.pdf_url) && (
                                        <div className="flex gap-2 mt-3">
                                            <a
                                                href={`/api/admin/quotes/${selectedQuote.id}/pdf`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`${ofisControl} px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/10`}
                                            >
                                                PDF Görüntüle
                                            </a>
                                            <a
                                                href={`/api/admin/quotes/${selectedQuote.id}/pdf?download=1`}
                                                download
                                                className={`${ofisControl} px-4 py-2 text-xs font-semibold hover:bg-[rgba(255,255,255,0.06)]`}
                                            >
                                                ↓ İndir
                                            </a>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setSelectedQuote(null)} className="rounded-full p-2 text-[var(--nx-text-soft)] transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.18)]" aria-label="Detay penceresini kapat">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="admin-nexus-subtle p-4">
                                <h4 className="font-semibold text-[var(--nx-text)] mb-3">Müşteri Bilgileri</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div><span className="text-slate-400">Ad Soyad:</span><div className="font-medium text-white">{selectedQuote.customer_name}</div></div>
                                    <div><span className="text-slate-400">E-posta:</span><div className="font-medium text-white">{selectedQuote.customer_email}</div></div>
                                    <div><span className="text-slate-400">Telefon:</span><div className="font-medium text-white">{selectedQuote.customer_phone}</div></div>
                                    {selectedQuote.customer_company && <div><span className="text-slate-400">Firma:</span><div className="font-medium text-white">{selectedQuote.customer_company}</div></div>}
                                    {selectedQuote.customer_address && <div className="col-span-2"><span className="text-slate-400">Adres:</span><div className="font-medium text-white">{selectedQuote.customer_address}</div></div>}
                                </div>
                            </div>
                            <div className="admin-nexus-subtle p-4">
                                <h4 className="font-semibold text-[var(--nx-gold)] mb-3">Sipariş Detayları</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
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
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div><span className="text-slate-400">KDV Hariç:</span><div className="font-medium text-white">{(selectedQuote.price_without_vat ?? 0).toLocaleString("tr-TR")} ₺</div></div>
                                    <div><span className="text-slate-400">KDV:</span><div className="font-medium text-white">{(selectedQuote.vat_amount ?? 0).toLocaleString("tr-TR")} ₺</div></div>
                                    <div><span className="text-slate-400">Toplam:</span><div className="font-bold text-green-400 text-lg">{(selectedQuote.total_price ?? 0).toLocaleString("tr-TR")} ₺</div></div>
                                    <div><span className="text-slate-400">m² Fiyatı:</span><div className="font-medium text-white">{(selectedQuote.price_per_m2 ?? 0).toFixed(2)} ₺/m²</div></div>
                                </div>
                            </div>
                            {selectedQuote.vehicle_type && (
                                <div className="rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(255,255,255,0.03)] p-4">
                                    <h4 className="font-semibold text-[var(--nx-text)] mb-3">Lojistik Bilgileri</h4>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div><span className="text-slate-400">Araç Tipi:</span><div className="font-medium text-white">{selectedQuote.vehicle_type === "lorry" && "Kamyon"}{selectedQuote.vehicle_type === "truck" && "Tır"}{selectedQuote.vehicle_type === "multiple" && "Birden Fazla Araç"}</div></div>
                                        <div><span className="text-slate-400">Paket Sayısı:</span><div className="font-medium text-white">{selectedQuote.package_count} paket</div></div>
                                        {selectedQuote.lorry_fill_percentage && <div><span className="text-slate-400">Kamyon Doluluk:</span><div className="font-medium text-white">{selectedQuote.lorry_fill_percentage.toFixed(0)}%</div></div>}
                                        {selectedQuote.truck_fill_percentage && <div><span className="text-slate-400">Tır Doluluk:</span><div className="font-medium text-white">{selectedQuote.truck_fill_percentage.toFixed(0)}%</div></div>}
                                    </div>
                                </div>
                            )}
                            {/* Satış Sonucu (Sprint 3): temas, takip, kazanıldı/kaybedildi, brüt kâr */}
                            <SalesOutcomePanel
                                quote={selectedQuote}
                                controlClass={ofisControl}
                                onSaved={() => {
                                    void loadQuotes();
                                    setSelectedQuote(null);
                                }}
                            />

                            <div className="admin-nexus-subtle p-4">
                                <h4 className="mb-3 font-semibold text-amber-300">Akış Zaman Çizgisi</h4>
                                <div className="space-y-3">
                                    {selectedQuoteEvents.length > 0 ? selectedQuoteEvents.map((event) => (
                                        <div key={event.id} className="flex items-start justify-between gap-4 rounded-xl border border-[rgba(92,98,108,0.20)] bg-[rgba(255,255,255,0.025)] p-4">
                                            <div>
                                                <p className="font-medium text-slate-100">{getEventLabel(event.event_type)}</p>
                                                <p className="mt-1 text-xs text-[var(--nx-text-muted)]">{event.brand_name || selectedQuote.brand_name || "Marka yok"} • {event.package_name || selectedQuote.package_name || "Paket yok"}</p>
                                                {event.metadata && Object.keys(event.metadata).length > 0 && (
                                                    <p className="mt-2 text-xs text-[var(--nx-text-muted)]">Kanal: {event.metadata.sourceChannel || "bilinmiyor"}</p>
                                                )}
                                            </div>
                                            <div className="text-right text-xs text-[var(--nx-text-muted)]">
                                                {new Date(event.created_at).toLocaleDateString("tr-TR")}
                                                <div className="mt-1">{new Date(event.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="rounded-xl border border-[rgba(92,98,108,0.20)] bg-[rgba(255,255,255,0.025)] p-4 text-sm text-[var(--nx-text-muted)]">Bu teklif için henüz funnel event kaydı görünmüyor.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

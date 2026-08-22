"use client";

import { useMemo } from "react";
import {
    FileText, MessageSquare, TrendingUp, TrendingDown, CheckCircle2,
    PhoneOff, CalendarClock, ArrowRight,
} from "lucide-react";
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { formatCurrency, formatAmount, formatM2 } from "@/lib/admin/utils";
import { useAdminQuotes } from "@/lib/hooks/useAdminQuotes";
import { useDashboardMetrics } from "@/lib/hooks/useAdminMetrics";
import { SIDDET_RENGI, bekleyisSuresi, saatFarki, sureGosterimi } from "@/lib/admin/formatDuration";
import {
    dashboardQuoteChannelLabel,
    isOpenDashboardQuote,
    selectRecentUncontactedQuotes,
} from "@/lib/admin/dashboardQuotes";

type LucideIcon = typeof FileText;

interface DashboardQuote {
    id: number;
    created_at: string;
    status: string | null;
    request_type: string | null;
    customer_name: string | null;
    brand_name: string | null;
    area_m2: number | null;
    total_price: number | null;
    // Satış takibi alanları (migration v22) — iş listesi bunlara bakar.
    contact_attempted_at?: string | null;
    follow_up_date?: string | null;
}

/** Son 24 saatin saatlik kovaları — `now` render'da değil veri yüklendiği anda alınır. */
function buildHourlyBuckets(
    quotes: DashboardQuote[],
    now: number,
    filter?: (q: DashboardQuote) => boolean,
): number[] {
    const buckets = new Array(24).fill(0);
    for (const q of quotes) {
        if (filter && !filter(q)) continue;
        const diff = (now - new Date(q.created_at).getTime()) / (1000 * 60 * 60);
        if (diff >= 0 && diff < 24) buckets[23 - Math.floor(diff)]++;
    }
    return buckets;
}

function Sparkline({ data }: { data: number[] }) {
    if (!data.length) return null;
    const max = Math.max(...data, 1);
    const w = 100;
    const h = 38;
    const step = w / Math.max(1, data.length - 1);
    const points = data.map((v, i) => `${(i * step).toFixed(2)},${(h - (v / max) * h * 0.85 - h * 0.08).toFixed(2)}`);
    const line = `M ${points.join(" L ")}`;
    const fill = `${line} L ${w},${h} L 0,${h} Z`;
    return (
        <svg className="nx-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <defs>
                <linearGradient id="nx-sparkline-grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path className="fill" d={fill} />
            <path className="line" d={line} />
        </svg>
    );
}

function KpiTile({ label, value, icon: Icon, trend, spark, onClick }: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: { dir: "up" | "down" | "flat"; pct: number } | null;
    spark: number[];
    onClick?: () => void;
}) {
    // Audit E9: kart `role="button"` alıyordu ama `tabIndex`/`onKeyDown` yoktu —
    // klavyeyle ne odaklanılabiliyor ne tetiklenebiliyordu. Tıklanabilir kart
    // artık gerçek bir <button> gibi davranır.
    return (
        <div
            className="nx-kpi-tile"
            onClick={onClick}
            onKeyDown={
                onClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onClick();
                        }
                    }
                    : undefined
            }
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            style={{ cursor: onClick ? "pointer" : "default" }}
        >
            <span className="nx-kpi-tile__icon"><Icon className="w-4 h-4" /></span>
            <span className="nx-kpi-tile__label">{label}</span>
            <div className="flex items-end justify-between gap-2">
                <span className="nx-kpi-tile__value">{value}</span>
                {trend && (
                    <span className={`nx-kpi-tile__trend ${trend.dir}`}>
                        {trend.dir === "up" && <TrendingUp className="w-3 h-3" />}
                        {trend.dir === "down" && <TrendingDown className="w-3 h-3" />}
                        {trend.dir === "flat"
                            ? "±0%"
                            : `${trend.dir === "up" ? "+" : "−"}${Math.abs(Math.round(trend.pct))}%`}
                    </span>
                )}
            </div>
            <Sparkline data={spark} />
        </div>
    );
}

function Gauge({ percent, label }: { percent: number; label: string }) {
    const pct = Math.max(0, Math.min(100, percent));
    const arcLen = Math.PI * 80;
    return (
        <div className="nx-gauge">
            <svg viewBox="0 0 200 110" preserveAspectRatio="xMidYMid meet">
                <path className="nx-gauge__track" d="M 20 100 A 80 80 0 0 1 180 100" />
                <path
                    className="nx-gauge__value"
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    style={{
                        strokeDasharray: arcLen,
                        strokeDashoffset: arcLen * (1 - pct / 100),
                    }}
                />
            </svg>
            <div className="nx-gauge__center">
                <div className="num">%{Math.round(pct)}</div>
                <div className="label">{label}</div>
            </div>
        </div>
    );
}

export function DashboardTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
    // Teklif verisi QuotesTab ve ExperimentsTab ile ortak önbellekten gelir
    // (audit: aynı tablo bir gezintide 7 kez çekiliyordu).
    const { quotes: sharedQuotes, dataUpdatedAt } = useAdminQuotes();
    const dashboardQuotes = sharedQuotes as unknown as DashboardQuote[];
    const { metrics, isError: metricsError } = useDashboardMetrics();

    // Saatlik kovalar verinin çekildiği ana göre hesaplanır — react-query'nin
    // damgası kullanılır, render içinde Date.now() çağrılmaz.
    const quotesLoadedAt = dataUpdatedAt;


    const dashboardQuoteSummary = {
        total: dashboardQuotes.length,
        approved: dashboardQuotes.filter((q) => q.status === "approved").length,
    };
    const recentQuotes = [...dashboardQuotes]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 4);

    const hourlyBuckets = useMemo(
        () => buildHourlyBuckets(dashboardQuotes, quotesLoadedAt),
        [dashboardQuotes, quotesLoadedAt],
    );

    const hourlyPdfBuckets = useMemo(
        () => buildHourlyBuckets(dashboardQuotes, quotesLoadedAt, (q) => q.request_type === "pdf_quote"),
        [dashboardQuotes, quotesLoadedAt],
    );

    const hourlyWaBuckets = useMemo(
        () => buildHourlyBuckets(dashboardQuotes, quotesLoadedAt, (q) => q.request_type === "whatsapp_order"),
        [dashboardQuotes, quotesLoadedAt],
    );

    const hourlyPendingBuckets = useMemo(
        () => buildHourlyBuckets(dashboardQuotes, quotesLoadedAt, (q) => q.status === "pending"),
        [dashboardQuotes, quotesLoadedAt],
    );

    const areaChartData = hourlyBuckets.map((value, i) => ({
        hour: i === 23 ? "Şimdi" : `${23 - i}s`,
        value,
    }));

    const velocityTrendRaw = metrics?.velocity_trend ?? "stable";
    const velocityDir: "up" | "down" | "flat" =
        velocityTrendRaw === "up" ? "up" : velocityTrendRaw === "down" ? "down" : "flat";
    const velocityPct = metrics?.velocity_ratio != null
        ? Math.round((metrics.velocity_ratio - 1) * 100)
        : 0;
    const generalTrend = metrics ? { dir: velocityDir, pct: velocityPct } : null;

    const conversionRate = dashboardQuoteSummary.total > 0
        ? (dashboardQuoteSummary.approved / dashboardQuoteSummary.total) * 100
        : 0;

    // ── Bugünün iş listesi (audit V2 / E6) ──
    // Eski üst şerit "Bugünkü Teklif 0 · Bekleyen 0 · PDF 0 · WhatsApp 0"
    // gösteriyordu: gün içinde teklif gelmediyse panel bomboş hissettiriyordu,
    // oysa 22 teklif temassız bekliyordu. Şerit artık EYLEME dönük.
    // react-query'nin veri damgası; render içinde Date.now() çağrılmaz.
    const olcumAni = quotesLoadedAt || 0;
    const todayStr = new Date(olcumAni).toISOString().slice(0, 10);

    const openQuotes = dashboardQuotes.filter(isOpenDashboardQuote);
    const uncontacted = openQuotes.filter((q) => !q.contact_attempted_at);
    const dueFollowUps = openQuotes.filter(
        (q) => q.follow_up_date && q.follow_up_date.slice(0, 10) <= todayStr,
    );

    // Yeni manuel teklifler 5 haftalık kayıtların arkasında kalmamalı. Eski
    // kayıtlar toplam sayıda ve Teklifler sekmesinde durur; üst liste son
    // eklenen temassız teklifleri gösterir.
    const worklist = selectRecentUncontactedQuotes(dashboardQuotes, 5);

    return (
        <div className="space-y-6">
            {metricsError && (
                <div className="rounded-xl border border-[rgba(220,80,80,0.35)] bg-[rgba(220,80,80,0.08)] px-4 py-3 text-sm text-red-300">
                    Panel metrikleri yüklenemedi — aşağıdaki kartlar eksik veya sıfır görünebilir. Sayfayı yenileyin; sorun sürerse dashboard-metrics API&apos;sini kontrol edin.
                </div>
            )}
            {/* Row 1: KPI strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Audit V2: şerit "bugün" yerine YAPILACAK İŞ gösterir.
                    Gün içinde teklif gelmemiş olabilir; bekleyen iş durur. */}
                <KpiTile
                    label="Temassız Teklif"
                    value={uncontacted.length}
                    icon={PhoneOff}
                    trend={null}
                    spark={hourlyPendingBuckets}
                    onClick={() => onNavigate("quotes")}
                />
                <KpiTile
                    label="Bugün Takip"
                    value={dueFollowUps.length}
                    icon={CalendarClock}
                    trend={null}
                    spark={hourlyBuckets}
                    onClick={() => onNavigate("quotes")}
                />
                <KpiTile
                    label="Açık Teklif"
                    value={openQuotes.length}
                    icon={FileText}
                    trend={null}
                    spark={hourlyPdfBuckets}
                    onClick={() => onNavigate("quotes")}
                />
                <KpiTile
                    label="Bugün Gelen"
                    value={metrics?.daily_total ?? 0}
                    icon={MessageSquare}
                    trend={generalTrend}
                    spark={hourlyWaBuckets}
                    onClick={() => onNavigate("quotes")}
                />
            </div>

            {/* Yeni temassızlar üstte görünür; eski kayıtların tamamı Teklifler
                sekmesinde ve KPI toplamında korunur. */}
            {worklist.length > 0 && (
                <div className="nx-hero-card" data-testid="dashboard-worklist">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-[var(--nx-text)]">En Yeni Temassız Teklifler</h3>
                            <p className="mt-1 text-[11px] text-[var(--nx-text-soft)]">
                                {uncontacted.length} toplam temassız
                                {dueFollowUps.length > 0 && ` · bugün ${dueFollowUps.length} takip`}
                            </p>
                        </div>
                        <button
                            onClick={() => onNavigate("quotes")}
                            className="inline-flex items-center gap-1 rounded-full border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.10)] px-3 py-1.5 text-[11px] text-[var(--nx-gold)] transition-colors hover:bg-[rgba(201,168,76,0.18)]"
                        >
                            Tümü <ArrowRight className="h-3 w-3" />
                        </button>
                    </div>

                    <ul className="mt-3 space-y-2">
                        {worklist.map((q) => {
                            const bekleme = olcumAni ? saatFarki(q.created_at, new Date(olcumAni)) : null;
                            const g = sureGosterimi(bekleme);
                            return (
                                <li key={q.id}>
                                    <button
                                        onClick={() => onNavigate("quotes")}
                                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[rgba(72,65,52,0.2)] bg-[rgba(26,24,22,0.6)] p-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-[var(--nx-text)]">
                                                {q.customer_name}
                                            </span>
                                            <span className="mt-0.5 block truncate text-[11px] text-[var(--nx-text-soft)]">
                                                {q.brand_name || "Markasız"} · {q.area_m2} m² · {formatCurrency(q.total_price ?? 0)}
                                            </span>
                                        </span>
                                        {g && (
                                            <span className={`shrink-0 text-[11px] font-medium ${SIDDET_RENGI[g.siddet]}`}>
                                                {bekleyisSuresi(g.saat)} bekliyor
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Row 2: hero chart + gauges */}
            <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                <div className="nx-hero-card">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-soft)]">Talep Akışı</p>
                            <h3 className="mt-1 text-lg font-semibold text-[var(--nx-text)]">Son 24 Saat</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-full text-[11px] bg-[rgba(201,168,76,0.10)] border border-[rgba(201,168,76,0.25)] text-[var(--nx-gold)]">
                                Bu Hafta · {metrics?.week_count ?? 0}
                            </span>
                            <span className="px-3 py-1.5 rounded-full text-[11px] bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.20)] text-purple-300">
                                Bu Ay · {metrics?.month_count ?? 0}
                            </span>
                        </div>
                    </div>
                    {/* Audit B6: sekme geçişlerinde konsola
                        "width(-1) and height(-1)" uyarısı düşüyordu — kapsayıcı
                        henüz düzen almadan ölçülüyordu. minWidth/minHeight=0
                        ölçümü negatif değerden korur. */}
                    {/* Audit B6: ResponsiveContainer ölçüm yapılana kadar
                        width/height'i -1 tutuyor ve her sekme geçişinde konsola
                        uyarı düşüyordu. initialDimension ilk render'a geçerli
                        bir boyut verir; ResizeObserver sonrası gerçek ölçüye
                        geçer. */}
                    <div style={{ width: "100%", height: 220, minWidth: 0 }}>
                        <ResponsiveContainer initialDimension={{ width: 640, height: 220 }}>
                            <AreaChart data={areaChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="nx-area-grad" x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="0%" stopColor="#c9a84c" stopOpacity={0.45} />
                                        <stop offset="100%" stopColor="#c9a84c" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(72,65,52,0.18)" vertical={false} />
                                <XAxis
                                    dataKey="hour"
                                    tick={{ fill: "#8c8880", fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={3}
                                />
                                <YAxis
                                    tick={{ fill: "#8c8880", fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={28}
                                    allowDecimals={false}
                                />
                                <RechartsTooltip
                                    contentStyle={{
                                        background: "#1a1a1a",
                                        border: "1px solid rgba(201,168,76,0.25)",
                                        borderRadius: 8,
                                        fontSize: 11,
                                    }}
                                    labelStyle={{ color: "#8c8880" }}
                                    itemStyle={{ color: "#c9a84c" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#c9a84c"
                                    strokeWidth={2}
                                    fill="url(#nx-area-grad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="nx-hero-card">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-soft)]">Dönüşüm Oranı</p>
                    <div className="mt-3 flex justify-center">
                        <Gauge percent={conversionRate} label="Onaylanan" />
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[var(--nx-text-soft)]">
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--nx-green)]" />
                            {dashboardQuoteSummary.approved} onay
                        </span>
                        <span className="text-[var(--nx-text-muted)]">·</span>
                        <span>{dashboardQuoteSummary.total} toplam</span>
                    </div>
                </div>
            </div>

            {/* Row 3: 3-col hero cards */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Son Talep Akışı */}
                <div className="nx-hero-card">
                    <div className="flex items-center justify-between mb-3">
                        {/* Audit G4: bu etiket 24 saatlik grafikte de aynıydı;
                            aynı ekranda iki "Talep Akışı" başlığı vardı. */}
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-soft)]">Son Talepler</p>
                            <h3 className="mt-1 text-base font-semibold text-[var(--nx-text)]">Gelen Kayıtlar</h3>
                        </div>
                        <button
                            onClick={() => onNavigate("quotes")}
                            className="text-[11px] px-3 py-1.5 rounded-full bg-[rgba(201,168,76,0.10)] border border-[rgba(201,168,76,0.25)] text-[var(--nx-gold)] hover:bg-[rgba(201,168,76,0.18)] transition-colors"
                        >
                            Tümü
                        </button>
                    </div>
                    <div className="space-y-2.5">
                        {recentQuotes.length > 0 ? recentQuotes.map((q) => (
                            <div key={q.id} className="p-3 rounded-xl bg-[rgba(26,24,22,0.6)] border border-[rgba(72,65,52,0.2)]">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-[var(--nx-text)] truncate">{q.customer_name}</p>
                                        <p className="mt-0.5 text-[11px] text-[var(--nx-text-soft)] truncate">
                                            {q.brand_name || "Markasız"} · {q.area_m2} m²
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--nx-gold)]">
                                            {dashboardQuoteChannelLabel(q.request_type)}
                                        </p>
                                        <p className="text-[11px] text-[var(--nx-text-soft)]">{formatCurrency(q.total_price ?? 0)}</p>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-[var(--nx-text-soft)] p-3">Henüz teklif yok.</p>
                        )}
                    </div>
                </div>

                {/* Malzeme Dağılımı */}
                <div className="nx-hero-card">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-soft)]">Malzeme Dağılımı <span className="text-[var(--nx-text-muted)]">(30g)</span></p>
                    <div className="mt-3">
                        {metrics && (metrics.eps_ratio_30d > 0 || metrics.rockwool_ratio_30d > 0) ? (
                            <>
                                <div className="flex justify-center">
                                    <ResponsiveContainer width={160} height={160} initialDimension={{ width: 160, height: 160 }}>
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: "EPS", value: metrics.eps_ratio_30d },
                                                    { name: "Taşyünü", value: metrics.rockwool_ratio_30d },
                                                ]}
                                                cx="50%" cy="50%"
                                                innerRadius={48} outerRadius={70}
                                                dataKey="value"
                                                paddingAngle={3}
                                            >
                                                <Cell fill="#c9a84c" />
                                                <Cell fill="#b87333" />
                                            </Pie>
                                            <RechartsTooltip
                                                formatter={(v) => [`%${v}`, ""]}
                                                contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 8, fontSize: 11 }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-3 space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-[var(--nx-gold)]" />
                                            <span className="text-[var(--nx-text)]">EPS</span>
                                        </span>
                                        <span className="text-[var(--nx-text-soft)]">
                                            {metrics.eps_count_30d} · {formatM2(metrics.eps_area_m2_30d ?? 0)} · {formatAmount(metrics.eps_amount_30d ?? 0)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-[var(--nx-copper)]" />
                                            <span className="text-[var(--nx-text)]">Taşyünü</span>
                                        </span>
                                        <span className="text-[var(--nx-text-soft)]">
                                            {metrics.rockwool_count_30d} · {formatM2(metrics.rockwool_area_m2_30d ?? 0)} · {formatAmount(metrics.rockwool_amount_30d ?? 0)}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-[var(--nx-text-soft)] p-3">Son 30 günde veri yok.</p>
                        )}
                    </div>
                </div>

                {/* Anlık Aktivite */}
                <div className="nx-hero-card">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-soft)]">Anlık Aktivite</p>
                    <div className="mt-3 flex items-start justify-between">
                        <div>
                            <p className="text-[11px] text-[var(--nx-text-muted)]">Son 2 saat</p>
                            <p className="mt-1 text-3xl font-semibold text-[var(--nx-text)]">{metrics?.recent_2h ?? 0}</p>
                            <p className="mt-0.5 text-[11px] text-[var(--nx-text-soft)]">teklif</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {velocityDir === "up" && <TrendingUp className="h-5 w-5 text-[var(--nx-green)]" />}
                            {velocityDir === "down" && <TrendingDown className="h-5 w-5 text-[var(--nx-red)]" />}
                            {velocityDir === "flat" && <span className="h-0.5 w-4 bg-[var(--nx-amber)] rounded-full mt-2.5" />}
                            <span className={`text-xs font-semibold ${
                                velocityDir === "up" ? "text-[var(--nx-green)]" :
                                velocityDir === "down" ? "text-[var(--nx-red)]" : "text-[var(--nx-amber)]"
                            }`}>
                                {velocityDir === "up" ? "+" : ""}{velocityPct}%
                            </span>
                        </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[rgba(72,65,52,0.2)] flex items-center justify-between text-xs text-[var(--nx-text-soft)]">
                        <span>Önceki 2 saat</span>
                        <span className="font-medium text-[var(--nx-text)]">{metrics?.prev_2h ?? 0} teklif</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[rgba(72,65,52,0.2)]">
                        <p className="text-[11px] text-[var(--nx-text-muted)]">Bugün Ort. Fiyat / m²</p>
                        <p className="mt-1 text-xl font-semibold text-[var(--nx-text)]">
                            {metrics?.avg_price_per_m2_today != null
                                ? `₺${metrics.avg_price_per_m2_today.toLocaleString("tr-TR")}`
                                : "—"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Row 4: Ürün Kırılımı (marka sıralamaları Analiz sekmesinde —
                buradaki kopyaları audit ile kaldırıldı) */}
            <div className="nx-hero-card">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-soft)]">Ürün Kırılımı <span className="text-[var(--nx-text-muted)]">(7g)</span></p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(metrics?.product_breakdown_7d ?? []).length > 0 ? (metrics?.product_breakdown_7d ?? []).slice(0, 6).map((item) => (
                            <div key={`${item.brand}-${item.model}-${item.material}`} className="flex items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold ${item.material === "eps" ? "bg-[rgba(201,168,76,0.10)] text-[var(--nx-gold)] border border-[rgba(201,168,76,0.25)]" : "bg-[rgba(184,115,51,0.10)] text-[var(--nx-copper)] border border-[rgba(184,115,51,0.25)]"}`}>
                                        {item.material === "eps" ? "E" : "T"}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-[var(--nx-text)] truncate">{item.brand}</p>
                                        <p className="text-[10px] text-[var(--nx-text-soft)] truncate">{item.model}</p>
                                    </div>
                                </div>
                                <span className="flex-shrink-0 text-sm font-semibold text-[var(--nx-text)]">{item.count}</span>
                            </div>
                        )) : (
                            <p className="text-sm text-[var(--nx-text-soft)]">Son 7 günde ürün verisi yok.</p>
                        )}
                </div>
            </div>
        </div>
    );
}

"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle, HelpCircle, XCircle, Info, Plus, GitBranch } from "lucide-react";
import type {
    ImportPreviewRow,
    ImportSummary,
    MatchStatus,
    ImportSeverity,
} from "@/lib/importTypes";

// ==========================================
// HELPERS
// ==========================================

const STATUS_CONFIG: Record<MatchStatus, { label: string; badgeClass: string }> = {
    matched:         { label: 'Eşleşti',       badgeClass: 'bg-green-500/15  text-green-400  border-green-500/30'  },
    new_product:     { label: 'Yeni Ürün',      badgeClass: 'bg-orange-500/15   text-orange-400   border-orange-500/30'   },
    variant_missing: { label: 'Varyant Eksik',  badgeClass: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    ambiguous:       { label: 'Belirsiz',       badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    unmatched:       { label: 'Eşleşmedi',      badgeClass: 'bg-red-500/15    text-red-400    border-red-500/30'    },
};

const SEVERITY_ICON: Record<ImportSeverity, ReactNode> = {
    info:    <Info          className="w-3.5 h-3.5 text-orange-400   flex-shrink-0" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />,
    error:   <XCircle       className="w-3.5 h-3.5 text-red-400    flex-shrink-0" />,
};

function formatPrice(price: number): string {
    return price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function StatusBadge({ status }: { status: MatchStatus }) {
    const cfg = STATUS_CONFIG[status];
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cfg.badgeClass}`}>
            {cfg.label}
        </span>
    );
}

function SummaryCard({
    label,
    value,
    colorClass,
    icon,
}: {
    label: string;
    value: number;
    colorClass: string;
    icon?: ReactNode;
}) {
    return (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold tabular-nums ${colorClass}`}>{value}</span>
                {icon && <span className="opacity-60">{icon}</span>}
            </div>
            <span className="text-xs text-slate-400 leading-tight">{label}</span>
        </div>
    );
}

// ==========================================
// LOADING / EMPTY STATES
// ==========================================

function LoadingState() {
    return (
        <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800/50 p-16 flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Import analizi çalışıyor...</p>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800/50 p-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-[var(--nx-text-muted)]" />
            </div>
            <p className="text-slate-400 text-sm">Henüz dosya yüklenmedi.</p>
            <p className="text-[var(--nx-text-muted)] text-xs max-w-xs">
                Dosya yüklenip analiz edildikten sonra eşleşme sonuçları ve uyarılar burada görünecek.
            </p>
        </div>
    );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

interface ImportPreviewProps {
    summary: ImportSummary | null;
    rows: ImportPreviewRow[];
    isLoading?: boolean;
}

export function ImportPreview({ summary, rows, isLoading = false }: ImportPreviewProps) {
    if (isLoading) return <LoadingState />;
    if (!summary && rows.length === 0) return <EmptyState />;

    const allWarnings    = rows.flatMap(r => r.debug.warnings);
    const reviewRows     = rows.filter(r => r.match?.requiresReview);
    const newProductRows = rows.filter(r => r.match?.status === 'new_product');

    return (
        <div className="space-y-6">

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    <SummaryCard
                        label="Toplam Satır"
                        value={summary.totalRows}
                        colorClass="text-slate-200"
                        icon={<Info className="w-4 h-4 text-[var(--nx-text-muted)]" />}
                    />
                    <SummaryCard
                        label="Eşleşti"
                        value={summary.matchedCount}
                        colorClass="text-green-400"
                        icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                    />
                    <SummaryCard
                        label="Yeni Ürün"
                        value={summary.newProductCount}
                        colorClass="text-orange-400"
                        icon={<Plus className="w-4 h-4 text-orange-500" />}
                    />
                    <SummaryCard
                        label="Varyant Eksik"
                        value={summary.variantMissingCount}
                        colorClass="text-yellow-400"
                        icon={<GitBranch className="w-4 h-4 text-yellow-500" />}
                    />
                    <SummaryCard
                        label="Belirsiz"
                        value={summary.ambiguousCount}
                        colorClass="text-orange-400"
                        icon={<HelpCircle className="w-4 h-4 text-orange-500" />}
                    />
                    <SummaryCard
                        label="Eşleşmedi"
                        value={summary.unmatchedCount}
                        colorClass="text-red-400"
                        icon={<XCircle className="w-4 h-4 text-red-500" />}
                    />
                    <SummaryCard
                        label="Uyarı"
                        value={summary.warningCount}
                        colorClass="text-yellow-300"
                        icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />}
                    />
                    <SummaryCard
                        label="İnceleme Gerek"
                        value={summary.requiresReviewCount}
                        colorClass="text-purple-400"
                        icon={<AlertTriangle className="w-4 h-4 text-purple-500" />}
                    />
                </div>
            )}

            {/* Yeni ürün uyarısı — kritik */}
            {newProductRows.length > 0 && (
                <div className="bg-blue-950/40 border border-orange-500/50 rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                        <Plus className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-blue-300 font-semibold text-sm">
                                {newProductRows.length} yeni ürün DB&apos;de bulunamadı — apply edilmez
                            </p>
                            <p className="text-orange-400/70 text-xs mt-1">
                                Bu ürünler <strong className="text-blue-300">plates</strong> veya <strong className="text-blue-300">accessories</strong> tablosunda mevcut değil.
                                Önce Admin → Ürün tablosuna manuel ekleyin, ardından bu Excel dosyasını tekrar import edin.
                            </p>
                        </div>
                    </div>
                    <div className="divide-y divide-blue-900/40 rounded-lg overflow-hidden border border-blue-800/30">
                        {newProductRows.map((row) => (
                            <div key={row.raw.rowIndex} className="px-3 py-2 bg-blue-950/30 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs text-blue-200 font-medium truncate">
                                        {row.raw.rawProductName}
                                    </span>
                                    {row.debug.thicknessCm !== null && (
                                        <span className="text-[10px] text-orange-400/60 flex-shrink-0">
                                            {row.debug.thicknessCm} cm
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 text-[11px] text-orange-400/60">
                                    <span>{row.debug.productType === 'plate' ? 'Levha' : row.debug.productType === 'accessory' ? 'Aksesuar' : '?'}</span>
                                    <span>{row.debug.materialType === 'eps' ? 'EPS' : row.debug.materialType === 'tasyunu' ? 'Taşyünü' : '?'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Büyük fiyat değişimi uyarısı */}
            {reviewRows.length > 0 && (
                <div className="bg-purple-950/40 border border-purple-500/40 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-purple-300 font-semibold text-sm">
                            {reviewRows.length} satırda %30&apos;dan fazla fiyat değişimi var
                        </p>
                        <p className="text-purple-400/70 text-xs mt-1">
                            Uygulamadan önce bu satırları manuel incelemeniz önerilir.
                        </p>
                    </div>
                </div>
            )}

            {/* Satır Tablosu */}
            {rows.length > 0 && (
                <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800/50 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Satır Önizleme</h3>
                        <span className="text-xs text-[var(--nx-text-muted)]">{rows.length} satır</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-slate-800/50 bg-slate-800/30">
                                    <th className="text-left px-4 py-3 text-slate-400 font-medium w-8">#</th>
                                    <th className="text-left px-4 py-3 text-slate-400 font-medium min-w-[180px]">Ürün Adı</th>
                                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Tip</th>
                                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Malzeme</th>
                                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Ham Fiyat</th>
                                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Net Fiyat</th>
                                    <th className="text-center px-4 py-3 text-slate-400 font-medium">KDV</th>
                                    <th className="text-center px-4 py-3 text-slate-400 font-medium">Kalınlık</th>
                                    <th className="text-center px-4 py-3 text-slate-400 font-medium">Durum</th>
                                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Δ Fiyat</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-800/40">
                                {rows.map((row) => {
                                    const { debug, match } = row;
                                    const hasWarnings  = debug.warnings.length > 0;
                                    const isReview     = match?.requiresReview;
                                    const isNewProduct = match?.status === 'new_product';

                                    return (
                                        <tr
                                            key={row.raw.rowIndex}
                                            className={`transition-colors ${
                                                isReview
                                                    ? 'bg-purple-950/20 hover:bg-purple-950/30'
                                                    : isNewProduct
                                                    ? 'bg-blue-950/20 hover:bg-blue-950/30'
                                                    : 'hover:bg-slate-800/20'
                                            }`}
                                        >
                                            {/* # */}
                                            <td className="px-4 py-3 text-[var(--nx-text-muted)] tabular-nums">
                                                {row.raw.rowIndex + 1}
                                            </td>

                                            {/* Ürün Adı */}
                                            <td className="px-4 py-3 text-slate-200 max-w-[220px]">
                                                <div className="space-y-1">
                                                    <span
                                                        className="flex items-center gap-1.5 truncate"
                                                        title={row.raw.rawProductName}
                                                    >
                                                        {hasWarnings && (
                                                            <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                                                        )}
                                                        {row.raw.rawProductName}
                                                    </span>
                                                    <div className="text-[10px] leading-tight text-[var(--nx-text-muted)]">
                                                        <div>class: {debug.productClass}</div>
                                                        <div>family: {debug.familyCanonical ?? '—'}</div>
                                                        <div>variant: {debug.variantCanonical ?? '—'}</div>
                                                        <div>size: {debug.measurement?.sizeToken ?? '—'}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Tip */}
                                            <td className="px-4 py-3">
                                                <span className={
                                                    debug.productType === 'plate'     ? 'text-orange-400' :
                                                    debug.productType === 'accessory' ? 'text-green-400' :
                                                    'text-[var(--nx-text-muted)] italic'
                                                }>
                                                    {debug.productType === 'plate'     ? 'Levha'    :
                                                     debug.productType === 'accessory' ? 'Aksesuar' : '?'}
                                                </span>
                                            </td>

                                            {/* Malzeme */}
                                            <td className="px-4 py-3">
                                                <span className={
                                                    debug.materialType === 'eps'     ? 'text-orange-400' :
                                                    debug.materialType === 'tasyunu' ? 'text-amber-400'   :
                                                    'text-[var(--nx-text-muted)] italic'
                                                }>
                                                    {debug.materialType === 'eps'     ? 'EPS'      :
                                                     debug.materialType === 'tasyunu' ? 'Taşyünü'  : '?'}
                                                </span>
                                            </td>

                                            {/* Ham Fiyat */}
                                            <td className="px-4 py-3 text-right text-[var(--nx-text-muted)] tabular-nums">
                                                {formatPrice(debug.base_price_raw)}
                                            </td>

                                            {/* Net Fiyat */}
                                            <td className="px-4 py-3 text-right text-slate-100 tabular-nums font-medium">
                                                {formatPrice(debug.base_price_net)}
                                            </td>

                                            {/* KDV */}
                                            <td className="px-4 py-3 text-center">
                                                <span className={
                                                    row.raw.rawKdvHint === 'kdv_dahil' ? 'text-amber-400' :
                                                    row.raw.rawKdvHint === 'kdv_haric' ? 'text-slate-400' :
                                                    'text-[var(--nx-text-muted)] italic'
                                                }>
                                                    {row.raw.rawKdvHint === 'kdv_dahil' ? 'Dahil' :
                                                     row.raw.rawKdvHint === 'kdv_haric' ? 'Hariç' : '?'}
                                                </span>
                                            </td>

                                            {/* Kalınlık */}
                                            <td className="px-4 py-3 text-center text-slate-400 tabular-nums">
                                                {debug.thicknessCm !== null
                                                    ? `${debug.thicknessCm} cm`
                                                    : <span className="text-[var(--nx-text-muted)]">—</span>
                                                }
                                            </td>

                                            {/* Durum */}
                                            <td className="px-4 py-3 text-center">
                                                {match
                                                    ? <StatusBadge status={match.status} />
                                                    : <span className="text-[var(--nx-text-muted)]">—</span>
                                                }
                                            </td>

                                            {/* Δ Fiyat */}
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {match?.priceChangePct !== undefined ? (
                                                    <span className={
                                                        Math.abs(match.priceChangePct) > 30 ? 'text-purple-400 font-bold' :
                                                        match.priceChangePct > 0            ? 'text-green-400'            :
                                                        match.priceChangePct < 0            ? 'text-red-400'              :
                                                        'text-[var(--nx-text-muted)]'
                                                    }>
                                                        {match.priceChangePct > 0 ? '+' : ''}
                                                        {match.priceChangePct.toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--nx-text-muted)]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Uyarı Listesi */}
            {allWarnings.length > 0 && (
                <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800/50 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">
                            Uyarılar
                        </h3>
                        <span className="text-xs text-[var(--nx-text-muted)]">{allWarnings.length} uyarı</span>
                    </div>

                    <div className="divide-y divide-slate-800/40 max-h-72 overflow-y-auto">
                        {allWarnings.map((w, idx) => (
                            <div key={idx} className="px-4 py-3 flex items-start gap-3">
                                {SEVERITY_ICON[w.severity]}
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    {w.rowIndex !== undefined && (
                                        <span className="text-[var(--nx-text-muted)] mr-1.5">Satır {w.rowIndex + 1} —</span>
                                    )}
                                    {w.message}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

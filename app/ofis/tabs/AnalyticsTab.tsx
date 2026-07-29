"use client";

import { formatAmount, formatM2 } from "@/lib/admin/utils";
import { useCombinationMetrics } from "@/lib/hooks/useAdminMetrics";
import { composePlateLabel } from "@/lib/catalog/productLabel";

// ── Görüntüleme düzeltmeleri (audit B7 + "Optimix Optimix" tekrarı) ──
//
// 1) `accessory_brand_name = '-'`: katalog (PDP) tek-ürün tekliflerinde toz
//    grubu seçilmez. apiQuoteSchema `accessoryBrandName`i zorunlu tuttuğu için
//    (min(1)) boş yazılamıyor, yerine tire konuyor. Yani '-' bir MARKA DEĞİL,
//    "toz grubu yok" demek. Sıralamada 2. marka gibi görünmesi yanıltıcıydı;
//    artık etiketleniyor ve listenin sonuna alınıyor.
//
// 2) Model tekrarı: RPC bazı satırlarda `plate_brand`i zaten "marka + model"
//    olarak döndürüyor (ör. plate_brand="Bonus F 150 Pro", model="F 150 Pro").
//    Arayüz modeli koşulsuz eklediği için "Bonus F 150 Pro F 150 Pro" çıkıyordu.
//    Optimix'te iki kat kötüydü, çünkü model adının kendisi markayla başlıyor
//    (brand="Optimix", model="Optimix Karbonlu").
//    RPC tanımı repoda olmadığı için düzeltme arayüzde yapılıyor.

const NO_POWDER = "-";

function powderLabel(brand: string): string {
    return brand === NO_POWDER ? "Toz grubu yok" : brand;
}

/** Toz grubu olmayan satırı en sona al — sıralama "marka" gibi okunmasın. */
function sortPowderBrands<T extends { brand: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => {
        if (a.brand === NO_POWDER) return 1;
        if (b.brand === NO_POWDER) return -1;
        return 0;
    });
}

// Birleştirme kuralı lib/catalog/productLabel.ts'te — PDF ve teklif
// kalemleriyle aynı kaynak, böylece iki yüzey ayrışmaz.
const plateLabel = composePlateLabel;

export function AnalyticsTab() {
    const { metrics, isLoading: loading, isError: error } = useCombinationMetrics();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="space-y-3 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mx-auto" />
                    <p className="text-sm text-[var(--nx-text-muted)]">Analiz verileri yükleniyor…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="admin-nexus-panel p-8 text-center">
                <p className="text-sm text-slate-400">Analitik veriler alınamadı.</p>
                <p className="mt-1 text-xs text-[var(--nx-text-muted)]">RPC bağlantısını kontrol et.</p>
            </div>
        );
    }

    const epsCombos = (metrics?.top_cross_combinations_7d ?? []).filter(i => i.material === 'eps');
    const rockwoolCombos = (metrics?.top_cross_combinations_7d ?? []).filter(i => i.material === 'tasyunu');

    return (
        <div className="space-y-8">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/80">Talep Analizi</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-50">Marka & Kombinasyon Analizi</h2>
                <p className="mt-1 text-sm text-slate-400">Son 7 günlük teklif verisinden türetilmiştir.</p>
            </div>

            {/* Bölüm 1: Marka Sıralamaları — 3 tablo */}
            <div className="grid gap-6 xl:grid-cols-3">
                {/* EPS Markaları */}
                <div className="admin-nexus-panel p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-muted)]">EPS Markaları <span className="text-[var(--nx-text-muted)]">(7g)</span></p>
                    </div>
                    {(metrics?.eps_brands_7d ?? []).length > 0 ? (
                        <div>
                            <div className="grid grid-cols-[1.5rem_1fr_2.5rem_4rem_4rem] gap-x-2 px-1 pb-1.5 border-b border-slate-800">
                                <span className="text-[9px] uppercase text-slate-700">#</span>
                                <span className="text-[9px] uppercase text-slate-700">Marka</span>
                                <span className="text-[9px] uppercase text-slate-700 text-right">Teklif</span>
                                <span className="text-[9px] uppercase text-slate-700 text-right">m²</span>
                                <span className="text-[9px] uppercase text-slate-700 text-right">Tutar</span>
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {metrics!.eps_brands_7d.map((item, i) => (
                                    <div key={item.brand} className="grid grid-cols-[1.5rem_1fr_2.5rem_4rem_4rem] gap-x-2 px-1 py-1.5 rounded hover:bg-slate-800/40 transition-colors">
                                        <span className="text-[10px] text-[var(--nx-text-muted)]">{i + 1}</span>
                                        <span className="text-xs text-slate-200 font-medium truncate">{item.brand}</span>
                                        <span className="text-xs text-slate-300 text-right">{item.count}</span>
                                        <span className="text-[11px] text-amber-400/80 text-right">{formatM2(item.area_m2 ?? 0)}</span>
                                        <span className="text-[11px] text-amber-400/80 text-right">{formatAmount(item.amount ?? 0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-[var(--nx-text-muted)]">Son 7 günde EPS talebi yok.</p>
                    )}
                </div>

                {/* Taşyünü Markaları */}
                <div className="admin-nexus-panel p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-muted)]">Taşyünü Markaları <span className="text-[var(--nx-text-muted)]">(7g)</span></p>
                    </div>
                    {(metrics?.rockwool_brands_7d ?? []).length > 0 ? (
                        <div>
                            <div className="grid grid-cols-[1.5rem_1fr_2.5rem_4rem_4rem] gap-x-2 px-1 pb-1.5 border-b border-slate-800">
                                <span className="text-[9px] uppercase text-slate-700">#</span>
                                <span className="text-[9px] uppercase text-slate-700">Marka</span>
                                <span className="text-[9px] uppercase text-slate-700 text-right">Teklif</span>
                                <span className="text-[9px] uppercase text-slate-700 text-right">m²</span>
                                <span className="text-[9px] uppercase text-slate-700 text-right">Tutar</span>
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {metrics!.rockwool_brands_7d.map((item, i) => (
                                    <div key={item.brand} className="grid grid-cols-[1.5rem_1fr_2.5rem_4rem_4rem] gap-x-2 px-1 py-1.5 rounded hover:bg-slate-800/40 transition-colors">
                                        <span className="text-[10px] text-[var(--nx-text-muted)]">{i + 1}</span>
                                        <span className="text-xs text-slate-200 font-medium truncate">{item.brand}</span>
                                        <span className="text-xs text-slate-300 text-right">{item.count}</span>
                                        <span className="text-[11px] text-amber-400/80 text-right">{formatM2(item.area_m2 ?? 0)}</span>
                                        <span className="text-[11px] text-amber-400/80 text-right">{formatAmount(item.amount ?? 0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-[var(--nx-text-muted)]">Son 7 günde Taşyünü talebi yok.</p>
                    )}
                </div>

                {/* Toz Grubu Markaları */}
                <div className="admin-nexus-panel p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-muted)]">Toz Grubu Markaları <span className="text-[var(--nx-text-muted)]">(7g)</span></p>
                    </div>
                    {(metrics?.powder_brands_7d ?? []).length > 0 ? (
                        <div>
                            <div className="grid grid-cols-[1.5rem_1fr_2.5rem_4rem_4rem] gap-x-2 px-1 pb-1.5 border-b border-slate-800">
                                <span className="text-[9px] uppercase text-slate-700">#</span>
                                <span className="text-[9px] uppercase text-slate-700">Marka</span>
                                <span className="text-[9px] uppercase text-slate-700 text-right">Teklif</span>
                                <span className="text-[9px] uppercase text-slate-700 text-right">m²</span>
                                <span className="text-[9px] uppercase text-slate-700 text-right">Tutar</span>
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {sortPowderBrands(metrics!.powder_brands_7d).map((item, i) => (
                                    <div key={item.brand} className="grid grid-cols-[1.5rem_1fr_2.5rem_4rem_4rem] gap-x-2 px-1 py-1.5 rounded hover:bg-slate-800/40 transition-colors">
                                        <span className="text-[10px] text-[var(--nx-text-muted)]">{item.brand === NO_POWDER ? "—" : i + 1}</span>
                                        <span
                                            className={`text-xs truncate ${item.brand === NO_POWDER ? "italic text-[var(--nx-text-muted)]" : "text-slate-200 font-medium"}`}
                                            title={item.brand === NO_POWDER ? "Katalogdan tek ürün teklifi — toz grubu seçilmez" : undefined}
                                        >
                                            {powderLabel(item.brand)}
                                        </span>
                                        <span className="text-xs text-slate-300 text-right">{item.count}</span>
                                        <span className="text-[11px] text-amber-400/80 text-right">{formatM2(item.area_m2 ?? 0)}</span>
                                        <span className="text-[11px] text-amber-400/80 text-right">{formatAmount(item.amount ?? 0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-[var(--nx-text-muted)]">Son 7 günde toz grubu verisi yok.</p>
                    )}
                </div>
            </div>

            {/* Bölüm 2 & 3: Kombinasyon Setleri */}
            <div className="grid gap-6 xl:grid-cols-2">
                {/* EPS Kombinasyonları */}
                <div className="admin-nexus-panel p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">E</span>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-muted)]">EPS Kombinasyonları <span className="text-[var(--nx-text-muted)]">(7g)</span></p>
                    </div>
                    <div className="space-y-2">
                        {epsCombos.length > 0 ? epsCombos.map((item, index) => (
                            <div key={`${item.plate_brand}-${item.model}-${item.powder_brand}`} className="admin-nexus-subtle px-3 py-2.5">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-[10px] text-[var(--nx-text-muted)] w-4 flex-shrink-0">#{index + 1}</span>
                                        <p className="text-xs text-slate-200 truncate">
                                            <span className="font-medium">{plateLabel(item.plate_brand, item.model)}</span>
                                            <span className="mx-1.5 text-[var(--nx-text-muted)]">×</span>
                                            <span className={item.powder_brand === NO_POWDER ? "italic text-[var(--nx-text-muted)]" : "text-amber-300/80"}>
                                                {powderLabel(item.powder_brand)}
                                            </span>
                                        </p>
                                    </div>
                                    <span className="flex-shrink-0 text-sm font-semibold text-slate-50">{item.count}</span>
                                </div>
                                <div className="mt-1 ml-6 flex gap-2 text-[11px]">
                                    <span className="text-amber-400/80">{formatM2(item.area_m2 ?? 0)}</span>
                                    <span className="text-slate-700">·</span>
                                    <span className="text-amber-400/80">{formatAmount(item.amount ?? 0)}</span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-[var(--nx-text-muted)]">Son 7 günde EPS kombinasyonu yok.</p>
                        )}
                    </div>
                </div>

                {/* Taşyünü Kombinasyonları */}
                <div className="admin-nexus-panel p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">T</span>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--nx-text-muted)]">Taşyünü Kombinasyonları <span className="text-[var(--nx-text-muted)]">(7g)</span></p>
                    </div>
                    <div className="space-y-2">
                        {rockwoolCombos.length > 0 ? rockwoolCombos.map((item, index) => (
                            <div key={`${item.plate_brand}-${item.model}-${item.powder_brand}`} className="admin-nexus-subtle px-3 py-2.5">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-[10px] text-[var(--nx-text-muted)] w-4 flex-shrink-0">#{index + 1}</span>
                                        <p className="text-xs text-slate-200 truncate">
                                            <span className="font-medium">{plateLabel(item.plate_brand, item.model)}</span>
                                            <span className="mx-1.5 text-[var(--nx-text-muted)]">×</span>
                                            <span className={item.powder_brand === NO_POWDER ? "italic text-[var(--nx-text-muted)]" : "text-purple-300/80"}>
                                                {powderLabel(item.powder_brand)}
                                            </span>
                                        </p>
                                    </div>
                                    <span className="flex-shrink-0 text-sm font-semibold text-slate-50">{item.count}</span>
                                </div>
                                <div className="mt-1 ml-6 flex gap-2 text-[11px]">
                                    <span className="text-amber-400/80">{formatM2(item.area_m2 ?? 0)}</span>
                                    <span className="text-slate-700">·</span>
                                    <span className="text-amber-400/80">{formatAmount(item.amount ?? 0)}</span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-[var(--nx-text-muted)]">Son 7 günde Taşyünü kombinasyonu yok.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

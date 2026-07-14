"use client";

import { useState } from "react";

// ============================================================
// Satış Sonucu paneli (Sprint 3) — teklif detayında temas, takip,
// kazanıldı/kaybedildi ve brüt kâr girişi. v22 alanlarına admin
// PATCH ile yazar; completed = KAZANILDI, rejected = KAYBEDİLDİ.
// Bu alanlar yalnız admin yüzeyindedir (ölçüm sözleşmesi).
// ============================================================

export const LOSS_CATEGORY_LABELS: Record<string, string> = {
    fiyat: "Fiyat",
    stok_termin: "Stok / Termin",
    vade_odeme: "Vade / Ödeme",
    ulasilamadi: "Ulaşılamadı",
    rakip: "Rakip tercih edildi",
    vazgecti: "Vazgeçti",
    diger: "Diğer",
};

export interface SalesOutcomeQuote {
    id: number | string;
    status?: string | null;
    created_at: string;
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
}

interface SalesOutcomePanelProps {
    quote: SalesOutcomeQuote;
    controlClass: string;
    onSaved: () => void;
}

export default function SalesOutcomePanel({ quote, controlClass, onSaved }: SalesOutcomePanelProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [followUpDate, setFollowUpDate] = useState(quote.follow_up_date?.slice(0, 10) ?? "");
    const [quotedBy, setQuotedBy] = useState(quote.quoted_by ?? "");
    const [salesFinalPrice, setSalesFinalPrice] = useState(
        quote.sales_final_price != null ? String(quote.sales_final_price) : "",
    );
    const [adminNotes, setAdminNotes] = useState(quote.admin_notes ?? "");
    const [grossProfit, setGrossProfit] = useState(
        quote.gross_profit != null ? String(quote.gross_profit) : "",
    );
    const [lossCategory, setLossCategory] = useState(quote.loss_category ?? "");
    const [lossReason, setLossReason] = useState(quote.loss_reason ?? "");

    const isClosed = quote.status === "completed" || quote.status === "rejected";

    async function patch(payload: Record<string, unknown>): Promise<boolean> {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/quotes/${quote.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) {
                setError(json?.error ?? "Kaydedilemedi.");
                return false;
            }
            onSaved();
            return true;
        } catch {
            setError("Bağlantı hatası — tekrar deneyin.");
            return false;
        } finally {
            setSaving(false);
        }
    }

    const parseMoney = (v: string): number | null => {
        const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
        return Number.isFinite(n) && n > 0 ? n : null;
    };

    function handleContact(successful: boolean) {
        void patch({
            status: quote.status === "pending" ? "contacted" : undefined,
            contactAttemptedAt: new Date().toISOString(),
            contactSuccessful: successful,
        });
    }

    function handleSaveFields() {
        void patch({
            followUpDate: followUpDate || null,
            quotedBy: quotedBy.trim() || null,
            salesFinalPrice: salesFinalPrice ? parseMoney(salesFinalPrice) : null,
            adminNotes: adminNotes.trim() || null,
        });
    }

    function handleWon() {
        const profit = grossProfit ? parseMoney(grossProfit) : null;
        if (profit === null) {
            const proceed = window.confirm(
                "Brüt kâr girilmedi — ana satış metriği brüt kârdır. Yine de kazanıldı olarak kapatılsın mı?",
            );
            if (!proceed) return;
        }
        void patch({
            status: "completed",
            grossProfit: profit,
            salesFinalPrice: salesFinalPrice ? parseMoney(salesFinalPrice) : null,
        });
    }

    function handleLost() {
        if (!lossCategory) {
            setError("Kayıp nedeni kategorisi seçin — 'müşteri neden almadı?' sorusunun cevabı bu alanda birikir.");
            return;
        }
        void patch({
            status: "rejected",
            lossCategory,
            lossReason: lossReason.trim() || null,
        });
    }

    const firstContactHours = quote.contact_attempted_at
        ? Math.round(
              (new Date(quote.contact_attempted_at).getTime() - new Date(quote.created_at).getTime()) / 36e5,
          )
        : null;

    return (
        <div className="rounded-xl border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.05)] p-4" data-testid="sales-outcome-panel">
            <h4 className="mb-3 font-semibold text-[var(--nx-gold)]">Satış Sonucu</h4>

            {/* Temas durumu */}
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                {quote.contact_attempted_at ? (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                        Temas: {new Date(quote.contact_attempted_at).toLocaleString("tr-TR")}
                        {firstContactHours != null && ` (kayıttan ${firstContactHours} saat sonra)`}
                        {quote.contact_successful === false && " · ulaşılamadı"}
                    </span>
                ) : (
                    <>
                        <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs text-red-200">
                            Henüz temas kurulmadı
                        </span>
                        <button type="button" disabled={saving} onClick={() => handleContact(true)}
                            className={`${controlClass} px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/10`}>
                            Ulaştım
                        </button>
                        <button type="button" disabled={saving} onClick={() => handleContact(false)}
                            className={`${controlClass} px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/10`}>
                            Ulaşamadım
                        </button>
                    </>
                )}
            </div>

            {/* Takip + satış alanları */}
            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <label className="block">
                    <span className="text-xs text-slate-400">Takip tarihi</span>
                    <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
                        className={`${controlClass} mt-1 w-full px-3 py-2 text-sm [color-scheme:dark]`} />
                </label>
                <label className="block">
                    <span className="text-xs text-slate-400">İlgilenen kişi</span>
                    <input type="text" value={quotedBy} onChange={(e) => setQuotedBy(e.target.value)} placeholder="örn. Emrah"
                        className={`${controlClass} mt-1 w-full px-3 py-2 text-sm`} />
                </label>
                <label className="block">
                    <span className="text-xs text-slate-400">Satışçı nihai fiyatı (KDV hariç ₺)</span>
                    <input type="text" inputMode="decimal" value={salesFinalPrice} onChange={(e) => setSalesFinalPrice(e.target.value)}
                        className={`${controlClass} mt-1 w-full px-3 py-2 text-sm`} />
                </label>
                <label className="col-span-2 block">
                    <span className="text-xs text-slate-400">Satış notu</span>
                    <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2}
                        className={`${controlClass} mt-1 w-full px-3 py-2 text-sm`} />
                </label>
            </div>
            <button type="button" disabled={saving} onClick={handleSaveFields}
                className={`${controlClass} mb-5 px-4 py-2 text-xs font-semibold hover:bg-[rgba(255,255,255,0.06)]`}>
                {saving ? "Kaydediliyor…" : "Alanları kaydet"}
            </button>

            {/* Kapanış */}
            {isClosed ? (
                <div className="rounded-lg border border-[rgba(92,98,108,0.24)] bg-[rgba(255,255,255,0.03)] p-3 text-sm">
                    {quote.status === "completed" ? (
                        <p className="text-emerald-300">
                            ✓ Kazanıldı{quote.closed_at && ` · ${new Date(quote.closed_at).toLocaleDateString("tr-TR")}`}
                            {quote.gross_profit != null && ` · brüt kâr ${Number(quote.gross_profit).toLocaleString("tr-TR")} ₺`}
                        </p>
                    ) : (
                        <p className="text-red-300">
                            ✗ Kaybedildi{quote.closed_at && ` · ${new Date(quote.closed_at).toLocaleDateString("tr-TR")}`}
                            {quote.loss_category && ` · ${LOSS_CATEGORY_LABELS[quote.loss_category] ?? quote.loss_category}`}
                            {quote.loss_reason && ` — ${quote.loss_reason}`}
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-3">
                        <p className="mb-2 text-xs font-semibold text-emerald-300">KAZANILDI olarak kapat</p>
                        <label className="block">
                            <span className="text-xs text-slate-400">Brüt kâr (₺)</span>
                            <input type="text" inputMode="decimal" value={grossProfit} onChange={(e) => setGrossProfit(e.target.value)}
                                className={`${controlClass} mt-1 w-full px-3 py-2 text-sm`} />
                        </label>
                        <button type="button" disabled={saving} onClick={handleWon}
                            className="mt-2 w-full rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-emerald-400">
                            Kazanıldı ✓
                        </button>
                    </div>
                    <div className="rounded-lg border border-red-400/25 bg-red-400/5 p-3">
                        <p className="mb-2 text-xs font-semibold text-red-300">KAYBEDİLDİ olarak kapat</p>
                        <select value={lossCategory} onChange={(e) => setLossCategory(e.target.value)}
                            className={`${controlClass} w-full px-3 py-2 text-sm [color-scheme:dark]`}>
                            <option value="">Kayıp nedeni seçin…</option>
                            {Object.entries(LOSS_CATEGORY_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <input type="text" value={lossReason} onChange={(e) => setLossReason(e.target.value)}
                            placeholder="Kısa not (opsiyonel)"
                            className={`${controlClass} mt-2 w-full px-3 py-2 text-sm`} />
                        <button type="button" disabled={saving} onClick={handleLost}
                            className="mt-2 w-full rounded-lg bg-red-500/80 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-red-400">
                            Kaybedildi ✗
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        </div>
    );
}

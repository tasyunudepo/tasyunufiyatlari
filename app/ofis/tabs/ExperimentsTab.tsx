"use client";

import { useEffect, useMemo, useState } from "react";

// ============================================================
// Satış Deneyleri sekmesi (Sprint 4A) — Hipotez Motoru'nun gözlem +
// kayıt katmanı. Her satış fikri sözleşmeyle kaydedilir; öncesi/sonrası
// penceresi teklif verisinden gerçek sayılarla izlenir. "Kazanan" ilanı
// insan kararıdır; motorun öneri beyni (4B) yeterli kapanmış teklif
// birikince açılacak.
// ============================================================

const ofisPanel = "rounded-2xl border border-[var(--nx-border)] bg-[rgba(13,15,18,0.72)] shadow-[0_18px_44px_rgba(0,0,0,0.24)]";
const ofisInner = "rounded-xl border border-[rgba(92,98,108,0.18)] bg-[rgba(255,255,255,0.025)]";
const ofisControl = "rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.82)] text-[var(--nx-text-soft)] transition-colors focus:outline-none focus-visible:border-[var(--nx-border-accent)] focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.14)]";

type Experiment = {
    id: number;
    name: string;
    hypothesis: string;
    target_visitor: string | null;
    surface: string;
    primary_metric: string;
    guardrails: string | null;
    status: "yayinda" | "duraklatildi" | "tamamlandi";
    decision: string | null;
    result_summary: string | null;
    started_at: string;
    ended_at: string | null;
};

type QuoteLite = {
    created_at: string;
    brand_name?: string | null;
    status?: string | null;
};

const DECISION_LABELS: Record<string, string> = {
    yayinla: "Yayında kalsın",
    geri_al: "Geri alındı",
    gelistir: "Geliştirilecek",
    veri_yetersiz: "Veri yetersiz",
};

const STATUS_LABELS: Record<Experiment["status"], string> = {
    yayinda: "Yayında",
    duraklatildi: "Duraklatıldı",
    tamamlandi: "Tamamlandı",
};

export function ExperimentsTab() {
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [quotes, setQuotes] = useState<QuoteLite[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [closing, setClosing] = useState<Record<number, { decision: string; summary: string }>>({});

    const [form, setForm] = useState({
        name: "",
        hypothesis: "",
        targetVisitor: "",
        surface: "",
        primaryMetric: "",
        guardrails: "",
        startedAt: new Date().toISOString().slice(0, 10),
    });

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const [expRes, quotesRes] = await Promise.all([
                fetch("/api/admin/experiments"),
                fetch("/api/admin/quotes"),
            ]);
            const expJson = await expRes.json().catch(() => null);
            const quotesJson = await quotesRes.json().catch(() => null);
            if (!expRes.ok || !expJson?.ok) {
                setError(expJson?.error ?? "Deneyler alınamadı.");
            } else {
                setExperiments(expJson.experiments ?? []);
            }
            const rows = Array.isArray(quotesJson) ? quotesJson : quotesJson?.quotes ?? quotesJson?.data ?? [];
            if (Array.isArray(rows)) setQuotes(rows);
        } catch {
            setError("Bağlantı hatası.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, []);

    // Öncesi/sonrası penceresi: deney başlangıcından bugüne Bonus teklif
    // sayısı, aynı uzunluktaki önceki dönemle kıyaslanır — gerçek kayıtlar.
    const windowFor = useMemo(() => {
        return (exp: Experiment) => {
            const start = new Date(`${exp.started_at}T00:00:00`);
            const end = exp.ended_at ? new Date(`${exp.ended_at}T23:59:59`) : new Date();
            const spanMs = Math.max(end.getTime() - start.getTime(), 24 * 36e5);
            const beforeStart = new Date(start.getTime() - spanMs);
            const inWindow = (q: QuoteLite, from: Date, to: Date) => {
                const t = new Date(q.created_at).getTime();
                return t >= from.getTime() && t < to.getTime();
            };
            const isBonus = (q: QuoteLite) => (q.brand_name ?? "").toLowerCase().includes("bonus");
            const after = quotes.filter((q) => inWindow(q, start, end));
            const before = quotes.filter((q) => inWindow(q, beforeStart, start));
            const days = Math.max(1, Math.round(spanMs / (24 * 36e5)));
            return {
                days,
                afterTotal: after.length,
                afterBonus: after.filter(isBonus).length,
                beforeTotal: before.length,
                beforeBonus: before.filter(isBonus).length,
            };
        };
    }, [quotes]);

    async function createExperiment() {
        setError(null);
        const res = await fetch("/api/admin/experiments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: form.name.trim(),
                hypothesis: form.hypothesis.trim(),
                targetVisitor: form.targetVisitor.trim() || null,
                surface: form.surface.trim(),
                primaryMetric: form.primaryMetric.trim(),
                guardrails: form.guardrails.trim() || null,
                startedAt: form.startedAt,
            }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
            setError(json?.error ?? "Deney kaydedilemedi.");
            return;
        }
        setShowForm(false);
        setForm({ name: "", hypothesis: "", targetVisitor: "", surface: "", primaryMetric: "", guardrails: "", startedAt: new Date().toISOString().slice(0, 10) });
        void load();
    }

    async function patchExperiment(id: number, payload: Record<string, unknown>) {
        setError(null);
        const res = await fetch(`/api/admin/experiments/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
            setError(json?.error ?? "Güncellenemedi.");
            return;
        }
        void load();
    }

    function completeExperiment(exp: Experiment) {
        const c = closing[exp.id];
        if (!c?.decision) {
            setError("Karar seçin — sonuçsuz kapanış öğrenme belleğine bir şey bırakmaz.");
            return;
        }
        void patchExperiment(exp.id, {
            status: "tamamlandi",
            decision: c.decision,
            resultSummary: c.summary?.trim() || null,
            endedAt: new Date().toISOString().slice(0, 10),
        });
    }

    if (loading) {
        return <div className="p-8 text-sm text-slate-400">Deney defteri yükleniyor…</div>;
    }

    return (
        <div className="space-y-5" data-testid="experiments-tab">
            <div className={`${ofisPanel} p-5`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-[0.28em] text-amber-300/80">Satış Hipotez Motoru · Gözlem Katmanı</div>
                        <h2 className="mt-1.5 text-xl font-semibold">Satış Deneyleri</h2>
                        <p className="mt-1 text-sm text-slate-400">
                            Her fikir sözleşmeyle kaydedilir; sonuç gerçek teklif verisiyle izlenir.
                            Öneri beyni (teşhis/otomasyon) yeterli kapanmış teklif birikince açılacak — kazanan ilanını veri verir, biz onaylarız.
                        </p>
                    </div>
                    <button type="button" onClick={() => setShowForm((s) => !s)}
                        className={`${ofisControl} shrink-0 px-4 py-2 text-sm font-semibold hover:bg-[rgba(255,255,255,0.06)]`}>
                        {showForm ? "Vazgeç" : "+ Yeni deney"}
                    </button>
                </div>

                {showForm && (
                    <div className={`${ofisInner} mt-4 grid gap-3 p-4 sm:grid-cols-2`}>
                        <label className="block sm:col-span-2">
                            <span className="text-xs text-slate-400">Deney adı</span>
                            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className={`${ofisControl} mt-1 w-full px-3 py-2 text-sm`} />
                        </label>
                        <label className="block sm:col-span-2">
                            <span className="text-xs text-slate-400">Hipotez (kanıtlanan problem + beklenti + neden)</span>
                            <textarea rows={2} value={form.hypothesis} onChange={(e) => setForm({ ...form, hypothesis: e.target.value })}
                                className={`${ofisControl} mt-1 w-full px-3 py-2 text-sm`} />
                        </label>
                        <label className="block">
                            <span className="text-xs text-slate-400">Hedef ziyaretçi</span>
                            <input value={form.targetVisitor} onChange={(e) => setForm({ ...form, targetVisitor: e.target.value })}
                                className={`${ofisControl} mt-1 w-full px-3 py-2 text-sm`} />
                        </label>
                        <label className="block">
                            <span className="text-xs text-slate-400">Değiştirilen yüzey</span>
                            <input value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value })}
                                className={`${ofisControl} mt-1 w-full px-3 py-2 text-sm`} />
                        </label>
                        <label className="block">
                            <span className="text-xs text-slate-400">Ana karar metriği</span>
                            <input value={form.primaryMetric} onChange={(e) => setForm({ ...form, primaryMetric: e.target.value })}
                                className={`${ofisControl} mt-1 w-full px-3 py-2 text-sm`} />
                        </label>
                        <label className="block">
                            <span className="text-xs text-slate-400">Başlangıç tarihi</span>
                            <input type="date" value={form.startedAt} onChange={(e) => setForm({ ...form, startedAt: e.target.value })}
                                className={`${ofisControl} mt-1 w-full px-3 py-2 text-sm [color-scheme:dark]`} />
                        </label>
                        <label className="block sm:col-span-2">
                            <span className="text-xs text-slate-400">Korumalar (brüt kâr / müşteri kalitesi)</span>
                            <input value={form.guardrails} onChange={(e) => setForm({ ...form, guardrails: e.target.value })}
                                className={`${ofisControl} mt-1 w-full px-3 py-2 text-sm`} />
                        </label>
                        <div className="sm:col-span-2">
                            <button type="button" onClick={() => void createExperiment()}
                                className="rounded-lg bg-[var(--nx-gold)] px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90">
                                Deneyi kaydet
                            </button>
                        </div>
                    </div>
                )}

                {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
            </div>

            <div className="space-y-4">
                {experiments.map((exp) => {
                    const w = windowFor(exp);
                    const c = closing[exp.id] ?? { decision: "", summary: "" };
                    return (
                        <div key={exp.id} className={`${ofisPanel} p-5`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-white">{exp.name}</h3>
                                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
                                            exp.status === "yayinda"
                                                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                                                : exp.status === "duraklatildi"
                                                    ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                                                    : "border-slate-400/30 bg-slate-400/10 text-slate-300"
                                        }`}>
                                            {STATUS_LABELS[exp.status]}
                                        </span>
                                        {exp.decision && (
                                            <span className="rounded-full border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.1)] px-2.5 py-0.5 text-[10px] text-[var(--nx-gold)]">
                                                {DECISION_LABELS[exp.decision] ?? exp.decision}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-2 max-w-3xl text-sm text-slate-300">{exp.hypothesis}</p>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Yüzey: {exp.surface} · Metrik: {exp.primary_metric}
                                        {exp.guardrails && <> · Koruma: {exp.guardrails}</>}
                                    </p>
                                    {exp.result_summary && (
                                        <p className="mt-2 text-xs text-amber-200/90">Sonuç: {exp.result_summary}</p>
                                    )}
                                </div>
                                <div className={`${ofisInner} shrink-0 p-3 text-center text-sm`}>
                                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                        {new Date(exp.started_at).toLocaleDateString("tr-TR")}
                                        {exp.ended_at ? ` – ${new Date(exp.ended_at).toLocaleDateString("tr-TR")}` : "'ten beri"} · {w.days} gün penceresi
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-lg font-semibold tabular-nums text-slate-400">{w.beforeBonus}<span className="text-xs">/{w.beforeTotal}</span></div>
                                            <div className="text-[10px] text-slate-500">önce (Bonus/tüm)</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-semibold tabular-nums text-white">{w.afterBonus}<span className="text-xs">/{w.afterTotal}</span></div>
                                            <div className="text-[10px] text-slate-500">sonra (Bonus/tüm)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {exp.status !== "tamamlandi" && (
                                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[rgba(92,98,108,0.18)] pt-3">
                                    <button type="button"
                                        onClick={() => void patchExperiment(exp.id, { status: exp.status === "yayinda" ? "duraklatildi" : "yayinda" })}
                                        className={`${ofisControl} px-3 py-1.5 text-xs hover:bg-[rgba(255,255,255,0.05)]`}>
                                        {exp.status === "yayinda" ? "Duraklat" : "Yeniden yayınla"}
                                    </button>
                                    <select value={c.decision}
                                        onChange={(e) => setClosing({ ...closing, [exp.id]: { ...c, decision: e.target.value } })}
                                        className={`${ofisControl} px-3 py-1.5 text-xs [color-scheme:dark]`}>
                                        <option value="">Kapanış kararı…</option>
                                        {Object.entries(DECISION_LABELS).map(([v, l]) => (
                                            <option key={v} value={v}>{l}</option>
                                        ))}
                                    </select>
                                    <input placeholder="Sonuç özeti (öğrenme belleği için)" value={c.summary}
                                        onChange={(e) => setClosing({ ...closing, [exp.id]: { ...c, summary: e.target.value } })}
                                        className={`${ofisControl} min-w-[240px] flex-1 px-3 py-1.5 text-xs`} />
                                    <button type="button" onClick={() => completeExperiment(exp)}
                                        className={`${ofisControl} px-3 py-1.5 text-xs font-semibold text-[var(--nx-gold)] hover:bg-[rgba(201,168,76,0.1)]`}>
                                        Deneyi kapat
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
                {experiments.length === 0 && (
                    <div className={`${ofisPanel} p-8 text-center text-sm text-slate-400`}>Kayıtlı deney yok.</div>
                )}
            </div>
        </div>
    );
}

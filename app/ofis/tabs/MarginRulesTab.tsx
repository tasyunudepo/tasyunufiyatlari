"use client";

import { useEffect, useState } from "react";
import { Sliders, Save, Truck, AlertCircle } from "lucide-react";
import type { MaterialType } from "@/lib/types";

type Draft = Partial<Pick<MaterialType,
  | 'min_order_m2'
  | 'tier1_max_m2' | 'tier1_margin_pct'
  | 'tier2_max_m2' | 'tier2_margin_pct'
  | 'tier3_margin_pct'
  | 'full_vehicle_only'
  | 'special_order_threshold_m2'
  | 'special_order_note'
>>;

export function MarginRulesTab() {
  const [items, setItems] = useState<MaterialType[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});
  const [successId, setSuccessId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/material-types', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.ok) setItems(json.materialTypes ?? []);
    } finally {
      setLoading(false);
    }
  }

  function setField(id: number, field: keyof Draft, value: unknown) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function save(id: number) {
    const draft = drafts[id];
    if (!draft || Object.keys(draft).length === 0) return;
    setSaving((s) => ({ ...s, [id]: true }));
    setErrors((e) => ({ ...e, [id]: null }));
    try {
      const res = await fetch(`/api/admin/material-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrors((e) => ({ ...e, [id]: json.error ?? 'Kayıt başarısız' }));
        return;
      }
      setItems((prev) => prev.map((m) => m.id === id ? { ...m, ...json.materialType } : m));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSuccessId(id);
      setTimeout(() => setSuccessId((s) => s === id ? null : s), 2500);
    } catch {
      setErrors((e) => ({ ...e, [id]: 'Bağlantı hatası' }));
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  }

  if (loading) {
    return <div className="admin-nexus-panel p-6"><p className="text-slate-400">Yükleniyor...</p></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="admin-nexus-panel p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/15 p-2.5 text-amber-300">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Marj Kuralları</h2>
            <p className="mt-1 text-sm text-slate-400">
              Mantolama wizard&apos;ında uygulanan hacim-bazlı kâr marjı kademeleri ve
              tam-araç kuralı. Değişiklikler anında geçerli olur (sayfa yenilemesi gerekir).
            </p>
          </div>
        </div>
      </div>

      {/* Material type cards */}
      {items.map((mt) => {
        const draft = drafts[mt.id] ?? {};
        const v = <K extends keyof Draft>(field: K) =>
          (draft[field] !== undefined ? draft[field] : (mt[field as keyof MaterialType] as Draft[K]));
        const dirty = Object.keys(drafts[mt.id] ?? {}).length > 0;
        const isEps = mt.slug === 'eps';
        const isTasyunu = mt.slug === 'tasyunu';

        return (
          <div key={mt.id} className="admin-nexus-panel p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-white">{mt.name}</h3>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                  {mt.slug}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {successId === mt.id && (
                  <span className="text-xs font-medium text-emerald-400">✓ Kaydedildi</span>
                )}
                <button
                  type="button"
                  onClick={() => save(mt.id)}
                  disabled={!dirty || saving[mt.id]}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving[mt.id] ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>

            {errors[mt.id] && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errors[mt.id]}</span>
              </div>
            )}

            {/* EPS — kademeli marj */}
            {isEps && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Minimum Sipariş (m²)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={v('min_order_m2') ?? ''}
                    onChange={(e) => setField(mt.id, 'min_order_m2', e.target.value === '' ? null : Number(e.target.value))}
                    className="w-32 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white tabular-nums focus:border-amber-500/60 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Bu metrajın altındaki siparişlerde teklif alınmaz.</p>
                </div>

                <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Kademe 1 — düşük metraj
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Üst sınır (m²)</label>
                      <input
                        type="number"
                        value={v('tier1_max_m2') ?? ''}
                        onChange={(e) => setField(mt.id, 'tier1_max_m2', e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white tabular-nums focus:border-amber-500/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Marj (%)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={v('tier1_margin_pct') ?? ''}
                        onChange={(e) => setField(mt.id, 'tier1_margin_pct', e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white tabular-nums focus:border-amber-500/60 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Kademe 2 — orta metraj
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Üst sınır (m²)</label>
                      <input
                        type="number"
                        value={v('tier2_max_m2') ?? ''}
                        onChange={(e) => setField(mt.id, 'tier2_max_m2', e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white tabular-nums focus:border-amber-500/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Marj (%)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={v('tier2_margin_pct') ?? ''}
                        onChange={(e) => setField(mt.id, 'tier2_margin_pct', e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white tabular-nums focus:border-amber-500/60 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Kademe 3 — yüksek metraj (üst sınırsız)
                  </p>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Marj (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={v('tier3_margin_pct') ?? ''}
                      onChange={(e) => setField(mt.id, 'tier3_margin_pct', e.target.value === '' ? null : Number(e.target.value))}
                      className="w-32 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white tabular-nums focus:border-amber-500/60 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Taşyünü — tam-araç kuralı + sabit marj + özel teklif eşiği */}
            {isTasyunu && (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(v('full_vehicle_only'))}
                      onChange={(e) => setField(mt.id, 'full_vehicle_only', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                    />
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        <Truck className="h-3.5 w-3.5 text-slate-400" />
                        Tam-araç kuralı aktif
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Açıkken yalnızca tam Kamyon, tam TIR ya da bunların kombinasyonları kabul edilir;
                        ara metrajlar wizard&apos;da bloklanır.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Kâr Marjı (sabit, kademe yok)
                  </p>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Marj (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={v('tier3_margin_pct') ?? ''}
                      onChange={(e) => setField(mt.id, 'tier3_margin_pct', e.target.value === '' ? null : Number(e.target.value))}
                      className="w-32 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white tabular-nums focus:border-amber-500/60 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Büyük Metraj — Özel Teklif
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Eşik (m²)</label>
                      <input
                        type="number"
                        value={v('special_order_threshold_m2') ?? ''}
                        onChange={(e) => setField(mt.id, 'special_order_threshold_m2', e.target.value === '' ? null : Number(e.target.value))}
                        className="w-32 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white tabular-nums focus:border-amber-500/60 focus:outline-none"
                        placeholder="örn. 10000"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Bilgi notu (UI rozeti + PDF)</label>
                      <textarea
                        rows={4}
                        value={v('special_order_note') ?? ''}
                        onChange={(e) => setField(mt.id, 'special_order_note', e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-white focus:border-amber-500/60 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isEps && !isTasyunu && (
              <p className="text-sm text-slate-500">Bu malzeme tipi için marj kuralı tanımlanmadı.</p>
            )}
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="admin-nexus-panel p-6">
          <p className="text-sm text-slate-500">Malzeme tipi bulunamadı.</p>
        </div>
      )}
    </div>
  );
}

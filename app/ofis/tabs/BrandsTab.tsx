"use client";

import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import bonusPriceData from "@/lib/pricing/bonus/bonus-region-prices.json";

interface BrandRow {
  id: number;
  name: string;
  tier: string | null;
  description: string | null;
  margin_pct: number | null;
}

// Marka bilgi notları — ticari kaynak görünürlüğü (yalnız admin ekranı).
const BRAND_NOTES: Record<string, string> = {
  Bonus: `Fiyat listesi: ${bonusPriceData.source.document} · bölge bazlı (1-7) · taban = liste −%${bonusPriceData.discountPct} · İstanbul yaka / Kocaeli-Gebze ayrımı uygulanır`,
  Tekno: "Toz grubu/aksesuar markası; şehir/sevkiyat kuralı panele bağlanana kadar kombinasyon fiyatı kesinleşmez (kilitli karar 12-13).",
};

export function BrandsTab() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
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
      const res = await fetch("/api/admin/brands", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.ok) setBrands(json.brands ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function save(id: number) {
    const raw = drafts[id];
    if (raw === undefined) return;

    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      setErrors((e) => ({ ...e, [id]: "0-100 arası bir yüzde girin veya boş bırakın." }));
      return;
    }

    setSaving((s) => ({ ...s, [id]: true }));
    setErrors((e) => ({ ...e, [id]: null }));
    try {
      const res = await fetch(`/api/admin/brands/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ margin_pct: value }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrors((e) => ({ ...e, [id]: json.error ?? "Kayıt başarısız" }));
        return;
      }
      setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, ...json.brand } : b)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSuccessId(id);
      setTimeout(() => setSuccessId((s) => (s === id ? null : s)), 2500);
    } catch {
      setErrors((e) => ({ ...e, [id]: "Bağlantı hatası" }));
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  }

  if (loading) {
    return (
      <div className="admin-nexus-panel p-6">
        <p className="text-slate-400">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="admin-nexus-panel p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/15 p-2.5 text-amber-300">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Markalar</h2>
            <p className="mt-1 text-sm text-slate-400">
              Marka bazlı kâr marjı yönetimi. Marka marjı doluysa o markanın bütün
              fiyat yüzeylerinde geçerlidir; <span className="text-slate-300">boş bırakılan marka</span>,
              Marj Kuralları sekmesindeki malzeme-tipi kademelerini kullanır.
              Karar kaynağı: karar günlüğü Tur 4 (yalnız Bonus %5).
            </p>
          </div>
        </div>
      </div>

      {brands.map((brand) => {
        const draft = drafts[brand.id];
        const displayValue =
          draft !== undefined ? draft : brand.margin_pct === null ? "" : String(brand.margin_pct);
        const dirty = draft !== undefined;
        const note = BRAND_NOTES[brand.name];

        return (
          <div key={brand.id} className="admin-nexus-panel p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[10rem]">
                <div className="font-semibold text-white">{brand.name}</div>
                {brand.tier && (
                  <div className="text-xs uppercase tracking-wide text-slate-500">{brand.tier}</div>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Marka Marjı (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Malzeme kuralı"
                  value={displayValue}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [brand.id]: e.target.value }))}
                  className="admin-nexus-input w-40 px-3 py-2"
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={() => save(brand.id)}
                  disabled={!dirty || saving[brand.id]}
                  className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40"
                >
                  {saving[brand.id] ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>

              <div className="pt-4 text-sm">
                {successId === brand.id && <span className="text-green-400">Kaydedildi ✓</span>}
                {errors[brand.id] && <span className="text-red-400">{errors[brand.id]}</span>}
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Geçerli marj:{" "}
              {brand.margin_pct === null ? (
                <span>malzeme-tipi kademe kuralı (Marj Kuralları sekmesi)</span>
              ) : (
                <span className="text-slate-300">%{brand.margin_pct} — marka kuralı</span>
              )}
            </div>

            {note && <div className="mt-2 text-xs text-slate-500">{note}</div>}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

import { formatCurrency } from "@/lib/admin/utils";
import type { CatalogItem } from "@/app/api/admin/catalog-items/route";

// Katalogdan ürün seçici. Fiyat sunucuda marj + iskonto kuralıyla
// hesaplanmış gelir; burada yalnız gösterilir ve seçilir.

interface Props {
  open: boolean;
  items: CatalogItem[];
  loading: boolean;
  onClose: () => void;
  onPick: (item: CatalogItem) => void;
}

export function ProductPickerDialog({ open, items, loading, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"hepsi" | "levha" | "aksesuar">("hepsi");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return items
      .filter((i) => (kind === "hepsi" ? true : i.kind === kind))
      .filter((i) => {
        if (!q) return true;
        const text = `${i.label} ${i.fullName} ${i.brandName}`.toLocaleLowerCase("tr-TR");
        return text.includes(q);
      })
      .slice(0, 200);
  }, [items, query, kind]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Katalogdan ürün seç"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-[rgba(92,98,108,0.3)] bg-[#12141a] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[rgba(92,98,108,0.24)] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-white">Katalogdan seç</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Fiyatlar şehir/araç iskontosu ve marj kuralı uygulanmış hâlde gelir.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(92,98,108,0.18)] px-5 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nx-text-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ürün ara…"
              aria-label="Katalogda ara"
              className="w-full rounded-xl border border-[rgba(92,98,108,0.3)] bg-[rgba(18,20,24,0.8)] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-[rgba(201,168,76,0.5)]"
            />
          </div>
          {(["hepsi", "levha", "aksesuar"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                kind === k
                  ? "border-[var(--nx-gold)] bg-[var(--nx-gold)] text-[#101114]"
                  : "border-[rgba(92,98,108,0.3)] text-slate-300 hover:bg-white/5"
              }`}
            >
              {k === "hepsi" ? "Tümü" : k === "levha" ? "Levha" : "Aksesuar"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-400">Katalog yükleniyor…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">Eşleşen ürün yok.</p>
          ) : (
            <ul className="divide-y divide-[rgba(92,98,108,0.12)]">
              {filtered.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    className="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(201,168,76,0.08)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white" title={item.kind === "aksesuar" ? item.fullName : item.label}>
                        {item.kind === "aksesuar" ? item.fullName : item.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--nx-text-muted)]">
                        {item.kind === "levha" ? "Levha" : "Aksesuar"} · {item.unit}
                        {item.kind === "aksesuar" && item.unitContent && item.unitContent > 1
                          ? ` · paket içeriği ${item.unitContent}`
                          : ""}
                        {" · marj %"}{item.marginPct}
                        <span className="text-[var(--nx-text-muted)]"> ({item.marginSource})</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-[var(--nx-gold)]">
                        {formatCurrency(item.suggestedUnitPrice)}
                      </p>
                      <p className="text-[10px] text-[var(--nx-text-muted)]">/{item.unit} · KDV hariç</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

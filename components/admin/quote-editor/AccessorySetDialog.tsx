"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Package, X } from "lucide-react";

import { formatCurrency } from "@/lib/admin/utils";
import type { AccessorySetOption } from "@/app/api/admin/accessory-sets/route";

// Toz grubu paketi seçici.
//
// Bu sitenin kuruluş amacı teklif hazırlama zahmetini kaldırmaktı; toz
// grubunu 7 satır tek tek yazmak o amaca ters. Operatör markayı seçer,
// yapıştırıcı/sıva/file/dübel/profil/astar/kaplama miktarlarıyla birlikte
// TEK TIKLA teklife girer. Sonrasında her kalem yine tek tek düzenlenebilir.

interface Props {
  open: boolean;
  sets: AccessorySetOption[];
  loading: boolean;
  error: string | null;
  areaM2: number;
  plateThicknessCm: number | null;
  onClose: () => void;
  onApply: (set: AccessorySetOption) => void;
}

export function AccessorySetDialog({
  open,
  sets,
  loading,
  error,
  areaM2,
  plateThicknessCm,
  onClose,
  onApply,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Toz grubu paketi seç"
        data-testid="accessory-set-dialog"
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-[rgba(92,98,108,0.3)] bg-[#12141a] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(92,98,108,0.24)] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-white">Toz grubu paketi ekle</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {areaM2.toLocaleString("tr-TR")} m² için miktarlar hesaplandı — seçtiğiniz
              markanın tüm kalemleri tek seferde eklenir.
            </p>
            {plateThicknessCm != null && (
              <p className="mt-1 text-xs font-medium text-amber-200">
                {String(plateThicknessCm).replace(".", ",")} cm levhada 4–5 cm duvar
                tutunma payı gözetilir; uygun dübel boyu yukarı yuvarlanır.
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="p-6 text-center text-sm text-slate-400">Paketler hesaplanıyor…</p>}

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && sets.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">
              Bu malzeme için tanımlı toz grubu paketi bulunamadı.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {sets.map((set) => (
              <div
                key={set.key}
                className={`rounded-xl border p-4 ${
                  set.complete
                    ? "border-[rgba(92,98,108,0.3)] bg-[rgba(255,255,255,0.02)]"
                    : "border-amber-400/30 bg-amber-400/[0.04]"
                }`}
              >
                {/* MARKA BAŞLIKTA. Paket tanımı adları tekrar ediyor
                    ("Dengeli Sistem" dört ayrı markada var); marka öne
                    çıkmazsa operatör kartları ayırt edemiyor. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white" data-testid={`set-brand-${set.accessoryBrandName}`}>
                      {set.accessoryBrandName || set.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {set.name !== set.accessoryBrandName && <>{set.name} · </>}
                      {set.items.length} kalem
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums text-[var(--nx-gold)]">
                      {formatCurrency(set.totalCost)}
                    </p>
                    <p className="text-[10px] text-[var(--nx-text-muted)]">KDV hariç</p>
                  </div>
                </div>

                {!set.complete && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1.5 text-[10px] text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>Eksik: {set.missingTypes.join(", ")} — bu markada tanımlı değil.</span>
                  </p>
                )}

                <ul className="mt-2.5 space-y-1 text-[11px]">
                  {set.items.map((it) => (
                    <li key={it.accessoryId} className="flex items-center justify-between gap-2">
                      {/* ÜRÜN ADI gösterilir, tip adı değil: aynı "Yapıştırıcı"
                          tipinde TEKNOİZOFİX ile CHELFIX farkını ancak ürün
                          adı gösterir (27 Tem 2026 yanlış ürün olayı). */}
                      <span className="min-w-0 truncate text-slate-300" title={it.description}>
                        {it.description}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-400">
                        {it.quantity} {it.unit} · {formatCurrency(it.totalPrice)}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onApply(set)}
                  disabled={!set.complete}
                  data-testid={`apply-set-${set.key}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--nx-gold)] px-3 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Check className="h-3.5 w-3.5" />
                  {set.complete ? "Bu paketi ekle" : "Eksik set — eklenemez"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[rgba(92,98,108,0.18)] px-5 py-3">
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--nx-text-muted)]">
            <Package className="h-3.5 w-3.5" />
            Eklendikten sonra her kalemin miktarı, fiyatı ve iskontosu tek tek düzenlenebilir.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { ArrowRight, TrendingDown } from "lucide-react";

interface Props {
  neededM2: number;
  lorryM2: number | null;
  truckM2: number | null;
  lorryPrice: number | null;
  truckPrice: number | null;
  packageRefPrice: number | null;
  discKamyon: number;
  discTir: number;
  onJump: (targetM2: number) => void;
}

type TierLevel = "below_vehicle" | "lorry" | "truck";

type ThresholdRow = {
  key: "lorry" | "truck";
  label: string;
  description: string;
  targetM2: number;
  price: number | null;
  discountPct: number;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value: number) {
  return `₺${formatNumber(value, 2)}`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export default function AreaThresholdAssist({
  neededM2,
  lorryM2,
  truckM2,
  lorryPrice,
  truckPrice,
  packageRefPrice,
  discKamyon,
  discTir,
  onJump,
}: Props) {
  if (neededM2 <= 0 || (!lorryM2 && !truckM2)) return null;

  const currentLevel: TierLevel =
    truckM2 && neededM2 >= truckM2
      ? "truck"
      : lorryM2 && neededM2 >= lorryM2
        ? "lorry"
        : "below_vehicle";

  const rows: ThresholdRow[] = [
    ...(lorryM2
      ? [
          {
            key: "lorry" as const,
            label: "Kamyon",
            description: "Kamyon indirimi açılır",
            targetM2: lorryM2,
            price: lorryPrice,
            discountPct: discKamyon,
          },
        ]
      : []),
    ...(truckM2
      ? [
          {
            key: "truck" as const,
            label: "TIR",
            description: "En avantajlı fiyat seviyesi",
            targetM2: truckM2,
            price: truckPrice,
            discountPct: discTir,
          },
        ]
      : []),
  ];

  const upsell = (() => {
    if (currentLevel === "below_vehicle" && lorryM2 && lorryPrice && packageRefPrice) {
      return {
        label: "Kamyon",
        targetM2: lorryM2,
        addM2: Math.ceil(lorryM2 - neededM2),
        savingsPerM2: packageRefPrice - lorryPrice,
        totalSavings: neededM2 * (packageRefPrice - lorryPrice),
        discPct: discKamyon,
      };
    }

    if (currentLevel === "lorry" && truckM2 && truckPrice && lorryPrice) {
      return {
        label: "TIR",
        targetM2: truckM2,
        addM2: Math.ceil(truckM2 - neededM2),
        savingsPerM2: lorryPrice - truckPrice,
        totalSavings: neededM2 * (lorryPrice - truckPrice),
        discPct: discTir,
      };
    }

    return null;
  })();

  return (
    <div className="mt-2 space-y-2.5">
      {currentLevel === "truck" && (
        <div className="rounded-lg border border-green-700/30 bg-green-950/30 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-[13px] leading-none">✓</span>
            <div>
              <p className="text-xs font-semibold leading-tight text-green-300">
                En avantajlı fiyat seviyesi aktif
              </p>
              <p className="mt-0.5 text-[11px] text-fe-muted">TIR fiyatı uygulanıyor</p>
            </div>
          </div>
        </div>
      )}

      {currentLevel === "lorry" && (
        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-[13px] leading-none">▣</span>
            <div>
              <p className="text-xs font-semibold leading-tight text-fe-text">
                Kamyon baremi aktif
              </p>
              <p className="mt-0.5 text-[11px] text-fe-muted">Bir üst avantaj TIR bareminde</p>
            </div>
          </div>
        </div>
      )}

      {currentLevel === "below_vehicle" && (
        <div className="rounded-lg border border-brand-700/20 bg-brand-950/20 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-[13px] leading-none">□</span>
            <div>
              <p className="text-xs font-semibold leading-tight text-brand-300">
                Tam araç altı metraja teklif verilmiyor
              </p>
              <p className="mt-0.5 text-[11px] text-fe-muted">
                Fabrika çıkışı için tam Kamyon veya tam TIR metrajını seçin
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-fe-border/60 bg-fe-raised/35 px-3 py-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold text-fe-text">Barem ilerlemesi</p>
          <span className="text-[10px] text-fe-muted">Threshold progression</span>
        </div>

        <div className="space-y-3">
          {rows.map((row) => {
            const ratio = clampPercent((neededM2 / row.targetM2) * 100);
            const remaining = Math.max(0, Math.ceil(row.targetM2 - neededM2));
            const reached = remaining === 0;
            return (
              <div
                key={row.key}
                className={cn(
                  "rounded-xl border px-3 py-3 transition-[border-color,box-shadow,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  reached
                    ? "border-emerald-500/30 bg-emerald-950/12"
                    : "border-white/6 bg-fe-bg/40"
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-fe-text">{row.label} baremi</p>
                    <p className="mt-0.5 text-[11px] text-fe-muted">{row.description}</p>
                  </div>

                  {reached ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Açıldı
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-brand-500/20 bg-brand-500/8 px-2 py-0.5 text-[10px] font-semibold text-brand-300">
                      %{formatNumber(ratio)}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div
                    className={cn(
                      "h-7 overflow-hidden rounded-full border border-white/6 bg-white/[0.04] shadow-inner",
                      reached && "border-emerald-500/20 bg-emerald-950/10"
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width,background-color,box-shadow] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                        reached
                          ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 shadow-[0_0_24px_rgba(34,197,94,0.28)]"
                          : "bg-gradient-to-r from-brand-700 via-brand-500 to-brand-300"
                      )}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>

                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
                    <div
                      className={cn(
                        "h-4 w-4 translate-x-1/2 rounded-full border-2 bg-fe-bg transition-[border-color,box-shadow,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        reached
                          ? "border-emerald-300 bg-emerald-400 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]"
                          : "border-brand-200/80"
                      )}
                    />
                  </div>
                </div>

                <div className="mt-2 flex justify-end">
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-fe-text">
                      {formatNumber(row.targetM2)} m²
                    </p>
                    <p className="mt-0.5 text-[10px] text-fe-muted">{row.description}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-fe-muted">mevcut / hedef</p>
                    <p className="mt-1 text-[12px] font-semibold text-fe-text">
                      {formatNumber(neededM2)} / {formatNumber(row.targetM2)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-fe-muted">ilerleme</p>
                    <p className="mt-1 text-[12px] font-semibold text-fe-text">
                      %{formatNumber(ratio)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-fe-muted">kalan</p>
                    <p className="mt-1 text-[12px] font-semibold text-fe-text">
                      {reached ? "0 m²" : `${formatNumber(remaining)} m²`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-fe-muted">
                    {row.price !== null ? (
                      <span>
                        Bu baremde yaklaşık{" "}
                        <span className="text-fe-text">{formatCurrency(row.price)}</span> /m² · KDV hariç
                      </span>
                    ) : (
                      <span>Fiyat bilgisi teklif ile belirlenir</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onJump(row.targetM2)}
                    disabled={reached}
                    className="shrink-0 rounded-lg border border-brand-500/35 bg-brand-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-brand-300 transition-colors hover:bg-brand-500/20 disabled:cursor-default disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-fe-muted"
                  >
                    Metrajı {formatNumber(row.targetM2)} m² yap
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {upsell && (
        <div className="rounded-lg border border-brand-500/25 bg-brand-950/20 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-fe-text">{upsell.label} baremine geçersen:</p>
            <span className="text-[10px] text-fe-muted">-%{formatNumber(upsell.discPct)} iskonto</span>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-fe-muted">m² başı avantaj</p>
              <p className="mt-0.5 text-[13px] font-semibold text-white">
                {formatCurrency(upsell.savingsPerM2)}
                <span className="text-[10px] font-normal text-fe-muted"> /m²</span>
              </p>
            </div>

            {upsell.totalSavings > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-fe-muted">toplam avantaj</p>
                <p className="mt-0.5 text-[13px] font-semibold text-green-400">
                  ~{formatCurrency(upsell.totalSavings)}
                </p>
              </div>
            )}

            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wide text-fe-muted">gerekli ek metraj</p>
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-fe-text">
                +{formatNumber(upsell.addM2)} m²
                <ArrowRight className="h-3 w-3 text-fe-muted" />
                toplam {formatNumber(upsell.targetM2)} m²
              </p>
            </div>
          </div>

          <p className="mb-3 text-[10px] text-fe-muted-strong">
            Avantaj tutarları KDV hariç fiyatlar üzerinden hesaplanır.
          </p>

          <button
            type="button"
            onClick={() => onJump(upsell.targetM2)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/10 py-2 text-[11px] font-semibold text-brand-300 transition-colors hover:bg-brand-500/20 active:bg-brand-500/30"
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Metrajı {formatNumber(upsell.targetM2)} m² yap
          </button>
        </div>
      )}
    </div>
  );
}

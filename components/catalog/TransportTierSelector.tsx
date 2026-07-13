"use client";

import { Check, Lock, TrendingDown } from "lucide-react";

type TierId = "lorry" | "truck";

export type TierOption = {
  id: TierId;
  label: string;
  capacity: number;
  price: number | null;
  savings?: number | null;
  shipping?: number | null;
  badge?: string;
  isRecommended?: boolean;
  disabled?: boolean;
  minM2Required?: number;
};

type TransportTierRailProps = {
  tiers: TierOption[];
  selectedId: TierId;
  onSelect: (id: TierId) => void;
  className?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function KamyonIcon({
  className,
  selected = false,
}: {
  className?: string;
  selected?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 42 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {selected ? (
        <rect x="4" y="6.5" width="16.5" height="7.2" rx="2.2" fill="currentColor" opacity="0.08" />
      ) : null}
      <rect x="4.5" y="7" width="15.5" height="6.2" rx="1.8" />
      <path d="M20 8.6h5.5l3.5 3.2v1.4H20" />
      <path d="M25 8.6v4.6" />
      <circle cx="11" cy="18" r="2.5" />
      <circle cx="25.5" cy="18" r="2.5" />
      <path d="M5 18h3.2" />
      <path d="M13.8 18h8.2" />
      <path d="M28.4 18h1.8" />
    </svg>
  );
}

function TirIcon({
  className,
  selected = false,
}: {
  className?: string;
  selected?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 82 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {selected ? (
        <rect x="3.5" y="6.2" width="36" height="7.6" rx="2.2" fill="currentColor" opacity="0.08" />
      ) : null}
      {/* Long trailer body */}
      <rect x="4" y="6.8" width="35.5" height="6.4" rx="1.8" />
      {/* Cab */}
      <path d="M39.5 8.5h7.7l4.8 3.4v1.3H39.5" />
      <path d="M46.4 8.5v4.7" />
      {/* Axles — three trailer + one drive */}
      <circle cx="13" cy="18" r="2.5" />
      <circle cx="25" cy="18" r="2.5" />
      <circle cx="39.5" cy="18" r="2.5" />
      <circle cx="50.3" cy="18" r="2.5" />
      {/* Ground lines */}
      <path d="M5 18h5" />
      <path d="M16.2 18h5.5" />
      <path d="M28.2 18h7.8" />
      <path d="M42.7 18h3.9" />
      <path d="M53.6 18h2" />
    </svg>
  );
}

function TierIcon({ id, selected }: { id: TierId; selected: boolean }) {
  if (id === "truck") {
    return <TirIcon selected={selected} className="h-11 w-[148px]" />;
  }

  if (id === "lorry") {
    return <KamyonIcon selected={selected} className="h-10 w-20" />;
  }

  return <KamyonIcon selected={selected} className="h-10 w-20" />;
}

function getTierMeta(tier: TierOption) {
  return {
    subtitle: tier.id === "truck" ? "En avantajlı birim fiyat" : "Dengeli sevkiyat",
    helperText: `${formatNumber(tier.capacity)} m² kapasite`,
    badge: tier.badge ?? (tier.isRecommended ? "En Avantajlı" : undefined),
  };
}

export default function TransportTierRail({
  tiers,
  selectedId,
  onSelect,
  className,
}: TransportTierRailProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.1em] text-zinc-400">
          Sipariş büyüklüğü
        </div>
        <div className="text-[11px] text-zinc-500">Kaydırarak karşılaştır</div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-fe-raised/95 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-fe-raised/95 to-transparent" />

        <div
          className={cn(
            "-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {tiers.map((tier, index) => {
            const selected = tier.id === selectedId;
            const disabled = Boolean(tier.disabled);
            const locked = disabled && Boolean(tier.minM2Required);
            const meta = getTierMeta(tier);

            return (
              <button
                key={tier.id}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => !disabled && onSelect(tier.id)}
                className={cn(
                  "relative snap-start shrink-0 rounded-2xl border text-left transition-all duration-200",
                  "w-[228px] min-h-[280px] px-4 py-4",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35",
                  locked && "cursor-not-allowed opacity-50",
                  !selected &&
                    !disabled &&
                    "border-fe-border bg-fe-raised/80 hover:border-white/14 hover:bg-fe-raised hover:-translate-y-[1px]",
                  selected &&
                    "border-brand-500 bg-brand-500/10 shadow-[0_0_0_1px_rgba(212,132,90,0.15),0_8px_24px_rgba(212,132,90,0.12)]",
                  locked && "border-white/6 bg-white/[0.02]"
                )}
                style={index === 0 ? { marginLeft: "6px" } : undefined}
              >
                {meta.badge ? (
                  <div
                    className={cn(
                      "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide",
                      selected
                        ? "bg-brand-500 text-white"
                        : "border border-fe-border bg-fe-bg text-fe-text"
                    )}
                  >
                    {meta.badge}
                  </div>
                ) : null}

                {/* Lock badge */}
                {locked ? (
                  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                    <Lock className="h-2.5 w-2.5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">Kilitli</span>
                  </div>
                ) : null}

                <div className="flex min-h-[62px] items-center justify-center">
                  <div className={cn(
                    "transition-colors",
                    locked ? "text-zinc-700" : selected ? "text-brand-400" : "text-fe-muted"
                  )}>
                    <TierIcon id={tier.id} selected={selected} />
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <h3 className={cn(
                      "text-[18px] font-semibold leading-none",
                      locked ? "text-zinc-600" : "text-fe-text"
                    )}>
                      {tier.label}
                    </h3>

                    {selected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-300">
                        <Check className="h-3 w-3" />
                        Seçili
                      </span>
                    ) : null}
                  </div>

                  <p className={cn(
                    "mt-2 text-[12px] leading-4",
                    locked ? "text-zinc-700" : "text-zinc-400"
                  )}>
                    {meta.subtitle}
                  </p>
                </div>

                {/* Price block — hidden for locked tiers */}
                {locked ? (
                  <div className="mt-5">
                    <div className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <span className="text-[13px] font-semibold text-zinc-400">
                        Min. {formatNumber(tier.minM2Required!)} m²
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-600 leading-4">
                      Bu fiyat seviyesi için metraj yetersiz
                    </p>
                  </div>
                ) : (
                  <div className="mt-5">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-400">
                      m² fiyatı
                    </div>

                    <div className="mt-2 flex items-end gap-1.5">
                      <div className="text-[40px] font-bold leading-none tracking-tight text-white">
                        {tier.price !== null ? formatCurrency(tier.price) : "Teklif"}
                      </div>
                      {tier.price !== null ? (
                        <div className="pb-1 text-[11px] text-zinc-400">/ m²</div>
                      ) : null}
                    </div>
                    {tier.price !== null ? (
                      <p className="mt-1 text-[10px] text-zinc-500">KDV hariç</p>
                    ) : null}
                  </div>
                )}

                <div className="min-h-[42px] pt-4">
                  {!locked && typeof tier.savings === "number" && tier.savings > 0 ? (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/18 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {formatCurrency(tier.savings)} avantaj
                    </div>
                  ) : (
                    <div className="h-[30px]" />
                  )}
                </div>

                <div className="mt-4 space-y-1.5 border-t border-white/6 pt-4 text-[11px] leading-5">
                  <p className={locked ? "text-zinc-700" : "text-zinc-400"}>{meta.helperText}</p>
                  {!locked && tier.shipping !== null && tier.shipping !== undefined ? (
                    <p className="text-zinc-400">Nakliye: {formatCurrency(tier.shipping)}</p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { TransportTierRail };

"use client";

// SepetVehicleCards
// SepetUI içindeki Kamyon + TIR araç kartlarını ve isteğe bağlı sepet
// özet barını barındırır. Saf görsel + counter etkileşim — state SepetUI'da
// kalmaya devam eder, bu bileşen yalnızca görüntüleme + +/− callback'leri.
//
// React.memo: kamyon/tir/fiyat değişmedikçe re-render yapmaz; SepetUI'ın
// her state değişiminde tüm 600 satırlık JSX'i yeniden yorumlama yükünü
// keser.

import { memo } from "react";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";

function fmt(v: number, d = 2) {
  return v.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function CounterButton({
  onClick,
  disabled,
  children,
  ariaLabel,
  commercial = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  ariaLabel: string;
  commercial?: boolean;
}) {
  const sizeCls = "h-11 w-11 rounded-xl";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${commercial ? "border-[#bcae99] bg-white text-[#282219] hover:border-[#8a5f1d] hover:bg-[#f8eddb]" : "border-fe-border bg-fe-raised text-fe-text hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-300"} ${sizeCls}`}
    >
      {children}
    </button>
  );
}

function CommercialVehicleIcon({
  type,
  capacity,
  selected,
}: {
  type: "lorry" | "truck";
  capacity: number;
  selected: boolean;
}) {
  if (type === "truck") {
    return (
      <div
        data-testid="pdp-vehicle-icon-truck"
        className="relative mx-auto h-[70px] w-[214px] max-w-full shrink-0"
      >
        <Image
          src={selected
            ? "/images/ikonlar/tir-siluet-selected.svg"
            : "/images/ikonlar/tir-siluet-neutral.svg"}
          alt=""
          aria-hidden="true"
          fill
          sizes="220px"
          className="[transform:scaleX(-1)] object-contain object-center"
        />
        <p
          data-testid="pdp-vehicle-capacity"
          className="absolute left-[4%] top-[17%] whitespace-nowrap font-heading text-2xl font-extrabold leading-none tracking-[-0.035em] text-black"
        >
          {fmt(capacity, 1)} m²
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="pdp-vehicle-icon-lorry"
      className="relative mx-auto h-[70px] w-[134px] max-w-full shrink-0"
    >
      <Image
        src={selected
          ? "/images/ikonlar/kamyon-siluet-selected.svg"
          : "/images/ikonlar/kamyon-siluet-neutral.svg"}
        alt=""
        aria-hidden="true"
        fill
        sizes="197px"
        className="[transform:scaleX(-1)] object-contain object-center"
      />
      <p
        data-testid="pdp-vehicle-capacity"
        className="absolute left-[4%] top-[17%] whitespace-nowrap font-heading text-2xl font-extrabold leading-none tracking-[-0.035em] text-black"
      >
        {fmt(capacity, 1)} m²
      </p>
    </div>
  );
}

function AracKarti({
  label,
  roleLabel,
  capacity,
  price,
  avantaj,
  count,
  onIncrement,
  onDecrement,
  available,
  compact,
  presentation = "default",
}: {
  label: string;
  roleLabel?: string;
  capacity: number;
  price: number | null;
  avantaj: number | null;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  available: boolean;
  compact?: boolean;
  presentation?: "default" | "commercial";
}) {
  if (!available) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border border-fe-border/30 bg-fe-raised/20 opacity-40 ${compact ? "p-2" : "p-4"}`}>
        <p className="text-[11px] text-fe-muted">Bu kalınlıkta</p>
        <p className="text-[11px] text-fe-muted">{label} yok</p>
      </div>
    );
  }

  if (presentation === "commercial") {
    const vehicleType = label === "TIR" ? "truck" : "lorry";
    const vehicleTotal = price !== null ? capacity * price : null;
    const isSelected = count > 0;
    const accessiblePrice = vehicleTotal !== null ? `${fmt(vehicleTotal, 0)} Türk lirası araç toplamı` : "fiyat teklif ile";

    return (
      <div
        data-testid="pdp-commercial-vehicle-card"
        className={`relative min-h-[224px] overflow-hidden rounded-[14px] border-2 p-4 transition-colors sm:p-5 ${
          isSelected
            ? "border-[#8a5f1d] bg-[#f8eddb]"
            : "border-[#d4c7b5] bg-white hover:border-[#a98b60]"
        }`}
      >
        <button
          type="button"
          className="absolute inset-0 z-0 rounded-[12px] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-4px] focus-visible:outline-[#704c17]"
          onClick={isSelected ? onDecrement : onIncrement}
          aria-pressed={isSelected}
          aria-label={`${isSelected ? `1 ${label} azalt` : `1 ${label} seç`}: ${fmt(capacity, 1)} metrekare, ${accessiblePrice}`}
        />

        <div className="pointer-events-none relative z-[1] flex h-full flex-col">
          <div className="flex min-h-7 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <p className="whitespace-nowrap font-heading text-lg font-extrabold uppercase tracking-[0.03em] text-[#282219] sm:text-xl">
                1 {label}
              </p>
              {roleLabel && (
                <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${roleLabel === "Önerilen" ? "bg-[#704c17] !text-[#fffaf2]" : "bg-[#eee5d8] text-[#625a4f]"}`}>
                  {roleLabel}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex h-[70px] items-end">
            <CommercialVehicleIcon type={vehicleType} capacity={capacity} selected={isSelected} />
          </div>

          <div className="mt-3">
            {vehicleTotal !== null ? (
              <>
                <p data-testid="pdp-vehicle-total" className="mt-2 whitespace-nowrap font-heading text-[2rem] font-extrabold leading-none tracking-[-0.03em] text-[#201c17] sm:text-[2.25rem]">
                  {fmt(vehicleTotal, 0)} ₺
                </p>
                <p className="mt-1 text-xs font-semibold text-[#625a4f]">
                  Araç toplamı · KDV hariç
                </p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className="max-w-[18ch] text-xs leading-4 text-[#625a4f]">
                    {fmt(price ?? 0)} ₺/m² · tam araçta nakliye dahil
                  </p>
                  <div className="pointer-events-auto relative z-10 flex items-center gap-1.5">
                    <CounterButton onClick={onDecrement} disabled={count === 0} ariaLabel={`${label} adetini bir azalt`} commercial>
                      <Minus className="h-4 w-4" />
                    </CounterButton>
                    <span className="min-w-7 text-center font-heading text-lg font-extrabold text-[#282219]" aria-live="polite" aria-atomic="true">
                      {count}
                    </span>
                    <CounterButton onClick={onIncrement} ariaLabel={`${label} adetini bir artır`} commercial>
                      <Plus className="h-4 w-4" />
                    </CounterButton>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm font-semibold text-[#625a4f]">Fiyat teklif ile belirlenir</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Compact (dar slot/portal): yatay düzen — sol içerik, sağda counter
  if (compact) {
    return (
      <div
        className={`relative rounded-xl border p-2.5 transition-all ${
          count > 0
            ? "border-brand-500/40 bg-brand-500/8 shadow-[0_0_0_1px_rgba(212,132,90,0.12)]"
            : "border-fe-border bg-fe-raised/50"
        }`}
      >
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
            {count}
          </span>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {roleLabel && (
              <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] leading-none ${
                roleLabel === "Önerilen" ? "text-brand-400" : "text-fe-muted"
              }`}>
                {roleLabel}
              </p>
            )}
            <p className="mt-1 text-sm font-semibold leading-none text-fe-text">{label}</p>
            <p className="mt-1.5 text-xs leading-none text-fe-muted">{fmt(capacity, 0)} m²</p>
            {price !== null ? (
              <p className="mt-1.5 text-xs font-bold leading-tight text-white">
                {fmt(price)}<span className="text-[10px] font-normal text-fe-muted"> ₺/m² · KDV hariç</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-fe-muted">Fiyat teklif ile</p>
            )}
            {avantaj !== null && avantaj > 0 && (
              <div className="mt-1.5 inline-flex items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-1 text-[10px] font-medium leading-none text-emerald-300">
                ↓ {fmt(avantaj)} ₺ avantaj
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1">
            <CounterButton
              onClick={onIncrement}
              ariaLabel={`${label} adetini bir artır`}
            >
              <Plus className="h-3.5 w-3.5" />
            </CounterButton>
            <span
              className="min-w-[1.25rem] text-center text-[13px] font-bold leading-none text-fe-text"
              aria-live="polite"
              aria-atomic="true"
            >
              {count}
            </span>
            <CounterButton
              onClick={onDecrement}
              disabled={count === 0}
              ariaLabel={`${label} adetini bir azalt`}
            >
              <Minus className="h-3.5 w-3.5" />
            </CounterButton>
          </div>
        </div>
      </div>
    );
  }

  // Standart (geniş alan): mevcut dikey düzen
  return (
    <div
      className={`relative rounded-2xl border p-4 transition-all ${
        count > 0
          ? "border-brand-500/40 bg-brand-500/8 shadow-[0_0_0_1px_rgba(212,132,90,0.12)]"
          : "border-fe-border bg-fe-raised/50"
      }`}
    >
      {count > 0 && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
          {count}
        </span>
      )}

      {roleLabel && (
        <p className={`mb-1.5 text-[9px] font-semibold uppercase tracking-wider ${
          roleLabel === "Önerilen" ? "text-brand-400" : "text-fe-muted"
        }`}>
          {roleLabel}
        </p>
      )}
      <p className="mb-1 text-sm font-semibold text-fe-text">{label}</p>
      <p className="mb-0.5 text-[11px] text-fe-muted">{fmt(capacity, 0)} m²</p>

      {price !== null ? (
        <p className="mb-3 text-[13px] font-bold text-white">
          {fmt(price)}{" "}
          <span className="text-[10px] font-normal text-fe-muted">₺/m² · KDV hariç</span>
        </p>
      ) : (
        <p className="mb-3 text-[13px] text-fe-muted">Fiyat teklif ile</p>
      )}

      {avantaj !== null && avantaj > 0 && (
        <div className="mb-3 inline-flex items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          ↓ {fmt(avantaj)} ₺ avantaj
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <CounterButton
          onClick={onDecrement}
          disabled={count === 0}
          ariaLabel={`${label} adetini bir azalt`}
        >
          <Minus className="h-4 w-4" />
        </CounterButton>

        <span
          className="min-w-[2rem] text-center text-lg font-bold text-fe-text"
          aria-live="polite"
          aria-atomic="true"
        >
          {count}
        </span>

        <CounterButton onClick={onIncrement} ariaLabel={`${label} adetini bir artır`}>
          <Plus className="h-4 w-4" />
        </CounterButton>
      </div>
    </div>
  );
}

interface VehicleCardsProps {
  // Kamyon
  kamyon: number;
  lorryM2: number;
  lorryPrice: number | null;
  lorryAvantaj: number | null;
  lorryRoleLabel: string;
  onKamyonInc: () => void;
  onKamyonDec: () => void;
  // TIR
  tir: number;
  truckM2: number;
  truckPrice: number | null;
  truckAvantaj: number | null;
  truckRoleLabel: string;
  onTirInc: () => void;
  onTirDec: () => void;
  // Sepet Özeti (opsiyonel)
  showSummary?: boolean;
  totalM2?: number;
  totalTL?: number;
  fazlaM2?: number;
  /** "horizontal" (default): yan yana 2 kolon · "vertical": dar slot için alt alta */
  layout?: "horizontal" | "vertical";
  presentation?: "default" | "commercial";
}

function SepetVehicleCardsImpl({
  kamyon,
  lorryM2,
  lorryPrice,
  lorryAvantaj,
  lorryRoleLabel,
  onKamyonInc,
  onKamyonDec,
  tir,
  truckM2,
  truckPrice,
  truckAvantaj,
  truckRoleLabel,
  onTirInc,
  onTirDec,
  showSummary = false,
  totalM2 = 0,
  totalTL = 0,
  fazlaM2 = 0,
  layout = "horizontal",
  presentation = "default",
}: VehicleCardsProps) {
  const isVertical = layout === "vertical";
  const gridCls = presentation === "commercial"
    ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
    : isVertical ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-3";
  return (
    <>
      <div className={gridCls}>
        <AracKarti
          label="Kamyon"
          roleLabel={lorryRoleLabel}
          capacity={lorryM2}
          price={lorryPrice}
          avantaj={lorryAvantaj}
          count={kamyon}
          onIncrement={onKamyonInc}
          onDecrement={onKamyonDec}
          available={lorryPrice !== null}
          compact={isVertical}
          presentation={presentation}
        />
        <AracKarti
          label="TIR"
          roleLabel={truckRoleLabel}
          capacity={truckM2}
          price={truckPrice}
          avantaj={truckAvantaj}
          count={tir}
          onIncrement={onTirInc}
          onDecrement={onTirDec}
          available={truckPrice !== null}
          compact={isVertical}
          presentation={presentation}
        />
      </div>

      {showSummary && (kamyon > 0 || tir > 0) && (
        <div
          className="mt-3 rounded-xl border border-fe-border/60 bg-fe-raised/35 px-4 py-3"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-fe-muted">Toplam Sipariş</p>
              <p className="mt-0.5 text-sm font-semibold text-fe-text">{fmt(totalM2, 0)} m²</p>
              {fazlaM2 > 0 && (
                <p className="mt-0.5 text-[10px] text-emerald-400">+{fmt(fazlaM2, 0)} m² fazla</p>
              )}
            </div>
            {totalTL > 0 && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-fe-muted">Tahmini Tutar</p>
                <p className="mt-0.5 text-base font-bold text-white">{fmt(totalTL, 0)} ₺</p>
                <p className="mt-0.5 text-[10px] text-fe-muted">KDV hariç</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const SepetVehicleCards = memo(SepetVehicleCardsImpl);
export default SepetVehicleCards;

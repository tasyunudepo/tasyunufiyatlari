"use client";

import { useId } from "react";
import { Gauge, Info, PackageOpen, Percent, TrendingDown, TrendingUp } from "lucide-react";

import { formatCurrency } from "@/lib/admin/utils";
import type { QuoteIndicators } from "@/lib/quote/quoteIndicators";

// Teklif gösterge paneli — marj kadranı ve canlı sayılar.
//
// NEDEN: 27 Temmuz 2026'da gerçek bir teklif çıkarılırken üç şey ekranda
// yoktu ve sonradan elle hesaplandı:
//   · hangi marjla fiyat verildiği (tersine mühendislikle bulundu)
//   · site fiyatına göre indirim (59.643,71 ₺ / %1,90)
//   · paket yuvarlamasından doğan artık (2.337 ₺)
// Üçü de karar değiştiren sayılar; artık kaydetmeden önce görünüyorlar.
//
// GİZLİLİK: buradaki hiçbir sayı PDF'e, WhatsApp mesajına veya müşteriye
// açık bir HTML yüzeyine yazılmaz. Panel yalnız /ofis arkasında görünür.

const HIZLI_MARJLAR = [3, 5, 8, 12];

/**
 * Kadranın üst ucu. Sahadaki marjlar %3–12 aralığında; ölçek %25'e kadar
 * uzatılınca yay neredeyse boş görünüyor ve kadran bilgi taşımıyordu.
 * Daha yüksek marj elle yazılabilir (kutu 100'e kadar kabul eder).
 */
const KADRAN_UST = 15;

interface Props {
  indicators: QuoteIndicators;
  /** Tüm maliyetli satırlar aynı marjdaysa o değer; karışıksa null. */
  uniformMarginPct: number | null;
  /** Kadranın hedef değeri — operatörün çevirdiği sayı. */
  targetMarginPct: number;
  onTargetMarginChange: (pct: number) => void;
  onApplyMargin: () => void;
  disabled?: boolean;
}

/** Marjı 240°'lik bir yaya oturtan kadran. */
function MarjKadrani({ value, label }: { value: number | null; label: string }) {
  const gradientId = useId();
  const YARICAP = 46;
  const CEVRE = 2 * Math.PI * YARICAP;
  // 240° yay = çevrenin 2/3'ü
  const YAY = CEVRE * (2 / 3);
  const oran = value == null ? 0 : Math.min(1, Math.max(0, value / KADRAN_UST));

  return (
    <svg viewBox="0 0 120 120" className="h-[104px] w-[104px] shrink-0 -rotate-[210deg]">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d9b757" />
          <stop offset="100%" stopColor="#8fd6a4" />
        </linearGradient>
      </defs>
      <circle
        cx="60" cy="60" r={YARICAP}
        fill="none" stroke="rgba(92,98,108,0.28)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${YAY} ${CEVRE}`}
      />
      <circle
        cx="60" cy="60" r={YARICAP}
        fill="none" stroke={`url(#${gradientId})`} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${YAY * oran} ${CEVRE}`}
        className="transition-[stroke-dasharray] duration-300 ease-out"
      />
      <text
        x="60" y="58"
        className="rotate-[210deg] origin-center fill-white text-[26px] font-bold tabular-nums"
        textAnchor="middle" dominantBaseline="middle"
      >
        {value == null ? "—" : `%${value.toFixed(1).replace(".", ",")}`}
      </text>
      <text
        x="60" y="78"
        className="rotate-[210deg] origin-center fill-[var(--nx-text-muted)] text-[10px] uppercase tracking-wider"
        textAnchor="middle" dominantBaseline="middle"
      >
        {label}
      </text>
    </svg>
  );
}

function Kutu({
  icon,
  baslik,
  deger,
  alt,
  ton = "notr",
  testId,
}: {
  icon: React.ReactNode;
  baslik: string;
  deger: string;
  alt?: string;
  ton?: "notr" | "iyi" | "uyari";
  testId?: string;
}) {
  const renk =
    ton === "iyi" ? "text-emerald-300" : ton === "uyari" ? "text-amber-300" : "text-white";
  return (
    <div className="rounded-xl border border-[rgba(92,98,108,0.22)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">
        {icon}
        {baslik}
      </p>
      <p className={`mt-1 text-[15px] font-semibold tabular-nums ${renk}`} data-testid={testId}>
        {deger}
      </p>
      {alt && <p className="mt-0.5 text-[10px] text-[var(--nx-text-muted)]">{alt}</p>}
    </div>
  );
}

export function QuoteIndicatorPanel({
  indicators: g,
  uniformMarginPct,
  targetMarginPct,
  onTargetMarginChange,
  onApplyMargin,
  disabled = false,
}: Props) {
  const yuzde = (n: number) => `%${n.toFixed(2).replace(".", ",")}`;
  const kismiKapsam = g.unknownCostLines > 0;

  return (
    <section
      data-testid="quote-indicators"
      className="rounded-2xl border border-[rgba(201,168,76,0.22)] bg-[linear-gradient(160deg,rgba(201,168,76,0.07),rgba(13,15,18,0.7)_55%)] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Gauge className="h-4 w-4 text-[var(--nx-gold)]" />
          Teklif göstergeleri
        </h3>
        <span className="rounded-full border border-[rgba(92,98,108,0.3)] px-2 py-0.5 text-[10px] text-[var(--nx-text-muted)]">
          yalnız ofis — belgeye yazılmaz
        </span>
      </div>

      {/* ── Marj kadranı ── */}
      <div className="mt-3 flex flex-col gap-4 rounded-xl border border-[rgba(92,98,108,0.22)] bg-[rgba(255,255,255,0.02)] p-3 sm:flex-row sm:items-center">
        <MarjKadrani value={uniformMarginPct} label="uygulanan" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="hedef-marj" className="text-[11px] uppercase tracking-wider text-[var(--nx-text-muted)]">
              Hedef marj
            </label>
            <div className="flex items-center gap-1">
              <input
                id="hedef-marj"
                value={String(targetMarginPct).replace(".", ",")}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  onTargetMarginChange(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
                }}
                inputMode="decimal"
                aria-label="Hedef marj yüzdesi"
                className="w-16 rounded-lg border border-[rgba(92,98,108,0.3)] bg-[rgba(18,20,24,0.85)] px-2 py-1 text-right text-sm font-semibold tabular-nums text-white outline-none focus:border-[rgba(201,168,76,0.55)]"
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={KADRAN_UST}
            step={0.5}
            value={Math.min(KADRAN_UST, targetMarginPct)}
            onChange={(e) => onTargetMarginChange(Number(e.target.value))}
            aria-label="Hedef marj kadranı"
            className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[rgba(92,98,108,0.3)] accent-[var(--nx-gold)]"
          />

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {HIZLI_MARJLAR.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onTargetMarginChange(m)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
                  targetMarginPct === m
                    ? "border-[rgba(201,168,76,0.6)] bg-[rgba(201,168,76,0.18)] text-[var(--nx-gold)]"
                    : "border-[rgba(92,98,108,0.28)] text-slate-400 hover:border-[rgba(201,168,76,0.35)] hover:text-white"
                }`}
              >
                %{m}
              </button>
            ))}
            <button
              type="button"
              onClick={onApplyMargin}
              disabled={disabled}
              data-testid="apply-margin"
              className="ml-auto rounded-lg bg-[var(--nx-gold)] px-3 py-1.5 text-[11px] font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Fiyatlara uygula
            </button>
          </div>

          {uniformMarginPct == null && g.knownCost > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-200/80">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Kalemler farklı marjlarda — kadran tek değer gösteremiyor.
              &ldquo;Fiyatlara uygula&rdquo; hepsini eşitler.
            </p>
          )}
        </div>
      </div>

      {/* ── Sayılar ── */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kutu
          icon={<Percent className="h-3 w-3" />}
          baslik="m² fiyatı"
          deger={`${formatCurrency(g.pricePerM2ExVat)}`}
          alt={`KDV dahil ${formatCurrency(g.pricePerM2IncVat)}`}
          testId="gosterge-m2"
        />
        <Kutu
          icon={<TrendingUp className="h-3 w-3" />}
          baslik="Brüt kâr"
          deger={formatCurrency(g.grossProfit)}
          alt={
            kismiKapsam
              ? `${g.unknownCostLines} satırın maliyeti bilinmiyor — eksik ölçüm`
              : `maliyet ${formatCurrency(g.knownCost)}`
          }
          ton={kismiKapsam ? "uyari" : g.grossProfit > 0 ? "iyi" : "notr"}
          testId="gosterge-kar"
        />
        <Kutu
          icon={<TrendingDown className="h-3 w-3" />}
          baslik="Site fiyatına göre"
          deger={g.siteDiff > 0 ? `−${formatCurrency(g.siteDiff)}` : "fark yok"}
          alt={g.siteDiff > 0 ? `${yuzde(g.siteDiffPct)} indirim yapıldı` : "liste fiyatından"}
          ton={g.siteDiff > 0 ? "uyari" : "notr"}
          testId="gosterge-site-farki"
        />
        <Kutu
          icon={<PackageOpen className="h-3 w-3" />}
          baslik="Paket artığı"
          deger={g.surplusValue > 0 ? formatCurrency(g.surplusValue) : "—"}
          alt="yuvarlamadan doğan fazla malzeme"
          ton={g.surplusValue > 0 ? "uyari" : "notr"}
          testId="gosterge-artik"
        />
      </div>
    </section>
  );
}

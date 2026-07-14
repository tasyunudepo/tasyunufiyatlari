"use client";

import { useEffect, useState } from "react";
import {
  citySubRegionQuestion,
  type BonusSubRegionChoice,
} from "@/lib/pricing/bonus/subRegions";

// ============================================================
// Bonus PDP canlı bölge fiyatı (Faz 2)
//
// Fiyat SUNUCUDA hesaplanır (/api/bonus-price: bölge listesi + marka
// marjı); bu bileşene yalnız nihai satış fiyatı iner. Taban fiyat,
// bayi iskontosu ve marj istemci yüzeyine çıkmaz. Sayfa statik kalır;
// fetch tarayıcıda çalışır (ISR/revalidate eklenmez).
// ============================================================

const SUB_LABELS: Record<BonusSubRegionChoice, string> = {
  avrupa: "Avrupa Yakası",
  anadolu: "Anadolu Yakası",
  gebze: "Gebze",
  diger: "Merkez ve diğer ilçeler",
};

interface BonusPriceResponse {
  ok: boolean;
  reason?: string;
  salePricePerM2?: number;
  packageM2?: number;
  kamyonM2?: number;
  tirM2?: number;
}

type FetchState =
  | { status: "idle" | "loading" }
  | { status: "ok"; data: Required<Pick<BonusPriceResponse, "salePricePerM2" | "kamyonM2" | "tirM2">> }
  | { status: "error"; reason: string };

interface BonusRegionPriceProps {
  modelShortName: string;
  thicknessCm: number | null;
  cityCode: number;
  cityName: string;
}

// Alt bölgeli şehirlerde ilk seçenek varsayılan gelir (İstanbul → Avrupa
// Yakası, Kocaeli → Gebze): fiyat beklemeden görünür, tek tıkla değişir.
function defaultSubChoice(cityCode: number): BonusSubRegionChoice | null {
  const info = citySubRegionQuestion(cityCode);
  if (!info) return null;
  const keys = Object.keys(info.options) as BonusSubRegionChoice[];
  return keys[0] ?? null;
}

export default function BonusRegionPrice({
  modelShortName,
  thicknessCm,
  cityCode,
  cityName,
}: BonusRegionPriceProps) {
  const [subChoice, setSubChoice] = useState<BonusSubRegionChoice | null>(
    () => defaultSubChoice(cityCode),
  );
  const [state, setState] = useState<FetchState>({ status: "idle" });

  const subInfo = citySubRegionQuestion(cityCode);

  // Şehir değişince o şehrin varsayılan yaka/bölge seçimine dön.
  useEffect(() => {
    setSubChoice(defaultSubChoice(cityCode));
  }, [cityCode]);

  useEffect(() => {
    if (!thicknessCm || thicknessCm <= 0) {
      setState({ status: "idle" });
      return;
    }
    if (subInfo && !subChoice) {
      // Alt bölge seçilmeden kesin fiyat gösterilmez (fail-closed).
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    const params = new URLSearchParams({
      model: modelShortName,
      thicknessCm: String(thicknessCm),
      cityCode: String(cityCode),
    });
    if (subChoice) params.set("sub", subChoice);

    fetch(`/api/bonus-price?${params.toString()}`)
      .then((res) => res.json().then((json: BonusPriceResponse) => ({ okHttp: res.ok, json })))
      .then(({ okHttp, json }) => {
        if (cancelled) return;
        if (
          okHttp &&
          json?.ok &&
          typeof json.salePricePerM2 === "number" &&
          typeof json.kamyonM2 === "number" &&
          typeof json.tirM2 === "number"
        ) {
          setState({
            status: "ok",
            data: {
              salePricePerM2: json.salePricePerM2,
              kamyonM2: json.kamyonM2,
              tirM2: json.tirM2,
            },
          });
        } else {
          setState({ status: "error", reason: json?.reason ?? "unknown" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", reason: "network" });
      });

    return () => {
      cancelled = true;
    };
  }, [modelShortName, thicknessCm, cityCode, subChoice, subInfo]);

  const fmt = (n: number, digits = 2) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const subLabel = subChoice ? ` (${SUB_LABELS[subChoice]})` : "";

  return (
    <div
      className="rounded-xl border border-brand-500/25 bg-fe-raised/40 p-4"
      data-testid="bonus-region-price"
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-fe-muted-strong">
        Bölge Fiyatı · Levha m²
      </p>

      {subInfo && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs text-fe-muted">
            {subInfo.question === "yaka"
              ? "Fiyat yakaya göre değişir — teslimat yakası:"
              : "Fiyat bölgeye göre değişir — teslimat bölgesi:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(subInfo.options) as BonusSubRegionChoice[]).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setSubChoice(choice)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  subChoice === choice
                    ? "border-brand-500 bg-brand-900/30 text-brand-300"
                    : "border-fe-border bg-fe-raised/60 text-fe-text hover:border-brand-500/40"
                }`}
              >
                {SUB_LABELS[choice]}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.status === "loading" && (
        <p className="text-sm text-fe-muted" aria-live="polite">Bölge fiyatı hesaplanıyor…</p>
      )}

      {state.status === "idle" && subInfo && !subChoice && (
        <p className="text-sm text-fe-muted">Seçim yapınca üreticinin bölge listesine göre m² fiyatı burada görünür.</p>
      )}

      {state.status === "ok" && (
        <div aria-live="polite">
          <p className="text-2xl font-extrabold leading-none text-white">
            {fmt(state.data.salePricePerM2)}
            <span className="ml-1 text-brand-300">₺/m²</span>
          </p>
          <p className="mt-1 text-[11px] leading-snug text-fe-muted-strong">
            KDV hariç · {modelShortName} · {thicknessCm} cm · {cityName}
            {subLabel} teslim
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-fe-muted">
            Tam kamyon ({fmt(state.data.kamyonM2, 1)} m²) veya tam TIR ({fmt(state.data.tirM2, 1)} m²)
            sevkiyatında nakliye fiyata dahildir; ara metraja teklif oluşturulmaz.
            Toz grubu dahil komple set fiyatı hesaplayıcıdadır.
          </p>
        </div>
      )}

      {state.status === "error" && (
        <p className="text-sm text-fe-muted">
          {state.reason === "thickness_unavailable"
            ? "Bu kalınlık üreticinin fiyat listesinde yer almıyor; farklı bir kalınlık seçin."
            : "Bölge fiyatı şu anda hesaplanamıyor; hesaplayıcıyı kullanın veya bizimle iletişime geçin."}
        </p>
      )}
    </div>
  );
}

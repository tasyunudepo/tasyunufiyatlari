"use client";

import { useEffect, useState } from "react";
import {
  citySubRegionQuestion,
  type BonusSubRegionChoice,
} from "@/lib/pricing/bonus/subRegions";
import { buildBonusPlateOrder } from "@/lib/pricing/bonus/packageAssembly";
import SingleProductQuoteButton from "./SingleProductQuoteButton";
import type { CatalogProductView } from "@/lib/catalog/types";

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
  | { status: "ok"; data: Required<Pick<BonusPriceResponse, "salePricePerM2" | "kamyonM2" | "tirM2" | "packageM2">> }
  | { status: "error"; reason: string };

interface BonusRegionPriceProps {
  modelShortName: string;
  thicknessCm: number | null;
  cityCode: number;
  cityName: string;
  // PDF teklif köprüsü (opsiyonel): verilirse "seçili araç planıyla"
  // PDF teklif butonu ve WhatsApp teyit satırı gösterilir. Bonus PDP'si
  // Direkt Alım'a geçince (single_only + from_price) bunlar dolu gelir.
  product?: CatalogProductView;
  activeThicknessCm?: number | null;
  resultSessionId?: string;
}

// Bonus sevkiyatı tam araçla yapılır — PDF hangi araç planıyla çıkacak.
type BonusVehicle = "kamyon" | "tir";

// Alt bölgeli şehirlerde ilk seçenek varsayılan gelir (İstanbul → Avrupa
// Yakası, Kocaeli → Gebze): fiyat beklemeden görünür, tek tıkla değişir.
export function defaultSubChoice(cityCode: number): BonusSubRegionChoice | null {
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
  product,
  activeThicknessCm,
  resultSessionId,
}: BonusRegionPriceProps) {
  const [subChoice, setSubChoice] = useState<BonusSubRegionChoice | null>(
    () => defaultSubChoice(cityCode),
  );
  const [state, setState] = useState<FetchState>({ status: "idle" });
  // PDF hangi tam-araç planıyla çıkacak — varsayılan Kamyon.
  const [vehicle, setVehicle] = useState<BonusVehicle>("kamyon");

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
          typeof json.tirM2 === "number" &&
          typeof json.packageM2 === "number"
        ) {
          setState({
            status: "ok",
            data: {
              salePricePerM2: json.salePricePerM2,
              kamyonM2: json.kamyonM2,
              tirM2: json.tirM2,
              packageM2: json.packageM2,
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

          {/* Araç toplamları (Sprint 1.4): müşteri sayfadan ayrılmadan
              cebinden çıkacak gerçek tutarı görür. Metrajlar paket katına
              oturtulur — wizard/PDF ile kuruşu kuruşuna aynı hesap.
              PDF köprüsü varsa (product dolu) araç seçilebilir ve seçili
              tam-araç planıyla PDF teklif çıkar. */}
          {(() => {
            const kamyon = buildBonusPlateOrder(
              { salePricePerM2: state.data.salePricePerM2, packageM2: state.data.packageM2 },
              state.data.kamyonM2,
            );
            const tir = buildBonusPlateOrder(
              { salePricePerM2: state.data.salePricePerM2, packageM2: state.data.packageM2 },
              state.data.tirM2,
            );
            if (!kamyon || !tir) return null;
            const pdfEnabled = product != null;
            const selected = vehicle === "kamyon" ? kamyon : tir;
            // Ekranda snap'li orderM2 (paket gerçekliği) gösterilir; ancak
            // /api/quotes tam-araç doğrulaması ham kapasiteyi (kamyonM2/tirM2)
            // bekler — snap 2 cm² aşağı düşürünce "minimum m² gereklidir" ile
            // reddediyordu. PDF/kayıt ham kapasiteyle gider (kanonik değer,
            // eski tam-araç teklifleriyle tutarlı).
            const capacityM2 = vehicle === "kamyon" ? state.data.kamyonM2 : state.data.tirM2;
            const rowClass = (v: BonusVehicle) =>
              `flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                pdfEnabled ? "cursor-pointer" : ""
              } ${
                pdfEnabled && vehicle === v
                  ? "bg-brand-900/30 ring-1 ring-brand-500/50"
                  : pdfEnabled
                    ? "hover:bg-fe-raised/60"
                    : ""
              }`;
            return (
              <div className="mt-3 space-y-1 rounded-lg border border-fe-border/60 bg-fe-bg/40 p-2.5">
                {pdfEnabled ? (
                  <>
                    <button type="button" onClick={() => setVehicle("kamyon")} className={`w-full text-left ${rowClass("kamyon")}`} aria-pressed={vehicle === "kamyon"}>
                      <span className={vehicle === "kamyon" ? "font-semibold text-brand-200" : "text-fe-muted"}>
                        1 Kamyon · {fmt(kamyon.orderM2, 1)} m²
                      </span>
                      <span className="font-bold tabular-nums text-white">{fmt(kamyon.totalExVat)} ₺</span>
                    </button>
                    <button type="button" onClick={() => setVehicle("tir")} className={`w-full text-left ${rowClass("tir")}`} aria-pressed={vehicle === "tir"}>
                      <span className={vehicle === "tir" ? "font-semibold text-brand-200" : "text-fe-muted"}>
                        1 TIR · {fmt(tir.orderM2, 1)} m²
                      </span>
                      <span className="font-bold tabular-nums text-white">{fmt(tir.totalExVat)} ₺</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className={rowClass("kamyon")}>
                      <span className="text-fe-muted">1 Kamyon · {fmt(kamyon.orderM2, 1)} m²</span>
                      <span className="font-bold tabular-nums text-white">{fmt(kamyon.totalExVat)} ₺</span>
                    </div>
                    <div className={rowClass("tir")}>
                      <span className="text-fe-muted">1 TIR · {fmt(tir.orderM2, 1)} m²</span>
                      <span className="font-bold tabular-nums text-white">{fmt(tir.totalExVat)} ₺</span>
                    </div>
                  </>
                )}
                <p className="px-2 text-[10px] leading-snug text-fe-muted">
                  Levha toplamı · KDV hariç · nakliye fiyata dahil
                </p>

                {/* PDF teklif — seçili tam-araç planıyla (Expert paritesi) */}
                {pdfEnabled && product && (
                  <div className="mt-2 border-t border-fe-border/50 pt-2.5">
                    <SingleProductQuoteButton
                      product={product}
                      activeThickness={activeThicknessCm ?? thicknessCm ?? null}
                      pricePerM2KdvHaric={state.data.salePricePerM2}
                      neededM2={capacityM2}
                      cityCode={cityCode}
                      cityName={cityName}
                      tierLabel={vehicle === "kamyon" ? "Kamyon" : "TIR"}
                      isShippingIncluded={true}
                      vehicleType={vehicle === "kamyon" ? "lorry" : "truck"}
                      label={`PDF teklifimi hazırla · 1 ${vehicle === "kamyon" ? "Kamyon" : "TIR"}`}
                      resultSessionId={resultSessionId}
                      packageSizeM2={state.data.packageM2}
                    />
                    <p className="mt-1.5 text-center text-[10px] leading-snug text-fe-muted">
                      Seçili tam araç planıyla ({vehicle === "kamyon" ? "1 Kamyon" : "1 TIR"} ·{" "}
                      {fmt(selected.orderM2, 1)} m²) hazırlanır.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          <p className="mt-2 text-[11px] leading-relaxed text-fe-muted">
            Sevkiyat tam kamyon / tam TIR veya kombinasyonuyla yapılır; ara
            metraja teklif oluşturulmaz. Toz grubu dahil komple set fiyatı
            hesaplayıcıdadır.
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

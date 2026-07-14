"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  citySubRegionQuestion,
  type BonusSubRegionChoice,
} from "@/lib/pricing/bonus/subRegions";
import { defaultSubChoice } from "./BonusRegionPrice";
import { getBonusChallengerModel } from "@/lib/pricing/comparison/bonusChallenge";
import { getProfileByModel, densityWithSourceLabel } from "@/lib/technical-profiles";
import { useWizardStore } from "@/lib/store/wizardStore";
import {
  notifyBonusChallengeShown,
  notifyBonusChallengePicked,
} from "@/lib/notifyWizardEvent";

// ============================================================
// Filli grubu PDP'sinde Bonus alternatif kartı (Sprint 1.3)
//
// Kural (hakem, Sprint 1.1): rakip model teknik profillerin yoğunluk
// bandından seçilir; iki fiyat ancak aynı şehir + alt bölge + kalınlık +
// LEVHA kapsamı + KDV hariç + tam araç koşulunda yan yana gelir. Fark
// rozeti yalnız Bonus gerçekten düşükse görünür — sabit iddia yok.
// Bonus fiyatı sunucudan (taban/iskonto istemciye inmez).
// ============================================================

const SUB_LABELS: Record<BonusSubRegionChoice, string> = {
  avrupa: "Avrupa Yakası",
  anadolu: "Anadolu Yakası",
  gebze: "Gebze",
  diger: "Merkez ve diğer ilçeler",
};

interface BonusAlternativeCardProps {
  /** Bu PDP'nin modeli (örn. HD150) */
  sourceModel: string;
  sourceBrandName: string;
  thicknessCm: number | null;
  cityCode: number;
  cityName: string;
  /** Bu ürünün tam araç (TIR) levha m² fiyatı — KDV hariç, gerçek hesap */
  currentUnitPriceExVat: number | null;
}

type PriceState =
  | { status: "idle" | "loading" }
  | { status: "ok"; salePricePerM2: number }
  | { status: "unavailable" };

export default function BonusAlternativeCard({
  sourceModel,
  sourceBrandName,
  thicknessCm,
  cityCode,
  cityName,
  currentUnitPriceExVat,
}: BonusAlternativeCardProps) {
  const router = useRouter();
  const challenger = getBonusChallengerModel(sourceModel);
  const [subChoice, setSubChoice] = useState<BonusSubRegionChoice | null>(
    () => defaultSubChoice(cityCode),
  );
  const [state, setState] = useState<PriceState>({ status: "idle" });
  const shownEventFired = useRef(false);

  const subInfo = citySubRegionQuestion(cityCode);

  useEffect(() => {
    setSubChoice(defaultSubChoice(cityCode));
  }, [cityCode]);

  useEffect(() => {
    if (!challenger || !thicknessCm || thicknessCm <= 0) {
      setState({ status: "idle" });
      return;
    }
    if (subInfo && !subChoice) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const params = new URLSearchParams({
      model: challenger,
      thicknessCm: String(thicknessCm),
      cityCode: String(cityCode),
    });
    if (subChoice) params.set("sub", subChoice);
    fetch(`/api/bonus-price?${params.toString()}`)
      .then((res) => res.json().then((json) => ({ okHttp: res.ok, json })))
      .then(({ okHttp, json }) => {
        if (cancelled) return;
        if (okHttp && json?.ok && typeof json.salePricePerM2 === "number") {
          setState({ status: "ok", salePricePerM2: json.salePricePerM2 });
        } else {
          // Kalınlık Bonus listesinde yoksa kıyas koşulu sağlanamaz → kart sussun.
          setState({ status: "unavailable" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => { cancelled = true; };
  }, [challenger, thicknessCm, cityCode, subChoice, subInfo]);

  // Ölçüm: kıyas gerçekten göründüğünde bir kez.
  const unitDiff =
    state.status === "ok" && currentUnitPriceExVat != null && currentUnitPriceExVat > 0
      ? Math.round((currentUnitPriceExVat - state.salePricePerM2) * 100) / 100
      : null;

  useEffect(() => {
    if (state.status !== "ok" || shownEventFired.current) return;
    shownEventFired.current = true;
    notifyBonusChallengeShown({
      surface: "pdp",
      rakip_marka: sourceBrandName,
      rakip_model: sourceModel,
      bonus_model: challenger,
      unit_diff_tl: unitDiff,
      city_code: cityCode,
      thickness_cm: thicknessCm,
    });
  }, [state.status, sourceBrandName, sourceModel, challenger, unitDiff, cityCode, thicknessCm]);

  if (!challenger || state.status === "unavailable") return null;

  const bonusProfile = getProfileByModel(challenger);
  const fmt = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function handlePick() {
    notifyBonusChallengePicked({
      surface: "pdp",
      rakip_marka: sourceBrandName,
      rakip_model: sourceModel,
      bonus_model: challenger,
      unit_diff_tl: unitDiff,
      city_code: cityCode,
      thickness_cm: thicknessCm,
    });
    const store = useWizardStore.getState();
    store.reset();
    store.setProductPreset({
      material: "tasyunu",
      thicknessCm: thicknessCm ?? 5,
      brandName: "Bonus",
      modelShortName: challenger ?? undefined,
    });
    // Çapasız '/' hero'ya bırakıyordu; müşteri hesaplayıcıyı görmeden
    // kayboluyordu — doğrudan hesaplayıcıya in.
    router.push("/#mantolama-hesaplayici");
  }

  return (
    <div
      className="rounded-xl border border-brand-500/30 bg-brand-950/15 p-4"
      data-testid="bonus-alternative-card"
    >
      <p className="mb-1 text-sm font-semibold leading-snug text-fe-text">
        Bu ürünün Bonus alternatifi: Bonus {challenger}
      </p>
      {bonusProfile && (
        <p className="mb-3 text-[11px] text-fe-muted">
          {densityWithSourceLabel(bonusProfile)} · {bonusProfile.fireClass} yanmaz
        </p>
      )}

      {subInfo && (
        <div className="mb-3 flex flex-wrap gap-2">
          {(Object.keys(subInfo.options) as BonusSubRegionChoice[]).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setSubChoice(choice)}
              className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                subChoice === choice
                  ? "border-brand-500 bg-brand-900/30 text-brand-300"
                  : "border-fe-border bg-fe-raised/60 text-fe-text hover:border-brand-500/40"
              }`}
            >
              {SUB_LABELS[choice]}
            </button>
          ))}
        </div>
      )}

      {state.status === "ok" && (
        <div aria-live="polite">
          {currentUnitPriceExVat != null && currentUnitPriceExVat > 0 && (
            <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-fe-border/60 bg-fe-bg/40 p-2">
                <p className="text-[10px] uppercase tracking-wide text-fe-muted">{sourceBrandName} {sourceModel}</p>
                <p className="font-bold tabular-nums text-white">{fmt(currentUnitPriceExVat)} ₺/m²</p>
              </div>
              <div className="rounded-lg border border-brand-500/40 bg-brand-900/20 p-2">
                <p className="text-[10px] uppercase tracking-wide text-brand-300">Bonus {challenger}</p>
                <p className="font-bold tabular-nums text-white">{fmt(state.salePricePerM2)} ₺/m²</p>
              </div>
            </div>
          )}
          {unitDiff != null && unitDiff > 0 && (
            <p className="mb-2 text-sm font-semibold text-emerald-300">
              m² başına {fmt(unitDiff)} ₺ fark — gerçek hesap sonucu
            </p>
          )}
          <p className="mb-3 text-[10px] leading-snug text-fe-muted">
            Aynı şehir: {cityName}
            {subChoice ? ` (${SUB_LABELS[subChoice]})` : ""} · aynı kalınlık: {thicknessCm} cm ·
            tam araç levha fiyatı · KDV hariç
          </p>
        </div>
      )}
      {state.status === "loading" && (
        <p className="mb-3 text-xs text-fe-muted">Bonus bölge fiyatı hesaplanıyor…</p>
      )}

      <button
        type="button"
        onClick={handlePick}
        className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-brand-500/50 bg-brand-600/90 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
      >
        Bonus {challenger} ile komple set hesapla →
      </button>
    </div>
  );
}

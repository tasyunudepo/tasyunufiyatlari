"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  getComparisonProfiles,
  densityWithSourceLabel,
  type TechnicalProfile,
} from "@/lib/technical-profiles";
import {
  citySubRegionQuestion,
  type BonusSubRegionChoice,
} from "@/lib/pricing/bonus/subRegions";
import { defaultSubChoice } from "@/components/catalog/BonusRegionPrice";
import { computeFullTruckPlateUnitPrice } from "@/lib/pricing/plateUnitPrice";
import { resolveMarginPctStrict } from "@/lib/pricing/margin";
import { useWizardStore } from "@/lib/store/wizardStore";
import {
  notifyBonusChallengePicked,
  notifyComparisonCtaClick,
  notifyComparisonOpened,
  type ComparisonEntryPlacement,
} from "@/lib/notifyWizardEvent";
import type { Plate, PlatePrice, ShippingZone, MaterialType } from "@/lib/types";

// ============================================================
// Karşılaştırma Merkezi (Sprint 2) — 8 ürün, aynı koşulda
//
// Teknik değerler yalnız teknik profillerden (föy etiketli; sözlü
// beyanlar "Üretici sözlü beyanı — değişken"). Ticari kıyas tek koşul
// setinde: seçilen şehir(+yaka) + kalınlık + tam araç levha m² + KDV
// hariç. Filli fiyatları tek kaynaklı formülden (plateUnitPrice),
// Bonus fiyatı sunucudan. Koşul sağlanamayan hücre fiyat GÖSTERMEZ.
// "Pro" adı otomatik üstünlük olarak sunulmaz (kilitli karar 6).
// ============================================================

const SUB_LABELS: Record<BonusSubRegionChoice, string> = {
  avrupa: "Avrupa Yakası",
  anadolu: "Anadolu Yakası",
  gebze: "Gebze",
  diger: "Merkez ve diğer ilçeler",
};

const THICKNESS_OPTIONS = [3, 4, 5, 6, 7, 8, 10, 12, 15];
const COMPARISON_ENTRY_PLACEMENTS = new Set<ComparisonEntryPlacement>([
  "direct",
  "category",
  "pdp",
  "wizard",
  "density_150",
  "unknown",
]);

const createComparisonSessionId = () =>
  `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const formatSourceDate = (isoDate: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));

function readEntryPlacement(): ComparisonEntryPlacement {
  if (typeof window === "undefined") return "direct";
  const value = new URLSearchParams(window.location.search).get("entry") ?? "direct";
  return COMPARISON_ENTRY_PLACEMENTS.has(value as ComparisonEntryPlacement)
    ? (value as ComparisonEntryPlacement)
    : "unknown";
}

interface ComparisonCenterProps {
  variant: "genel" | "yogunluk_150";
}

type PriceCell =
  | { status: "loading" }
  | { status: "ok"; unit: number }
  | { status: "unavailable" }
  | { status: "error" };

export default function ComparisonCenter({ variant }: ComparisonCenterProps) {
  const profiles = useMemo(() => {
    const all = getComparisonProfiles();
    if (variant !== "yogunluk_150") return all;
    // 150 görünümü: föy-beyanlı 150'likler önce, kalanlar bağlamda kalır.
    const is150 = (p: (typeof all)[number]) =>
      p.density.sourceType === "datasheet" && p.density.minKgM3 >= 150;
    return [...all.filter(is150), ...all.filter((p) => !is150(p))];
  }, [variant]);

  const [plates, setPlates] = useState<Plate[]>([]);
  const [platePrices, setPlatePrices] = useState<PlatePrice[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [cityCode, setCityCode] = useState<number>(34);
  const [subChoice, setSubChoice] = useState<BonusSubRegionChoice | null>(() => defaultSubChoice(34));
  const [thicknessCm, setThicknessCm] = useState<number>(5);
  const [bonusPrices, setBonusPrices] = useState<Record<string, PriceCell>>({});
  const [comparisonDataError, setComparisonDataError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [comparisonSessionId] = useState(createComparisonSessionId);
  const entryPlacementRef = useRef<ComparisonEntryPlacement>("direct");

  useEffect(() => {
    entryPlacementRef.current = readEntryPlacement();
    notifyComparisonOpened({
      surface: variant,
      urun_sayisi: profiles.length,
      entry_placement: entryPlacementRef.current,
      comparison_session_id: comparisonSessionId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setComparisonDataError(false);
      const [platesRes, ppRes, zonesRes, mtRes] = await Promise.all([
        supabase.from("plates").select("*").eq("is_active", true),
        supabase.from("plate_prices").select("*"),
        supabase.from("shipping_zones").select("*").order("city_name"),
        supabase.from("material_types").select("*"),
      ]);
      if (cancelled) return;
      if (platesRes.error || ppRes.error || zonesRes.error || mtRes.error) {
        setComparisonDataError(true);
      }
      if (platesRes.data) setPlates(platesRes.data);
      if (ppRes.data) setPlatePrices(ppRes.data);
      if (zonesRes.data) setZones(zonesRes.data);
      if (mtRes.data) setMaterialTypes(mtRes.data);
    }
    void load();
    return () => { cancelled = true; };
  }, [requestVersion]);

  useEffect(() => {
    setSubChoice(defaultSubChoice(cityCode));
  }, [cityCode]);

  // Bonus fiyatları sunucudan — model başına, koşul değişince yenilenir.
  useEffect(() => {
    const bonusModels = profiles.filter((p) => p.brandName === "Bonus");
    const subInfo = citySubRegionQuestion(cityCode);
    if (subInfo && !subChoice) return;
    let cancelled = false;
    setBonusPrices(Object.fromEntries(bonusModels.map((p) => [p.modelShortName, { status: "loading" as const }])));
    for (const p of bonusModels) {
      const params = new URLSearchParams({
        model: p.modelShortName,
        thicknessCm: String(thicknessCm),
        cityCode: String(cityCode),
      });
      if (subChoice) params.set("sub", subChoice);
      fetch(`/api/bonus-price?${params.toString()}`)
        .then(async (res) => ({
          okHttp: res.ok,
          status: res.status,
          json: await res.json().catch(() => null),
        }))
        .then(({ okHttp, status, json }) => {
          if (cancelled) return;
          setBonusPrices((prev) => ({
            ...prev,
            [p.modelShortName]:
              okHttp && json?.ok && typeof json.salePricePerM2 === "number"
                ? { status: "ok", unit: json.salePricePerM2 }
                : !okHttp && status >= 500
                  ? { status: "error" }
                  : { status: "unavailable" },
          }));
        })
        .catch(() => {
          if (!cancelled) {
            setBonusPrices((prev) => ({ ...prev, [p.modelShortName]: { status: "error" } }));
          }
        });
    }
    return () => { cancelled = true; };
  }, [profiles, cityCode, subChoice, thicknessCm, requestVersion]);

  const zone = zones.find((z) => z.city_code === cityCode) ?? null;
  const tasyunuRule = materialTypes.find((m) => m.slug === "tasyunu") ?? null;
  const subInfo = citySubRegionQuestion(cityCode);
  const dataReady = plates.length > 0 && zones.length > 0;

  function priceCellFor(profile: TechnicalProfile): PriceCell {
    if (profile.brandName === "Bonus") {
      if (subInfo && !subChoice) return { status: "unavailable" };
      return bonusPrices[profile.modelShortName] ?? { status: "loading" };
    }
    if (comparisonDataError) return { status: "error" };
    if (!dataReady || !zone || !tasyunuRule) return { status: "loading" };
    const plate = plates.find(
      (pl) => pl.short_name === profile.modelShortName && pl.brand_id != null,
    );
    if (!plate) return { status: "unavailable" };
    const pp = platePrices.find(
      (row) => row.plate_id === plate.id && row.thickness === thicknessCm,
    );
    if (!pp) return { status: "unavailable" };
    const unit = computeFullTruckPlateUnitPrice({
      basePrice: Number(pp.base_price),
      isKdvIncluded: pp.is_kdv_included ?? false,
      packageM2: Number(pp.package_m2 ?? plate.package_m2 ?? 0),
      discount1Pct: Number(zone.discount_tir ?? 0),
      discount2Pct: Number(pp.discount_2 ?? plate.discount_2 ?? 0),
      marginPct: resolveMarginPctStrict(tasyunuRule, 1000),
    });
    return unit === null ? { status: "unavailable" } : { status: "ok", unit };
  }

  function slugFor(profile: TechnicalProfile): string | null {
    // Plate tipinde slug alanı yok (select * getiriyor); PDP linki için
    // satır objesinden okunur, yoksa link üretilmez.
    const plate = plates.find((pl) => pl.short_name === profile.modelShortName) as
      | (Plate & { slug?: string | null })
      | undefined;
    return plate?.slug ?? null;
  }

  function handleCalculate(profile: TechnicalProfile) {
    notifyComparisonCtaClick({
      surface: variant,
      entry_placement: entryPlacementRef.current,
      comparison_session_id: comparisonSessionId,
      brand_name: profile.brandName,
      model_name: profile.modelShortName,
      city_code: cityCode,
      thickness_cm: thicknessCm,
    });
    if (profile.brandName === "Bonus") {
      notifyBonusChallengePicked({
        surface: "comparison",
        bonus_model: profile.modelShortName,
        city_code: cityCode,
        thickness_cm: thicknessCm,
        comparison_session_id: comparisonSessionId,
      });
    }
    const store = useWizardStore.getState();
    store.reset();
    store.setProductPreset({
      material: "tasyunu",
      thicknessCm,
      brandName: profile.brandName,
      modelShortName: profile.modelShortName,
      cityCode,
      citySubRegion: subChoice,
      entrySurface: "comparison",
      comparisonSessionId,
    });
  }

  const fmt = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const conditionLine = zone
    ? `${zone.city_name}${subChoice && subInfo ? ` · ${SUB_LABELS[subChoice]}` : ""} · ${thicknessCm} cm · Tam araç levha fiyatı`
    : "";
  const hasPriceError = comparisonDataError
    || Object.values(bonusPrices).some((cell) => cell.status === "error");

  return (
    <div className="space-y-10">
      {/* ─── Teknik karşılaştırma (föy etiketli) ─── */}
      <section aria-labelledby="teknik-tablo-baslik">
        <h2 id="teknik-tablo-baslik" className="mb-1 font-heading text-xl font-bold text-white">
          Teknik karşılaştırma
        </h2>
        <p className="mb-4 text-sm text-fe-muted">
          Değerler üretici föy beyanlarıdır; föyü olmayan yoğunluklar
          &quot;üretici sözlü beyanı — değişken&quot; etiketiyle listelenir. Yüksek
          yoğunluk tek başına daha iyi ısı yalıtımı anlamına gelmez; mekanik
          değerlerin bağlamıdır.
        </p>
        <ul
          className="space-y-3 md:hidden"
          data-testid="comparison-technical-cards"
          role="list"
        >
          {profiles.map((p) => {
            const slug = slugFor(p);
            const highlight =
              variant === "yogunluk_150" &&
              p.density.sourceType === "datasheet" &&
              p.density.minKgM3 >= 150;
            const sourceLabel = densityWithSourceLabel(p).includes("sözlü")
              ? "Üretici sözlü beyanı — değişken"
              : "Föy beyanı";

            return (
              <li key={p.productKey}>
                <article
                  aria-labelledby={`mobile-tech-${p.productKey}`}
                  className={`min-w-0 rounded-xl border p-4 ${
                    highlight
                      ? "border-brand-500/50 bg-brand-950/20"
                      : "border-fe-border bg-fe-raised/30"
                  }`}
                  data-product-key={p.productKey}
                  data-testid={`comparison-technical-card-${p.productKey}`}
                >
                  <h3
                    id={`mobile-tech-${p.productKey}`}
                    className="font-heading text-base font-bold leading-snug text-white"
                  >
                    {slug ? (
                      <Link
                        href={`/urunler/tasyunu-levha/${slug}`}
                        className="rounded-sm hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                      >
                        {p.displayName}
                      </Link>
                    ) : (
                      p.displayName
                    )}
                  </h3>

                  <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-3 gap-y-3">
                    <div className="min-w-0 border-t border-fe-border/60 pt-2.5">
                      <dt className="text-xs font-medium text-fe-muted-strong">Yoğunluk</dt>
                      <dd className="mt-1 break-words text-sm font-semibold leading-snug text-fe-text">
                        {p.density.display}
                        <span className="mt-1 block text-xs font-normal leading-snug text-fe-muted">
                          {sourceLabel}
                        </span>
                      </dd>
                    </div>
                    <div className="min-w-0 border-t border-fe-border/60 pt-2.5">
                      <dt className="text-xs font-medium text-fe-muted-strong">Isı iletkenliği</dt>
                      <dd className="mt-1 break-words text-sm font-semibold leading-snug text-fe-text">
                        {p.lambdaDisplay}
                      </dd>
                    </div>
                    <div className="min-w-0 border-t border-fe-border/60 pt-2.5">
                      <dt className="text-xs font-medium text-fe-muted-strong">Yüzeye dik çekme</dt>
                      <dd className="mt-1 break-words text-sm font-semibold leading-snug text-fe-text">
                        {p.tensileDisplay}
                      </dd>
                    </div>
                    <div className="min-w-0 border-t border-fe-border/60 pt-2.5">
                      <dt className="text-xs font-medium text-fe-muted-strong">Kalınlık aralığı</dt>
                      <dd className="mt-1 break-words text-sm font-semibold leading-snug text-fe-text">
                        {p.thicknessMmMin / 10}–{p.thicknessMmMax / 10} cm
                      </dd>
                    </div>
                    <div className="col-span-2 min-w-0 border-t border-fe-border/60 pt-2.5">
                      <dt className="text-xs font-medium text-fe-muted-strong">Basma dayanımı</dt>
                      <dd className="mt-1 break-words text-sm font-semibold leading-snug text-fe-text">
                        {p.compressiveDisplay}
                      </dd>
                    </div>
                  </dl>

                  <details className="group mt-4 border-t border-fe-border/60">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-semibold text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 [&::-webkit-details-marker]:hidden">
                      Yangın ve beyan ayrıntıları
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </summary>
                    <dl className="grid gap-2 pb-2 pt-1 text-sm">
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt className="text-fe-muted-strong">Yangın sınıfı</dt>
                        <dd className="break-words text-right font-semibold text-fe-text">{p.fireClass}</dd>
                      </div>
                      {p.tensileClass && (
                        <div className="flex min-w-0 justify-between gap-3">
                          <dt className="text-fe-muted-strong">Çekme sınıfı</dt>
                          <dd className="break-words text-right font-semibold text-fe-text">{p.tensileClass}</dd>
                        </div>
                      )}
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt className="text-fe-muted-strong">Beyan türü</dt>
                        <dd className="break-words text-right font-semibold text-fe-text">{sourceLabel}</dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt className="text-fe-muted-strong">Kaynak tarihi</dt>
                        <dd className="break-words text-right font-semibold text-fe-text">
                          <time dateTime={p.density.sourceDate}>{formatSourceDate(p.density.sourceDate)}</time>
                        </dd>
                      </div>
                    </dl>
                  </details>
                </article>
              </li>
            );
          })}
        </ul>

        <div
          className="hidden overflow-x-auto rounded-xl border border-fe-border md:block"
          data-testid="comparison-technical-table"
        >
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-fe-border bg-fe-raised/50 text-left text-[11px] uppercase tracking-wide text-fe-muted">
                <th className="px-3 py-2.5">Ürün</th>
                <th className="px-3 py-2.5">Yoğunluk</th>
                <th className="px-3 py-2.5">λD (W/mK)</th>
                <th className="px-3 py-2.5">Dik çekme</th>
                <th className="px-3 py-2.5">Basma</th>
                <th className="px-3 py-2.5">Yangın</th>
                <th className="px-3 py-2.5">Kalınlık</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const slug = slugFor(p);
                const highlight =
                  variant === "yogunluk_150" &&
                  p.density.sourceType === "datasheet" &&
                  p.density.minKgM3 >= 150;
                return (
                  <tr
                    key={p.productKey}
                    className={`border-b border-fe-border/60 last:border-0 ${
                      highlight ? "bg-brand-950/20" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-white">
                      {slug ? (
                        <Link href={`/urunler/tasyunu-levha/${slug}`} className="hover:text-brand-300">
                          {p.displayName}
                        </Link>
                      ) : (
                        p.displayName
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-fe-text">
                      {p.density.display}
                      <span className="block text-[10px] text-fe-muted">
                        {densityWithSourceLabel(p).includes("sözlü")
                          ? "Üretici sözlü beyanı — değişken"
                          : "Föy beyanı"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-fe-text">{p.lambdaDisplay}</td>
                    <td className="px-3 py-2.5 text-fe-text">{p.tensileDisplay}</td>
                    <td className="px-3 py-2.5 text-fe-text">{p.compressiveDisplay}</td>
                    <td className="px-3 py-2.5 text-fe-text">{p.fireClass}</td>
                    <td className="px-3 py-2.5 text-fe-text">
                      {p.thicknessMmMin / 10}–{p.thicknessMmMax / 10} cm
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Ticari kıyas — aynı koşulda canlı fiyat ─── */}
      <section aria-labelledby="ticari-kiyas-baslik" data-testid="comparison-pricing">
        <h2 id="ticari-kiyas-baslik" className="mb-1 font-heading text-xl font-bold text-white">
          Aynı koşulda levha fiyatları
        </h2>
        <p className="mb-4 text-sm text-fe-muted">
          Şehir ve kalınlık seçin; tüm ürünlerin tam araç levha m² fiyatı aynı
          koşulda listelenir. Fiyatlar gerçek hesap sonucudur; koşulu
          sağlamayan ürün fiyat göstermez.
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="comparison-city"
              className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-fe-muted-strong"
            >
              Teslimat şehri
            </label>
            <select
              id="comparison-city"
              aria-label="Teslimat şehri"
              value={cityCode}
              onChange={(e) => setCityCode(Number(e.target.value))}
              className="min-h-11 rounded-lg border border-fe-border bg-fe-surface px-3 py-2 text-base text-fe-text [color-scheme:dark] sm:text-sm"
            >
              {zones.map((z) => (
                <option key={z.city_code} value={z.city_code}>{z.city_name}</option>
              ))}
            </select>
          </div>
          {subInfo && (
            <div className="flex gap-2">
              {(Object.keys(subInfo.options) as BonusSubRegionChoice[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setSubChoice(choice)}
                  aria-pressed={subChoice === choice}
                  className={`min-h-11 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-fe-muted-strong">Kalınlık</p>
            <div className="flex flex-wrap gap-1.5">
              {THICKNESS_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setThicknessCm(t)}
                  aria-pressed={thicknessCm === t}
                  className={`min-h-11 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    thicknessCm === t
                      ? "border-brand-500 bg-brand-900/30 text-brand-300"
                      : "border-fe-border bg-fe-raised/60 text-fe-text hover:border-brand-500/40"
                  }`}
                >
                  {t} cm
                </button>
              ))}
            </div>
          </div>
        </div>

        {conditionLine && (
          <p className="mb-3 rounded-lg border border-fe-border bg-fe-surface/60 px-3 py-2.5 text-sm text-fe-text">
            {conditionLine}
          </p>
        )}

        {hasPriceError && (
          <div
            role="alert"
            className="mb-3 flex flex-col items-start justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-3 text-sm text-amber-100 sm:flex-row sm:items-center"
          >
            <p>Fiyat verilerinin bir bölümü alınamadı. Bağlantınızı kontrol edip yeniden deneyin.</p>
            <button
              type="button"
              onClick={() => setRequestVersion((value) => value + 1)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-amber-400/50 px-3 py-2 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-900/30"
            >
              Fiyatları yeniden dene
            </button>
          </div>
        )}

        <div className="space-y-2">
          {profiles.map((p) => {
            const cell = priceCellFor(p);
            return (
              <div
                key={p.productKey}
                data-testid={`comparison-price-${p.productKey}`}
                data-product-key={p.productKey}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fe-border bg-fe-raised/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white">{p.displayName}</p>
                  <p className="text-[11px] text-fe-muted">{p.density.display}</p>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  {cell.status === "ok" && (
                    <div className="min-w-0 sm:text-right">
                      <p data-testid="comparison-unit-price" className="font-bold tabular-nums text-white">
                        {fmt(cell.unit)} <span className="text-brand-300">₺/m²</span>
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-fe-muted-strong">
                        KDV hariç · Tam araçta nakliye fiyata dahildir
                      </p>
                    </div>
                  )}
                  {cell.status === "loading" && (
                    <p className="text-sm text-fe-muted">hesaplanıyor…</p>
                  )}
                  {cell.status === "unavailable" && (
                    <p className="text-sm text-fe-muted">bu koşulda fiyat yok</p>
                  )}
                  {cell.status === "error" && (
                    <p className="text-sm text-amber-200">fiyat alınamadı</p>
                  )}
                  {cell.status === "ok" ? (
                    <Link
                      href="/#mantolama-hesaplayici"
                      onClick={() => handleCalculate(p)}
                      className="inline-flex min-h-11 items-center rounded-lg border border-brand-500/50 px-3 py-2 text-xs font-semibold text-brand-300 transition-colors hover:bg-brand-900/30"
                    >
                      Komple set hesapla →
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="inline-flex min-h-11 items-center rounded-lg border border-fe-border px-3 py-2 text-xs font-semibold text-fe-muted"
                    >
                      {cell.status === "loading"
                        ? "Fiyat bekleniyor"
                        : cell.status === "error"
                          ? "Fiyatı yeniden deneyin"
                          : "Bu koşulda hesaplanamaz"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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
import { notifyComparisonOpened, notifyBonusChallengePicked } from "@/lib/notifyWizardEvent";
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

interface ComparisonCenterProps {
  variant: "genel" | "yogunluk_150";
}

type PriceCell =
  | { status: "loading" }
  | { status: "ok"; unit: number }
  | { status: "unavailable" };

export default function ComparisonCenter({ variant }: ComparisonCenterProps) {
  const profiles = useMemo(() => {
    const all = getComparisonProfiles();
    if (variant !== "yogunluk_150") return all;
    // 150 görünümü: föy-beyanlı 150'likler önce, kalanlar bağlamda kalır.
    const is150 = (p: TechnicalProfile) =>
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

  useEffect(() => {
    notifyComparisonOpened({ surface: variant, urun_sayisi: profiles.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [platesRes, ppRes, zonesRes, mtRes] = await Promise.all([
        supabase.from("plates").select("*").eq("is_active", true),
        supabase.from("plate_prices").select("*"),
        supabase.from("shipping_zones").select("*").order("city_name"),
        supabase.from("material_types").select("*"),
      ]);
      if (cancelled) return;
      if (platesRes.data) setPlates(platesRes.data);
      if (ppRes.data) setPlatePrices(ppRes.data);
      if (zonesRes.data) setZones(zonesRes.data);
      if (mtRes.data) setMaterialTypes(mtRes.data);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

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
        .then((res) => res.json().then((json) => ({ okHttp: res.ok, json })))
        .then(({ okHttp, json }) => {
          if (cancelled) return;
          setBonusPrices((prev) => ({
            ...prev,
            [p.modelShortName]:
              okHttp && json?.ok && typeof json.salePricePerM2 === "number"
                ? { status: "ok", unit: json.salePricePerM2 }
                : { status: "unavailable" },
          }));
        })
        .catch(() => {
          if (!cancelled) {
            setBonusPrices((prev) => ({ ...prev, [p.modelShortName]: { status: "unavailable" } }));
          }
        });
    }
    return () => { cancelled = true; };
  }, [profiles, cityCode, subChoice, thicknessCm]);

  const zone = zones.find((z) => z.city_code === cityCode) ?? null;
  const tasyunuRule = materialTypes.find((m) => m.slug === "tasyunu") ?? null;
  const subInfo = citySubRegionQuestion(cityCode);
  const dataReady = plates.length > 0 && zones.length > 0;

  function priceCellFor(profile: TechnicalProfile): PriceCell {
    if (profile.brandName === "Bonus") {
      if (subInfo && !subChoice) return { status: "unavailable" };
      return bonusPrices[profile.modelShortName] ?? { status: "loading" };
    }
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
    if (profile.brandName === "Bonus") {
      notifyBonusChallengePicked({
        surface: "anasayfa",
        bonus_model: profile.modelShortName,
        city_code: cityCode,
        thickness_cm: thicknessCm,
      });
    }
    const store = useWizardStore.getState();
    store.reset();
    store.setProductPreset({
      material: "tasyunu",
      thicknessCm,
      brandName: profile.brandName,
      modelShortName: profile.modelShortName,
    });
  }

  const fmt = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const conditionLine = zone
    ? `Aynı şehir: ${zone.city_name}${subChoice && subInfo ? ` (${SUB_LABELS[subChoice]})` : ""} · aynı kalınlık: ${thicknessCm} cm · tam araç levha fiyatı · KDV hariç · nakliye dahil`
    : "";

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
        <div className="overflow-x-auto rounded-xl border border-fe-border">
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
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-fe-muted">Teslimat Şehri</p>
            <select
              value={cityCode}
              onChange={(e) => setCityCode(Number(e.target.value))}
              className="rounded-lg border border-fe-border bg-fe-surface px-3 py-2 text-sm text-fe-text [color-scheme:dark]"
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
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-fe-muted">Kalınlık</p>
            <div className="flex flex-wrap gap-1.5">
              {THICKNESS_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setThicknessCm(t)}
                  className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
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

        <div className="space-y-2">
          {profiles.map((p) => {
            const cell = priceCellFor(p);
            return (
              <div
                key={p.productKey}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fe-border bg-fe-raised/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white">{p.displayName}</p>
                  <p className="text-[11px] text-fe-muted">{p.density.display}</p>
                </div>
                <div className="flex items-center gap-4">
                  {cell.status === "ok" && (
                    <p className="font-bold tabular-nums text-white">
                      {fmt(cell.unit)} <span className="text-brand-300">₺/m²</span>
                    </p>
                  )}
                  {cell.status === "loading" && (
                    <p className="text-sm text-fe-muted">hesaplanıyor…</p>
                  )}
                  {cell.status === "unavailable" && (
                    <p className="text-sm text-fe-muted">bu koşulda fiyat yok</p>
                  )}
                  <Link
                    href="/#mantolama-hesaplayici"
                    onClick={() => handleCalculate(p)}
                    className="rounded-lg border border-brand-500/50 px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors hover:bg-brand-900/30"
                  >
                    Komple set hesapla →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {conditionLine && (
          <p className="mt-3 text-[11px] text-fe-muted">{conditionLine}</p>
        )}
      </section>
    </div>
  );
}

"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getComparisonProfiles,
  type ComparisonProfile,
  type TechnicalProfile,
} from "@/lib/technical-profiles";
import {
  citySubRegionQuestion,
  type BonusSubRegionChoice,
} from "@/lib/pricing/bonus/subRegions";
import { defaultSubChoice } from "@/components/catalog/BonusRegionPrice";
import {
  bonusVehiclePrices,
  platePricesForModel,
  type ComparisonSnapshot,
  type LogisticsRow,
  type VehiclePrices,
} from "@/lib/compare/vehiclePrices";
import {
  bestTechnicalValues,
  isBest,
  parseKpa,
  parseLambda,
  type ParsedValue,
} from "@/lib/compare/technicalValues";
import { takeComparisonEntry, type ComparisonEntry } from "@/lib/compare/entry";
import { formatThicknessSegment } from "@/lib/catalog/thickness-url";
import { isDensity100To110, isDensity120Class } from "@/lib/compare/hubs";
import { useWizardStore } from "@/lib/store/wizardStore";
import { readCatalogJourneyId } from "@/lib/analytics/catalogJourney";
import {
  notifyBonusChallengePicked,
  notifyComparisonCtaClick,
  notifyComparisonOpened,
  notifyComparisonSorted,
  type ComparisonEntryPlacement,
  type ComparisonSortKey,
} from "@/lib/notifyWizardEvent";
import type { Plate, PlatePrice, ShippingZone, MaterialType } from "@/lib/types";
import { LEAD_TIME_SHORT } from '@/lib/sales/leadTime'

// ============================================================
// Karşılaştırma Merkezi (Sprint 2) — 8 ürün, aynı koşulda
//
// Teknik değerler yalnız teknik profillerden (föy etiketli; sözlü
// beyanlar "Üretici sözlü beyanı — değişken"). Ticari kıyas tek koşul
// setinde: seçilen şehir(+yaka) + kalınlık + tam araç levha m² + KDV
// hariç. Filli fiyatları tek kaynaklı formülden (plateUnitPrice),
// Bonus fiyatı sunucudan. Koşul sağlanamayan hücre fiyat GÖSTERMEZ.
// "Pro" adı otomatik üstünlük olarak sunulmaz (kilitli karar 6).
//
// 14 Ekim 2026 (Emrah kararı, denetim + "A düzeni"): teknik tablo ile fiyat
// listesi tek tabloda birleşti; seçim ve fiyat üstte. Ana fiyat 1 kamyon
// planındaki m² fiyatıdır (en az sipariş 1 tam kamyon; ürün sayfasıyla aynı
// hesap), TIR ikinci satırda. Yangın (hepsi A1) ve kalınlık aralığı sütunu
// kalktı; föy notları dipnota indi. Yeşil = sütunda en iyi değer (yoğunluk
// hariç: yüksek yoğunluk tek başına daha iyi yalıtım değildir).
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
  "pdp_kalinlik",
  "wizard",
  "density_150",
  "unknown",
]);

const SORT_LABELS: Record<ComparisonSortKey, string> = {
  onerilen: "150'likler önce",
  fiyat: "Fiyat",
  isi_iletkenligi: "Isı iletkenliği",
  basma: "Basma dayanımı",
};

const createComparisonSessionId = () =>
  `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function readComparisonSessionId(): string {
  if (typeof window === 'undefined') return createComparisonSessionId();
  const fromQuery = new URLSearchParams(window.location.search).get('comparison_session_id');
  const fromPdp = window.sessionStorage.getItem('pdp_comparison_session_id');
  const candidate = fromQuery ?? fromPdp;
  return candidate && /^cmp_[a-z0-9_]+$/i.test(candidate)
    ? candidate
    : createComparisonSessionId();
}

const formatSourceDate = (isoDate: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));

// Giriş bilgisi önce adresten (eski/dış bağlantılar), yoksa tıklamada sekme hafızasına yazılan kayıttan
// okunur (lib/compare/entry.ts — site içi bağlantılar 14 Ekim 2026'dan beri temiz adreslidir).
function readEntryPlacement(stored: ComparisonEntry | null): ComparisonEntryPlacement {
  if (typeof window === "undefined") return "direct";
  const value = new URLSearchParams(window.location.search).get("entry") ?? stored?.entry ?? "direct";
  return COMPARISON_ENTRY_PLACEMENTS.has(value as ComparisonEntryPlacement)
    ? (value as ComparisonEntryPlacement)
    : "unknown";
}

// Ürün sayfasındaki "N cm mantolama taşyünleri yan yana" kutusu kalınlığı taşır.
function readInitialThickness(stored: ComparisonEntry | null): number | null {
  if (typeof window === "undefined") return null;
  const fromUrl = Number.parseFloat(new URLSearchParams(window.location.search).get("kalinlik") ?? "");
  const value = Number.isFinite(fromUrl) ? fromUrl : stored?.thicknessCm ?? Number.NaN;
  return THICKNESS_OPTIONS.includes(value) ? value : null;
}

function readFocusedModel(stored: ComparisonEntry | null): string | null {
  if (typeof window === "undefined") return null;
  const value = (new URLSearchParams(window.location.search).get("focus") ?? stored?.focus ?? "").trim();
  return value && value.length <= 80 ? value : null;
}

interface ComparisonCenterProps {
  /** genel / yogunluk_150: seçimli sayfa · kalinlik / yogunluk_150_kalinlik: hub (kalınlık adreste sabit) */
  variant: "genel" | "yogunluk_150" | "kalinlik" | "yogunluk_150_kalinlik" | "yogunluk_120";
  /** Hub: kalınlık sabittir; kalınlık düğmeleri kardeş hub'lara bağlantıdır. */
  fixedThicknessCm?: number;
  /** Hub: kalınlık → kardeş hub adresi (yalnız var olan hub'lar). */
  thicknessLinks?: Record<number, string>;
  /** Hub: derleme anı fiyatları — Google sunucu HTML'inde fiyatı görür; tarayıcı canlı veriyle yeniler. */
  snapshot?: ComparisonSnapshot;
}

type PriceCell =
  | { status: "loading" }
  | { status: "ok"; prices: VehiclePrices }
  | { status: "unavailable" }
  | { status: "error" };

interface Row {
  profile: ComparisonProfile;
  /** Varsayılan sıradaki yeri (eşitlikte ve "150'likler önce" sırasında kullanılır). */
  index: number;
  cell: PriceCell;
  lambda: ParsedValue;
  tensile: ParsedValue;
  compressive: ParsedValue;
  verbal: boolean;
  isFocused: boolean;
  slug: string | null;
  brand: string;
  model: string;
  /** 120 görünümünde 100–110 levhalar "alt" grubundadır (alternatif). */
  group: "main" | "alt";
}

// Üst satır marka, alt satır model: "Dalmaçyalı Stonewool SW035" → Dalmaçyalı / Stonewool SW035.
// Görünen ad markayla başlamıyorsa (Fawori Optimix TR7.5; marka kaydı "Optimix") ilk kelime üst satıra çıkar.
function splitName(p: TechnicalProfile): { brand: string; model: string } {
  if (p.displayName.startsWith(`${p.brandName} `)) {
    return { brand: p.brandName, model: p.displayName.slice(p.brandName.length).trim() };
  }
  const space = p.displayName.indexOf(" ");
  return space > 0
    ? { brand: p.displayName.slice(0, space), model: p.displayName.slice(space + 1) }
    : { brand: p.brandName, model: p.displayName };
}

const kamyonUnit = (cell: PriceCell) => (cell.status === "ok" ? cell.prices.kamyon?.unit ?? null : null);

// Bilinmeyen değer her sıralamada sona gider.
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

function sortRows(rows: Row[], key: ComparisonSortKey): Row[] {
  if (key === "onerilen") return rows;
  return [...rows].sort((a, b) => {
    // Alternatif grubu her sıralamada ana grubun altında kalır.
    const group = Number(a.group === "alt") - Number(b.group === "alt");
    if (group !== 0) return group;
    // Bu kalınlıkta fiyatı olmayan ürün, hangi sırada olursa olsun en alta iner.
    const missing = Number(a.cell.status === "unavailable") - Number(b.cell.status === "unavailable");
    if (missing !== 0) return missing;
    const diff =
      key === "fiyat"
        ? compareNullable(kamyonUnit(a.cell), kamyonUnit(b.cell), 1)
        : key === "isi_iletkenligi"
          ? compareNullable(a.lambda.value, b.lambda.value, 1)
          : compareNullable(a.compressive.value, b.compressive.value, -1);
    return diff !== 0 ? diff : a.index - b.index;
  });
}

const fmt = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtM2 = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const fmtTl = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });

const BEST_CLASS =
  "inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-800 ring-1 ring-emerald-200";

function BestValue({
  value,
  best,
  weight = "font-semibold",
  children,
}: {
  value: number | null;
  best: number | null;
  /** Fiyat hücresinde rakam kalın kalır; işaret yazı kalınlığını düşürmez. */
  weight?: string;
  children: ReactNode;
}) {
  if (!isBest(value, best)) return <>{children}</>;
  return (
    <span className={`${BEST_CLASS} ${weight}`}>
      <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
      {children}
      <span className="sr-only"> (en iyi değer)</span>
    </span>
  );
}

const chipClass = (selected: boolean) =>
  `min-h-11 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-gold ${
    selected
      ? "border-hub-gold bg-[#fff6dc] font-semibold text-hub-ink"
      : "border-hub-rule bg-white text-hub-ink-2 hover:border-hub-gold/60"
  }`;

export default function ComparisonCenter({ variant, fixedThicknessCm, thicknessLinks, snapshot }: ComparisonCenterProps) {
  const isHub = fixedThicknessCm != null;
  const profiles = useMemo(() => {
    const all = getComparisonProfiles();
    if (variant === "yogunluk_120") {
      // 120 görünümü (Emrah, 14 Ekim 2026): 120–125 sınıfı önce; 100–110 (sözlü beyan) "alternatif" olarak altta.
      return [...all.filter(isDensity120Class), ...all.filter(isDensity100To110)];
    }
    if (variant !== "yogunluk_150" && variant !== "yogunluk_150_kalinlik") return all;
    // 150 görünümü yalnız föy beyanlı 150'likleri gösterir (Emrah, 14 Ekim 2026: "150 sayfasında diğer
    // ürünler olmamalı"; önceki karar 3'te diğer beş ürün bağlam olarak alttaydı).
    return all.filter((p) => p.density.sourceType === "datasheet" && p.density.minKgM3 >= 150);
  }, [variant]);

  const [plates, setPlates] = useState<Plate[]>([]);
  const [platePrices, setPlatePrices] = useState<PlatePrice[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [logistics, setLogistics] = useState<LogisticsRow[]>([]);
  const [cityCode, setCityCode] = useState<number>(34);
  const [subChoice, setSubChoice] = useState<BonusSubRegionChoice | null>(() => defaultSubChoice(34));
  const [thicknessCm, setThicknessCm] = useState<number>(fixedThicknessCm ?? 5);
  const [sortKey, setSortKey] = useState<ComparisonSortKey>("fiyat");
  const [bonusPrices, setBonusPrices] = useState<Record<string, PriceCell>>({});
  const [comparisonDataError, setComparisonDataError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [focusedModel, setFocusedModel] = useState<string | null>(null);
  const comparisonSessionIdRef = useRef<string | null>(null);
  const entryPlacementRef = useRef<ComparisonEntryPlacement>("direct");
  const catalogJourneyIdRef = useRef<string | null>(null);
  const storedEntryRef = useRef<ComparisonEntry | null | undefined>(undefined);

  useEffect(() => {
    comparisonSessionIdRef.current = readComparisonSessionId();
    window.sessionStorage.removeItem('pdp_comparison_session_id');
    const comparisonSessionId = comparisonSessionIdRef.current;
    // Kayıt bir kez okunup silinir; geliştirmedeki ikinci etki çalışması aynı kaydı ref'ten kullanır.
    if (storedEntryRef.current === undefined) {
      storedEntryRef.current = takeComparisonEntry(window.location.pathname);
    }
    const stored = storedEntryRef.current;
    entryPlacementRef.current = readEntryPlacement(stored);
    catalogJourneyIdRef.current = entryPlacementRef.current === "category"
      ? readCatalogJourneyId()
      : null;
    const focusTimer = window.setTimeout(() => {
      setFocusedModel(readFocusedModel(stored));
      const initialThickness = readInitialThickness(stored);
      if (initialThickness !== null && !isHub) setThicknessCm(initialThickness);
    }, 0);
    notifyComparisonOpened({
      surface: variant,
      urun_sayisi: profiles.length,
      entry_placement: entryPlacementRef.current,
      comparison_session_id: comparisonSessionId,
      catalog_journey_id: catalogJourneyIdRef.current,
      comparison_route: 'all_products',
    });
    return () => window.clearTimeout(focusTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setComparisonDataError(false);
      const [platesRes, ppRes, zonesRes, mtRes, lcRes] = await Promise.all([
        supabase.from("plates").select("*").eq("is_active", true),
        supabase.from("plate_prices").select("*"),
        supabase.from("shipping_zones").select("*").order("city_name"),
        supabase.from("material_types").select("*"),
        supabase
          .from("logistics_capacity")
          .select("thickness, lorry_capacity_packages, truck_capacity_packages, package_size_m2"),
      ]);
      if (cancelled) return;
      if (platesRes.error || ppRes.error || zonesRes.error || mtRes.error || lcRes.error) {
        setComparisonDataError(true);
      }
      if (platesRes.data) setPlates(platesRes.data);
      if (ppRes.data) setPlatePrices(ppRes.data);
      if (zonesRes.data) setZones(zonesRes.data);
      if (mtRes.data) setMaterialTypes(mtRes.data);
      if (lcRes.data) setLogistics(lcRes.data as LogisticsRow[]);
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
          let cell: PriceCell;
          if (okHttp && json?.ok && typeof json.salePricePerM2 === "number") {
            // Bonus bölge fiyatı araç tipine göre değişmez; kamyon/TIR metrajı Bonus'un kendi kaydından gelir.
            const prices = bonusVehiclePrices(
              json.salePricePerM2,
              Number(json.packageM2),
              typeof json.kamyonM2 === "number" ? json.kamyonM2 : null,
              typeof json.tirM2 === "number" ? json.tirM2 : null,
            );
            cell = prices.kamyon ? { status: "ok", prices } : { status: "unavailable" };
          } else {
            cell = !okHttp && status >= 500 ? { status: "error" } : { status: "unavailable" };
          }
          setBonusPrices((prev) => ({ ...prev, [p.modelShortName]: cell }));
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
  const dataReady = plates.length > 0 && zones.length > 0 && logistics.length > 0;

  // Hub: canlı veri gelene kadar derleme anı fiyatı gösterilir (yalnız fotoğrafın koşulunda).
  function cellFor(profile: TechnicalProfile): PriceCell {
    const cell = priceCellFor(profile);
    if (cell.status !== "loading" || !snapshot) return cell;
    if (cityCode !== snapshot.cityCode || subChoice !== snapshot.subChoice || thicknessCm !== snapshot.thicknessCm) return cell;
    const known = snapshot.prices[profile.productKey];
    return known ? { status: "ok", prices: known } : { status: "unavailable" };
  }

  function priceCellFor(profile: TechnicalProfile): PriceCell {
    if (profile.brandName === "Bonus") {
      if (subInfo && !subChoice) return { status: "unavailable" };
      return bonusPrices[profile.modelShortName] ?? { status: "loading" };
    }
    if (comparisonDataError) return { status: "error" };
    if (!dataReady || !zone || !tasyunuRule) return { status: "loading" };
    const prices = platePricesForModel(
      { plates, platePrices, zone, marginRule: tasyunuRule, logistics },
      profile.modelShortName,
      thicknessCm,
    );
    return prices ? { status: "ok", prices } : { status: "unavailable" };
  }

  function slugFor(profile: TechnicalProfile): string | null {
    // Plate tipinde slug alanı yok (select * getiriyor); PDP linki için
    // satır objesinden okunur, yoksa link üretilmez.
    const plate = plates.find((pl) => pl.short_name === profile.modelShortName) as
      | (Plate & { slug?: string | null })
      | undefined;
    return plate?.slug ?? snapshot?.slugs[profile.modelShortName] ?? null;
  }

  function journey() {
    return {
      surface: variant,
      entry_placement: entryPlacementRef.current,
      comparison_session_id: comparisonSessionIdRef.current ?? readComparisonSessionId(),
      catalog_journey_id: catalogJourneyIdRef.current,
      comparison_route: 'all_products' as const,
    };
  }

  function handleSort(key: ComparisonSortKey) {
    if (key === sortKey) return;
    setSortKey(key);
    notifyComparisonSorted({ ...journey(), sort_key: key, thickness_cm: thicknessCm });
  }

  function handleCalculate(profile: TechnicalProfile) {
    const comparisonSessionId = comparisonSessionIdRef.current ?? readComparisonSessionId();
    notifyComparisonCtaClick({
      ...journey(),
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
      comparisonRoute: 'all_products',
      catalogJourneyId: catalogJourneyIdRef.current ?? undefined,
    });
  }

  const focusedProfile = focusedModel
    ? profiles.find((profile) => profile.modelShortName === focusedModel) ?? null
    : null;

  const rows: Row[] = profiles.map((p, index) => ({
    profile: p,
    index,
    cell: cellFor(p),
    lambda: parseLambda(p.lambdaDisplay),
    tensile: parseKpa(p.tensileDisplay),
    compressive: parseKpa(p.compressiveDisplay),
    verbal: p.density.sourceType === "manufacturer_verbal",
    isFocused: focusedProfile?.productKey === p.productKey,
    slug: slugFor(p),
    ...splitName(p),
    group: variant === "yogunluk_120" && isDensity100To110(p) ? "alt" : "main",
  }));
  const best = bestTechnicalValues(
    rows.map((r) => ({ key: r.profile.productKey, lambda: r.lambda, tensile: r.tensile, compressive: r.compressive })),
  );
  const knownPrices = rows.map((r) => kamyonUnit(r.cell)).filter((v): v is number => v !== null);
  const bestPrice = knownPrices.length > 0 ? Math.min(...knownPrices) : null;
  const sortedRows = sortRows(rows, sortKey);
  const altStartsAt = sortedRows.findIndex((row) => row.group === "alt");
  const altTitle = "Alternatif · 100–110 yoğunluk (üretici sözlü beyanı)";
  const sortOptions: ComparisonSortKey[] = ["fiyat", "isi_iletkenligi", "basma"];

  const conditionLine = zone
    ? `${zone.city_name}${subChoice && subInfo ? ` · ${SUB_LABELS[subChoice]}` : ""} · ${thicknessCm} cm`
    : "";
  const hasPriceError = comparisonDataError
    || Object.values(bonusPrices).some((cell) => cell.status === "error");
  const verbalCount = rows.filter((r) => r.verbal).length;

  function productName(row: Row, headingId?: string) {
    const label = (
      <>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-hub-muted">{row.brand}</span>
        <span className="block font-heading text-base font-bold leading-snug text-hub-ink">{row.model}</span>
      </>
    );
    return (
      <span id={headingId} className="block min-w-0">
        {row.slug ? (
          <Link
            href={productHref(row)}
            className="block rounded-sm hover:[&>span:last-child]:text-hub-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-gold"
          >
            {label}
          </Link>
        ) : (
          label
        )}
      </span>
    );
  }

  // Ürün sayfası: seçili kalınlıkta fiyatı varsa o kalınlığın sayfası (hub'dan tek ürüne geçiş).
  function productHref(row: Row): string {
    const base = `/urunler/tasyunu-levha/${row.slug}`;
    return row.cell.status === "ok" ? `${base}/${formatThicknessSegment(thicknessCm)}` : base;
  }

  function densityText(row: Row) {
    return (
      <>
        {row.profile.density.display}
        {row.verbal && (
          <>
            <span aria-hidden="true" className="text-hub-gold">*</span>
            <span className="sr-only"> (üretici sözlü beyanı — değişken)</span>
          </>
        )}
      </>
    );
  }

  // Föy, 30 mm için basma değerinin farklılaşabileceğini yazıyor (Expert, SW035); 3 cm seçiliyken bu not
  // dipnotta kalmaz, hücrenin altında görünür. Değer föyde olmadığı için yeni rakam yazılmaz (editör, 14 Ekim).
  function thinCaveat(row: Row) {
    if (thicknessCm !== 3 || !row.compressive.note?.includes("30 mm")) return null;
    return (
      <span className="mt-0.5 block whitespace-normal text-xs font-medium text-amber-800">
        3 cm&apos;de değer farklılaşabilir (föy)
      </span>
    );
  }

  function priceStatusText(cell: PriceCell) {
    if (cell.status === "loading") return <p className="text-sm text-hub-muted">hesaplanıyor…</p>;
    if (cell.status === "error") return <p className="text-sm font-medium text-amber-800">fiyat alınamadı</p>;
    if (cell.status === "unavailable") return <p className="text-sm text-hub-muted">Bu kalınlıkta fiyat yok</p>;
    return null;
  }

  function mainPrice(cell: Extract<PriceCell, { status: "ok" }>, size: "table" | "card") {
    const kamyon = cell.prices.kamyon!;
    return (
      <p
        data-testid="comparison-unit-price"
        className={`whitespace-nowrap font-heading font-extrabold tabular-nums text-hub-ink ${size === "card" ? "text-xl" : "text-[17px]"}`}
      >
        <BestValue value={kamyon.unit} best={bestPrice} weight="font-extrabold">
          {fmt(kamyon.unit)} <span className="text-[0.8em] font-bold">₺/m²</span>
        </BestValue>
      </p>
    );
  }

  function cta(row: Row, fullWidth: boolean) {
    const base = `inline-flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-2 text-[13px] font-semibold transition-colors ${fullWidth ? "w-full sm:w-auto sm:min-w-56" : ""}`;
    if (row.cell.status === "ok") {
      return (
        <Link
          href="/#mantolama-hesaplayici"
          onClick={() => handleCalculate(row.profile)}
          className={`${base} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-gold ${
            row.isFocused
              ? "border-hub-gold bg-hub-gold text-white hover:bg-[#6a4f1a]"
              : "border-hub-gold text-hub-gold hover:bg-hub-gold hover:text-white"
          }`}
        >
          Komple set hesapla →
        </Link>
      );
    }
    return (
      <span aria-disabled="true" className={`${base} border-hub-rule text-hub-muted`}>
        {row.cell.status === "loading"
          ? "Fiyat yükleniyor"
          : row.cell.status === "error"
            ? "Yeniden deneme gerekli"
            : "Bu koşulda hesaplanamaz"}
      </span>
    );
  }

  return (
    <div className="space-y-5">
      {focusedProfile && (
        <p
          role="status"
          className="rounded-xl border border-[#c9a54e] bg-[#fff6dc] px-4 py-3 text-sm leading-6 text-hub-ink"
        >
          <strong>{focusedProfile.displayName}</strong>{' '}
          karşılaştırmada işaretlendi; tabloda sarı zeminle görünür.
        </p>
      )}

      <section
        aria-labelledby="karsilastirma-baslik"
        data-testid="comparison-pricing"
        className="space-y-4"
      >
        {/* ─── Seçim: şehir, yaka, kalınlık ─── */}
        <div className="rounded-2xl border border-hub-rule bg-hub-card p-4 sm:p-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div>
              <label
                htmlFor="comparison-city"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-hub-muted"
              >
                Teslimat şehri
              </label>
              <select
                id="comparison-city"
                aria-label="Teslimat şehri"
                value={cityCode}
                onChange={(e) => setCityCode(Number(e.target.value))}
                className="min-h-11 rounded-lg border border-hub-rule bg-white px-3 py-2 text-base text-hub-ink [color-scheme:light] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-gold sm:text-sm"
              >
                {zones.map((z) => (
                  <option key={z.city_code} value={z.city_code}>{z.city_name}</option>
                ))}
              </select>
            </div>
            {subInfo && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-hub-muted">Bölge</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(subInfo.options) as BonusSubRegionChoice[]).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setSubChoice(choice)}
                      aria-pressed={subChoice === choice}
                      className={chipClass(subChoice === choice)}
                    >
                      {SUB_LABELS[choice]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-hub-muted">Kalınlık</p>
              <div className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap">
                {isHub && thicknessLinks
                  ? THICKNESS_OPTIONS.filter((t) => thicknessLinks[t]).map((t) => (
                      <Link
                        key={t}
                        href={thicknessLinks[t]}
                        aria-current={thicknessCm === t ? "page" : undefined}
                        className={`${chipClass(thicknessCm === t)} inline-flex items-center justify-center whitespace-nowrap px-1 sm:px-3`}
                      >
                        {t} cm
                      </Link>
                    ))
                  : THICKNESS_OPTIONS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setThicknessCm(t)}
                        aria-pressed={thicknessCm === t}
                        className={`${chipClass(thicknessCm === t)} whitespace-nowrap px-1 sm:px-3`}
                      >
                        {t} cm
                      </button>
                    ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Sonuç başlığı + sıralama ─── */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 id="karsilastirma-baslik" className="font-heading text-xl font-bold text-hub-ink sm:text-2xl">
              Aynı koşulda fiyat ve teknik değerler
            </h2>
            {conditionLine && (
              <p className="mt-1 text-sm text-hub-ink-2">
                <strong className="font-semibold text-hub-ink">{conditionLine}</strong>
                {' · '}1 kamyon siparişinde m² fiyatı · KDV hariç · Tam araçta nakliye fiyata dahildir
                {' · '}<strong className="font-semibold text-hub-ink" data-testid="comparison-lead-time">{LEAD_TIME_SHORT}</strong>
              </p>
            )}
          </div>
          <div role="group" aria-label="Sıralama" className="flex flex-wrap items-center gap-1.5 lg:shrink-0">
            <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-hub-muted">Sırala</span>
            {sortOptions.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSort(key)}
                aria-pressed={sortKey === key}
                className={chipClass(sortKey === key)}
              >
                {SORT_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {hasPriceError && (
          <div
            role="alert"
            className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center"
          >
            <p>Fiyat verilerinin bir bölümü alınamadı. Bağlantınızı kontrol edip yeniden deneyin.</p>
            <button
              type="button"
              onClick={() => setRequestVersion((value) => value + 1)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              Fiyatları yeniden dene
            </button>
          </div>
        )}

        {/* ─── Telefon ve tablet: kartlar ─── */}
        <ul className="space-y-3 lg:hidden" data-testid="comparison-cards" role="list">
          {sortedRows.map((row, rowIndex) => (
            <Fragment key={row.profile.productKey}>
            {rowIndex === altStartsAt && (
              <li data-testid="comparison-alt-heading" className="pt-3">
                <h3 className="font-heading text-base font-bold text-hub-ink">{altTitle}</h3>
                <p className="text-xs text-hub-muted">120 yoğunluk şartını karşılamaz; aynı mantolama işinde kullanılan levhalar.</p>
              </li>
            )}
            <li>
              <article
                aria-labelledby={`kart-${row.profile.productKey}`}
                data-testid={`comparison-card-${row.profile.productKey}`}
                data-product-key={row.profile.productKey}
                data-focused={row.isFocused || undefined}
                className={`min-w-0 rounded-2xl border p-4 ${
                  row.isFocused
                    ? "border-hub-gold bg-[#fff6dc] shadow-[inset_4px_0_0_#7d5d20]"
                    : "border-hub-rule bg-hub-card"
                } ${row.cell.status === "unavailable" ? "opacity-75" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0">{productName(row, `kart-${row.profile.productKey}`)}</h3>
                  <div className="shrink-0 text-right">
                    {row.cell.status === "ok" ? (
                      <>
                        {mainPrice(row.cell, "card")}
                        <p className="text-xs text-hub-muted">m² fiyatı (1 kamyon)</p>
                      </>
                    ) : (
                      priceStatusText(row.cell)
                    )}
                  </div>
                </div>

                {row.cell.status === "ok" && row.cell.prices.kamyon && (
                  <p className="mt-2 text-sm leading-6 text-hub-ink-2">
                    En az sipariş 1 kamyon:{' '}
                    <strong className="font-semibold tabular-nums text-hub-ink">
                      {fmtM2(row.cell.prices.kamyon.m2)} m² · {fmtTl(row.cell.prices.kamyon.total)} ₺
                    </strong>
                    {row.cell.prices.tir && (
                      <span className="block text-xs tabular-nums text-hub-muted">
                        TIR ({fmtM2(row.cell.prices.tir.m2)} m²): {fmt(row.cell.prices.tir.unit)} ₺/m²
                      </span>
                    )}
                  </p>
                )}

                <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
                  <div className="min-w-0 border-t border-hub-rule pt-2">
                    <dt className="text-xs font-medium text-hub-muted">Yoğunluk</dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold text-hub-ink">{densityText(row)}</dd>
                  </div>
                  <div className="min-w-0 border-t border-hub-rule pt-2">
                    <dt className="text-xs font-medium text-hub-muted">Isı iletkenliği <span className="font-normal">(W/mK, düşük iyi)</span></dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-hub-ink">
                      <BestValue value={row.lambda.value} best={best.lambda}>{row.lambda.short}</BestValue>
                    </dd>
                  </div>
                  <div className="min-w-0 border-t border-hub-rule pt-2">
                    <dt className="text-xs font-medium text-hub-muted">Dik çekme <span className="font-normal">(yüksek iyi)</span></dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-hub-ink">
                      <BestValue value={row.tensile.value} best={best.tensile}>{row.tensile.short}</BestValue>
                    </dd>
                  </div>
                  <div className="min-w-0 border-t border-hub-rule pt-2">
                    <dt className="text-xs font-medium text-hub-muted">Basma <span className="font-normal">(yüksek iyi)</span></dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-hub-ink">
                      <BestValue value={row.compressive.value} best={best.compressive}>{row.compressive.short}</BestValue>
                      {thinCaveat(row)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {row.slug && (
                    <Link
                      href={productHref(row)}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg px-3 text-[13px] font-semibold text-hub-ink-2 underline-offset-4 hover:text-hub-gold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-gold sm:w-auto"
                    >
                      Ürünü gör
                    </Link>
                  )}
                  {cta(row, true)}
                </div>
              </article>
            </li>
            </Fragment>
          ))}
        </ul>

        {/* ─── Masaüstü: tek tablo ─── */}
        <div
          className="hidden overflow-x-auto rounded-2xl border border-hub-rule bg-hub-card lg:block"
          data-testid="comparison-table"
        >
          <table className="w-full min-w-[940px] text-sm">
            <caption className="sr-only">
              Taşyünü levhaların aynı şehir ve kalınlıkta 1 kamyon m² fiyatı, en az sipariş tutarı ve föy değerleri
            </caption>
            <thead>
              <tr className="border-b border-hub-rule bg-hub-card-2 text-left align-bottom text-[11px] font-semibold uppercase tracking-[0.06em] text-hub-muted">
                <th scope="col" className="px-3 py-3">Ürün</th>
                <th scope="col" className="px-2.5 py-3">Yoğunluk</th>
                <th scope="col" className="px-2.5 py-3">
                  Isı iletkenliği
                  <span className="block font-medium normal-case tracking-normal text-hub-gold">W/mK · düşük olan iyi</span>
                </th>
                <th scope="col" className="px-2.5 py-3">
                  Dik çekme
                  <span className="block font-medium normal-case tracking-normal text-hub-gold">yüksek olan iyi</span>
                </th>
                <th scope="col" className="px-2.5 py-3">
                  Basma
                  <span className="block font-medium normal-case tracking-normal text-hub-gold">yüksek olan iyi</span>
                </th>
                <th scope="col" className="px-2.5 py-3 text-right">
                  m² fiyatı
                  <span className="block font-medium normal-case tracking-normal text-hub-gold">1 kamyon · KDV hariç</span>
                </th>
                <th scope="col" className="px-2.5 py-3 text-right">
                  En az sipariş
                  <span className="block font-medium normal-case tracking-normal text-hub-gold">1 tam kamyon</span>
                </th>
                <th scope="col" className="py-3 pl-2 pr-3"><span className="sr-only">Hesaplayıcı</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, rowIndex) => {
                const cell = row.cell;
                return (
                  <Fragment key={row.profile.productKey}>
                  {rowIndex === altStartsAt && (
                    <tr data-testid="comparison-alt-heading" className="border-b border-hub-rule bg-hub-card-2">
                      <th colSpan={8} scope="rowgroup" className="px-3 py-2.5 text-left">
                        <span className="font-heading text-sm font-bold text-hub-ink">{altTitle}</span>
                        <span className="ml-2 text-xs font-normal text-hub-muted">120 yoğunluk şartını karşılamaz; aynı mantolama işinde kullanılan levhalar.</span>
                      </th>
                    </tr>
                  )}
                  <tr
                    key={row.profile.productKey}
                    data-testid={`comparison-row-${row.profile.productKey}`}
                    data-product-key={row.profile.productKey}
                    data-focused={row.isFocused || undefined}
                    className={`border-b border-hub-rule/80 align-middle last:border-0 ${
                      row.isFocused ? "bg-[#fff6dc]" : ""
                    } ${cell.status === "unavailable" ? "text-hub-muted" : ""}`}
                  >
                    <th
                      scope="row"
                      className={`px-3 py-3 text-left font-normal ${row.isFocused ? "shadow-[inset_4px_0_0_#7d5d20]" : ""}`}
                    >
                      {productName(row)}
                    </th>
                    <td className="whitespace-nowrap px-2.5 py-3 text-hub-ink">{densityText(row)}</td>
                    <td className="whitespace-nowrap px-2.5 py-3 tabular-nums text-hub-ink">
                      <BestValue value={row.lambda.value} best={best.lambda}>{row.lambda.short}</BestValue>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3 tabular-nums text-hub-ink">
                      <BestValue value={row.tensile.value} best={best.tensile}>{row.tensile.short}</BestValue>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3 tabular-nums text-hub-ink">
                      <BestValue value={row.compressive.value} best={best.compressive}>{row.compressive.short}</BestValue>
                      {thinCaveat(row)}
                    </td>
                    <td className="px-2.5 py-3 text-right">
                      {cell.status === "ok" ? (
                        <>
                          {mainPrice(cell, "table")}
                          {cell.prices.tir && (
                            <p className="whitespace-nowrap text-xs tabular-nums text-hub-muted">
                              TIR: {fmt(cell.prices.tir.unit)} ₺/m²
                            </p>
                          )}
                        </>
                      ) : (
                        priceStatusText(cell)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums">
                      {cell.status === "ok" && cell.prices.kamyon ? (
                        <>
                          <p className="font-semibold text-hub-ink">{fmtTl(cell.prices.kamyon.total)} ₺</p>
                          <p className="text-xs text-hub-muted">{fmtM2(cell.prices.kamyon.m2)} m²</p>
                        </>
                      ) : (
                        <span aria-hidden="true" className="text-hub-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 pl-2 pr-3 text-right">{cta(row, false)}</td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Dipnotlar ─── */}
        <div className="space-y-2 text-xs leading-5 text-hub-ink-2">
          <p>
            <span className={`${BEST_CLASS} font-semibold`}>
              <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
              Yeşil
            </span>{' '}
            üretici beyanına göre o sütundaki en iyi değerdir (fiyatta en uygun olan). Yoğunluk işaretlenmez: yüksek yoğunluk tek başına daha iyi ısı yalıtımı
            anlamına gelmez. Aralıklı değerlerde temkinli uç esas alınır (ısı iletkenliğinde üst, dayanımda alt değer).
          </p>
          <p>
            {rows.length} levhanın hepsi A1 (yanmaz) sınıfındadır. Değerler üretici föy beyanıdır
            {verbalCount > 0 && (
              <>
                ; <span className="text-hub-gold">*</span> işaretli {verbalCount} yoğunluk föyde yoktur:
                Üretici sözlü beyanı — değişken
              </>
            )}
            . 1 kamyonun metrajı her ürünün kendi paketiyle hesaplanır; bu yüzden markalar arasında m² farklı olabilir.
          </p>
          <details className="group rounded-xl border border-hub-rule bg-hub-card">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-sm font-semibold text-hub-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-gold [&::-webkit-details-marker]:hidden">
              Föy notları ve kaynak tarihleri
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </summary>
            <ul className="space-y-2 px-4 pb-4 pt-1" data-testid="comparison-source-notes">
              {rows.map((row) => {
                const notes = [
                  row.lambda.note && `Isı iletkenliği: ${row.lambda.note}`,
                  row.tensile.note && `Dik çekme: ${row.tensile.note}`,
                  row.compressive.note && `Basma: ${row.compressive.note}`,
                  row.profile.tensileClass && `Çekme sınıfı: ${row.profile.tensileClass}`,
                ].filter(Boolean);
                return (
                  <li key={row.profile.productKey} className="border-t border-hub-rule pt-2 first:border-0 first:pt-0">
                    <strong className="font-semibold text-hub-ink">{row.profile.displayName}</strong>
                    {notes.length > 0 && <> — {notes.join(" · ")}</>}
                    <span className="block text-hub-muted">
                      Yoğunluk: {row.verbal ? "Üretici sözlü beyanı — değişken" : "Föy beyanı"} · Kaynak tarihi:{' '}
                      <time dateTime={row.profile.density.sourceDate}>{formatSourceDate(row.profile.density.sourceDate)}</time>
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      </section>
    </div>
  );
}

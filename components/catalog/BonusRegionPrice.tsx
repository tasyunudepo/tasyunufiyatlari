"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CreditCard, Landmark, MessageCircle } from "lucide-react";
import {
  citySubRegionQuestion,
  type BonusSubRegionChoice,
} from "@/lib/pricing/bonus/subRegions";
import {
  buildBonusPlateOrder,
  buildBonusVehiclePlans,
  findNearestLowerBonusVehiclePlan,
} from "@/lib/pricing/bonus/packageAssembly";
import SingleProductQuoteButton from "./SingleProductQuoteButton";
import type { CatalogProductView } from "@/lib/catalog/types";
import { generateQuoteWhatsAppMessage, buildWhatsAppLink } from "@/lib/utils/whatsapp";
import { notifyWhatsappIntent } from "@/lib/notifyWhatsappIntent";
import {
  notifyProductDetailCtaClick,
  notifyProductDetailFormOpen,
  notifyProductDetailPriceView,
} from "@/lib/notifyWizardEvent";
import { getCategoryEntryContext } from "@/lib/catalog/category-entry-context";
import { readCatalogJourneyId } from "@/lib/analytics/catalogJourney";

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

// /api/quotes kanonik ziyaretçi teklif şemasıyla aynı tavan
// (lib/schemas/quote.schema.ts). Seçilen tam araç planı da bu sınırı
// aşamaz; aksi halde ekranda kurulup API'de reddedilen bir PDF/lead
// bağlamı oluşur.
const PURCHASE_MAX_AREA_M2 = 10_000;

type PurchaseAreaValidation =
  | { value: number; error: null }
  | { value: null; error: string };

function validatePurchaseArea(rawValue: string): PurchaseAreaValidation {
  const value = rawValue.trim();
  if (!value) return { value: null, error: "İhtiyaç metrajını girin." };

  // Türkçe ondalık ve binlik yazımı ile sade noktalı ondalığı kabul et;
  // parseFloat'ın "12abc" gibi kısmi değerleri sessizce kabul etmesine
  // izin verme.
  let normalized: string | null = null;
  if (/^\d+$/.test(value)) {
    normalized = value;
  } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(value)) {
    normalized = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+[.,]\d+$/.test(value)) {
    normalized = value.replace(",", ".");
  }

  const areaM2 = normalized === null ? Number.NaN : Number(normalized);
  if (!Number.isFinite(areaM2) || areaM2 <= 0) {
    return { value: null, error: "Sıfırdan büyük geçerli bir metraj girin." };
  }
  if (areaM2 > PURCHASE_MAX_AREA_M2) {
    return { value: null, error: "En fazla 10.000 m² girilebilir." };
  }

  return { value: areaM2, error: null };
}

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
  | {
      status: "ok";
      requestKey: string;
      data: Required<Pick<BonusPriceResponse, "salePricePerM2" | "kamyonM2" | "tirM2" | "packageM2">>;
    }
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
  variant?: "default" | "purchase-desk";
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
  variant = "default",
}: BonusRegionPriceProps) {
  const [subChoice, setSubChoice] = useState<BonusSubRegionChoice | null>(
    () => defaultSubChoice(cityCode),
  );
  const [state, setState] = useState<FetchState>({ status: "idle" });
  // PDF hangi tam-araç planıyla çıkacak — varsayılan Kamyon.
  const [vehicle, setVehicle] = useState<BonusVehicle>("kamyon");
  // Metraj girişi (20 Temmuz kararı): büyük metrajlar tek araca sığmaz;
  // girilen m² tam araç planına çevrilir (önce yukarı tam TIR, kalan
  // kamyona sığıyorsa "N TIR + 1 Kamyon" alternatifi).
  const [metraj, setMetraj] = useState<string>("");
  const [planIdx, setPlanIdx] = useState<number>(0);
  const [metrajTouched, setMetrajTouched] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const lastPriceViewRef = useRef("");

  const subInfo = citySubRegionQuestion(cityCode);
  const currentRequestKey = [modelShortName, thicknessCm ?? "none", cityCode, subChoice ?? "none"].join("|");

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
    const requestKey = currentRequestKey;

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
            requestKey,
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
  }, [modelShortName, thicknessCm, cityCode, subChoice, subInfo, currentRequestKey, retryNonce]);

  const fmt = (n: number, digits = 2) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const subLabel = subChoice ? ` (${SUB_LABELS[subChoice]})` : "";

  const resolvedData =
    state.status === "ok" && state.requestKey === currentRequestKey ? state.data : null;
  const purchaseAreaValidation = validatePurchaseArea(metraj);
  const purchaseCalculation = (() => {
    if (!resolvedData) return null;

    const quote = {
      salePricePerM2: resolvedData.salePricePerM2,
      packageM2: resolvedData.packageM2,
    };
    const kamyon = buildBonusPlateOrder(quote, resolvedData.kamyonM2);
    const tir = buildBonusPlateOrder(quote, resolvedData.tirM2);
    if (!kamyon || !tir) return null;

    const requestedM2 = purchaseAreaValidation.value;
    const plans = requestedM2
      ? buildBonusVehiclePlans(requestedM2, resolvedData.kamyonM2, resolvedData.tirM2)
          .filter((plan) => plan.planM2 <= PURCHASE_MAX_AREA_M2)
      : [];
    const lowerAdjustment = requestedM2
      ? findNearestLowerBonusVehiclePlan(
          requestedM2,
          resolvedData.kamyonM2,
          resolvedData.tirM2,
        )
      : null;
    const safePlanIdx = Math.min(planIdx, Math.max(0, plans.length - 1));
    const selectedPlan = plans[safePlanIdx] ?? null;
    const selectedPlanOrder = selectedPlan
      ? buildBonusPlateOrder(quote, selectedPlan.planM2)
      : null;
    // Sipariş Masası fail-closed çalışır. Geçersiz/boş metrajda eski
    // "1 Kamyon" seçimine sessizce dönülmez; CTA ve teklif bağlamı
    // ancak hesap motorunun gerçekten ürettiği planla kurulur.
    const selectedOrder = selectedPlanOrder;
    const selectedLabel = selectedPlan?.label ?? null;
    const selectedCapacityM2 = selectedPlan?.planM2 ?? null;
    const selectedVehicleType = selectedPlan?.vehicleType ?? null;

    return {
      kamyon,
      tir,
      requestedM2,
      plans,
      lowerAdjustment,
      safePlanIdx,
      selectedPlan,
      selectedOrder,
      selectedLabel,
      selectedCapacityM2,
      selectedVehicleType,
    };
  })();
  const purchaseAreaError =
    purchaseAreaValidation.error ??
    (resolvedData && purchaseCalculation && purchaseCalculation.plans.length === 0
      ? "Bu metraj, 10.000 m² teklif sınırı içinde geçerli bir tam araç planına dönüşmüyor. Daha düşük bir metraj girin."
      : null);
  const hasValidPurchasePlan = Boolean(
    purchaseCalculation?.requestedM2 &&
      purchaseCalculation.selectedPlan &&
      purchaseCalculation.selectedOrder &&
      purchaseCalculation.selectedLabel &&
      purchaseCalculation.selectedCapacityM2 &&
      !purchaseAreaError,
  );
  const purchaseRefCode = resultSessionId
    ? `TYW${resultSessionId.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(-10)}`
    : null;
  const hasPurchaseSticky =
    variant === "purchase-desk" && Boolean(resolvedData && product && hasValidPurchasePlan);

  // Sipariş Masası ilk açılışta gerçek Kamyon kapasitesini metraj alanına
  // yerleştirir. Kullanıcı alanı bir kez düzenledikten sonra seçimini korur.
  useEffect(() => {
    if (variant !== "purchase-desk" || !resolvedData || metrajTouched) return;
    setMetraj(
      resolvedData.kamyonM2.toLocaleString("tr-TR", {
        useGrouping: false,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    );
    setPlanIdx(0);
  }, [metrajTouched, resolvedData, variant]);

  // Sabit mobil sipariş çubuğu sayfa sonundaki içeriği örtmesin. Bileşen
  // ayrıldığında veya normal masaüstü CTA düzenine geçildiğinde mevcut body
  // boşluğu korunur. Kısa masaüstünde sabitlenen ana CTA da güvenli alan alır.
  useEffect(() => {
    if (!hasPurchaseSticky) return;

    const body = document.body;
    const previousPaddingBottom = body.style.paddingBottom;
    const desktopQuery = window.matchMedia("(min-width: 1280px) and (min-height: 880px)");
    const syncSafeSpace = () => {
      body.style.paddingBottom = desktopQuery.matches
        ? previousPaddingBottom
        : "calc(12.5rem + env(safe-area-inset-bottom))";
    };

    syncSafeSpace();
    desktopQuery.addEventListener("change", syncSafeSpace);

    return () => {
      desktopQuery.removeEventListener("change", syncSafeSpace);
      body.style.paddingBottom = previousPaddingBottom;
    };
  }, [hasPurchaseSticky]);

  const buildPurchaseAnalyticsPayload = () => {
    if (
      !product ||
      !resolvedData ||
      !purchaseCalculation?.requestedM2 ||
      !purchaseCalculation.selectedOrder ||
      !purchaseCalculation.selectedLabel ||
      !purchaseCalculation.selectedCapacityM2 ||
      purchaseAreaError
    ) return null;
    const categoryContext = getCategoryEntryContext();
    return {
      product_name: product.name,
      brand_name: product.brand.name,
      category_name: product.category.name,
      material_type: product.material_type,
      thickness_cm: activeThicknessCm ?? thicknessCm ?? null,
      city_code: cityCode,
      city_name: cityName,
      area_m2: purchaseCalculation.requestedM2,
      total_m2: purchaseCalculation.selectedOrder.orderM2,
      package_count: purchaseCalculation.selectedOrder.packageCount,
      price_per_m2: resolvedData.salePricePerM2,
      total_price: purchaseCalculation.selectedOrder.totalExVat,
      vehicle_type: purchaseCalculation.selectedVehicleType,
      product_slug: product.slug,
      result_session_id: resultSessionId,
      entry_surface: categoryContext ? "category" as const : "product_detail" as const,
      catalog_journey_id: categoryContext ? readCatalogJourneyId() : null,
      section_key: categoryContext?.sectionKey ?? null,
      sub_region_name: subChoice ? SUB_LABELS[subChoice] : null,
      vehicle_label: purchaseCalculation.selectedLabel,
      shipping_mode: "included_in_sale_price" as const,
      experience_variant: "a_whatsapp_first" as const,
    };
  };

  useEffect(() => {
    if (
      variant !== "purchase-desk" ||
      !resolvedData ||
      !purchaseCalculation?.selectedOrder ||
      !purchaseCalculation.selectedLabel ||
      !product ||
      purchaseAreaError
    ) return;
    const signature = [
      product.id,
      modelShortName,
      thicknessCm ?? "none",
      cityCode,
      subChoice ?? "none",
      purchaseCalculation.selectedLabel,
      purchaseCalculation.selectedOrder.orderM2,
      resolvedData.salePricePerM2,
    ].join("|");
    if (lastPriceViewRef.current === signature) return;
    lastPriceViewRef.current = signature;

    const payload = buildPurchaseAnalyticsPayload();
    if (payload) notifyProductDetailPriceView({ ...payload, source_channel: "catalog" });
    // Payload builder istemci bağlamını tıklama/efekt anında okur; signature
    // aynı fiyat görünümünün çift bildirimini engeller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    variant,
    resolvedData,
    purchaseCalculation?.selectedLabel,
    purchaseCalculation?.selectedOrder?.orderM2,
    product,
    modelShortName,
    thicknessCm,
    cityCode,
    subChoice,
    purchaseAreaError,
  ]);

  if (variant === "purchase-desk") {
    const analyticsPayload = buildPurchaseAnalyticsPayload();
    const subRegionName = subChoice ? SUB_LABELS[subChoice] : undefined;
    const pricedThickness = activeThicknessCm ?? thicknessCm ?? null;
    const message =
      resolvedData &&
      purchaseCalculation?.selectedOrder &&
      purchaseCalculation.selectedLabel &&
      product &&
      !purchaseAreaError
      ? generateQuoteWhatsAppMessage({
          productName: product.name,
          thicknessCm: activeThicknessCm ?? thicknessCm ?? null,
          metrajM2: purchaseCalculation.selectedOrder.orderM2,
          vehicleLabel: purchaseCalculation.selectedLabel,
          cityName,
          pricePerM2: resolvedData.salePricePerM2,
          totalKdvHaric: purchaseCalculation.selectedOrder.totalExVat,
          shippingMessage: "tam araç planında fiyata dahil",
          refCode: purchaseRefCode ?? undefined,
          subRegionName,
        })
      : null;
    const whatsappHref = message ? buildWhatsAppLink(message) : null;

    const trackWhatsapp = (ctaLocation: "product_detail_summary" | "sticky_mobile") => {
      if (!product) return;
      notifyWhatsappIntent({
        source: "product_detail_summary",
        productName: product.name,
        resultSessionId,
        ctaLocation,
        experienceVariant: "a_whatsapp_first",
        pricedContext:
          resolvedData &&
          purchaseCalculation?.selectedOrder &&
          purchaseCalculation.selectedLabel &&
          pricedThickness &&
          purchaseRefCode &&
          !purchaseAreaError
            ? {
                refCode: purchaseRefCode,
                modelName: modelShortName,
                thicknessCm: pricedThickness,
                cityCode,
                cityName,
                subRegionName,
                areaM2: purchaseCalculation.selectedOrder.orderM2,
                packageCount: purchaseCalculation.selectedOrder.packageCount,
                vehicleType: purchaseCalculation.selectedVehicleType ?? "mixed",
                vehicleLabel: purchaseCalculation.selectedLabel,
                pricePerM2: resolvedData.salePricePerM2,
                totalExVat: purchaseCalculation.selectedOrder.totalExVat,
                shippingMode: "included_in_sale_price",
              }
            : undefined,
      });
      if (analyticsPayload) {
        notifyProductDetailCtaClick({
          ...analyticsPayload,
          cta_type: "whatsapp",
          cta_location: ctaLocation,
        });
      }
    };

    const trackPdfOpen = () => {
      if (!analyticsPayload) return;
      notifyProductDetailCtaClick({
        ...analyticsPayload,
        cta_type: "pdf",
        cta_location: "product_detail_summary",
      });
      notifyProductDetailFormOpen({
        ...analyticsPayload,
        form_type: "pdf",
        cta_location: "product_detail_summary",
      });
    };

    return (
      <div className="mt-4" data-testid="bonus-region-price">
        {subInfo && (
          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-semibold text-[#bdb5a8]">
              {subInfo.question === "yaka" ? "Teslim yakası" : "Teslim bölgesi"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(subInfo.options) as BonusSubRegionChoice[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setSubChoice(choice)}
                  aria-pressed={subChoice === choice}
                  className={`min-h-11 rounded-[10px] border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2aa55] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1d1a] ${
                    subChoice === choice
                      ? "border-[#d2aa55] bg-[#d2aa55]/12 text-[#f0d38d]"
                      : "border-white/15 bg-[#111310] text-[#d1c9bd] hover:border-[#d2aa55]/45"
                  }`}
                >
                  {SUB_LABELS[choice]}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.status === "loading" && (
          <div className="space-y-3 border-y border-white/10 py-5">
            <div aria-hidden="true" className="h-3 w-28 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
            <div aria-hidden="true" className="h-10 w-52 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
            <p
              className="text-sm text-[#aba397]"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-testid="pdp-price-status"
            >
              Bölge fiyatı hesaplanıyor…
            </p>
          </div>
        )}

        {state.status === "idle" && (
          <p className="rounded-[10px] border border-white/10 bg-white/[0.025] px-3 py-4 text-sm text-[#b8b1a6]">
            Bölge ve kalınlık seçiminizden sonra güncel m² fiyatı gösterilir.
          </p>
        )}

        {state.status === "error" && (
          <div
            className="rounded-[10px] border border-red-400/25 bg-red-950/20 px-3 py-4 text-sm leading-5 text-red-100"
            role="alert"
          >
            <p>
              {state.reason === "thickness_unavailable"
                ? "Bu kalınlık üreticinin fiyat listesinde yer almıyor; farklı bir kalınlık seçin."
                : "Bölge fiyatı şu anda hesaplanamıyor; seçimlerinizi değiştirmeden yeniden deneyebilirsiniz."}
            </p>
            {state.reason !== "thickness_unavailable" && (
              <button
                type="button"
                onClick={() => setRetryNonce((value) => value + 1)}
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[8px] border border-red-200/30 bg-white/[0.06] px-4 text-xs font-bold text-white transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2b1414]"
              >
                Fiyatı yeniden hesapla
              </button>
            )}
          </div>
        )}

        {resolvedData && purchaseCalculation && (
          <div>
            <div
              className="border-y border-white/10 py-3"
              aria-live="polite"
              aria-atomic="true"
              data-testid="pdp-price-status"
            >
              <p className="text-xs font-medium text-[#aaa296]">Bölge fiyatı · levha</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2 font-heading text-[2.5rem] font-extrabold leading-none tracking-[-0.035em] text-white">
                {fmt(resolvedData.salePricePerM2)}
                <span className="text-base font-bold tracking-normal text-[#e1c57e]">₺/m²</span>
              </p>
              <p className="mt-2 text-xs leading-5 text-[#aaa296]">
                KDV hariç · {modelShortName} · {thicknessCm} cm · {cityName}
                {subLabel} teslim
              </p>
            </div>

            <label className="mt-3 block" htmlFor="bonus-purchase-metraj">
              <span className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-[#bdb5a8]">
                <span>İhtiyaç metrajı</span>
                <span className="font-normal text-[#8f887d]">Tam araç planına dönüştürülür</span>
              </span>
              <span className="relative block">
                <input
                  id="bonus-purchase-metraj"
                  aria-label="İhtiyaç metrajı"
                  aria-invalid={Boolean(purchaseAreaError)}
                  aria-describedby={purchaseAreaError ? "bonus-purchase-metraj-error" : undefined}
                  inputMode="decimal"
                  autoComplete="off"
                  value={metraj}
                  onChange={(event) => {
                    setMetraj(event.target.value);
                    setMetrajTouched(true);
                    setPlanIdx(0);
                  }}
                  className={`min-h-12 w-full rounded-[10px] border bg-[#111310] px-3 pr-11 text-sm font-semibold text-[#f5eee4] outline-none transition-colors focus:ring-2 ${
                    purchaseAreaError
                      ? "border-red-400/70 hover:border-red-300 focus:border-red-300 focus:ring-red-400/20"
                      : "border-white/15 hover:border-[#d2aa55]/45 focus:border-[#d2aa55] focus:ring-[#d2aa55]/20"
                  }`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#91897d]">
                  m²
                </span>
              </span>
            </label>

            {purchaseAreaError && (
              <p
                id="bonus-purchase-metraj-error"
                data-testid="pdp-metraj-error"
                role="alert"
                className="mt-1.5 text-[11px] font-semibold leading-4 text-red-200"
              >
                {purchaseAreaError}
              </p>
            )}

            {hasValidPurchasePlan && (
              <div className="mt-3" data-testid="pdp-vehicle-plans">
                <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.025]">
                  <div className="border-r border-white/10 px-3 py-2.5">
                    <span className="block text-[10px] font-semibold text-[#999185]">Proje ihtiyacı</span>
                    <strong className="mt-1 block text-sm font-bold tabular-nums text-[#f4ede2]">
                      {fmt(purchaseCalculation.requestedM2 ?? 0, 2)} m²
                    </strong>
                  </div>
                  <div className="px-3 py-2.5" data-testid="pdp-order-amount">
                    <span className="block text-[10px] font-semibold text-[#c7ad6d]">Sipariş miktarı</span>
                    <strong className="mt-1 block text-sm font-bold tabular-nums text-white">
                      {fmt(purchaseCalculation.selectedOrder?.orderM2 ?? 0, 2)} m²
                    </strong>
                  </div>
                </div>

                <p className="mb-2 text-[11px] font-semibold leading-5 text-[#c9c1b5]">
                  İhtiyacı karşılayan geçerli tam araç planı
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {purchaseCalculation.plans.map((plan, index) => {
                      const order = buildBonusPlateOrder(
                        {
                          salePricePerM2: resolvedData.salePricePerM2,
                          packageM2: resolvedData.packageM2,
                        },
                        plan.planM2,
                      );
                      if (!order) return null;
                      const active = index === purchaseCalculation.safePlanIdx;
                      const cardClass = `min-h-[72px] rounded-[11px] border px-3 py-2 text-left transition-all ${
                        active
                          ? "border-[#d2aa55] bg-[#d2aa55]/12 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                          : "border-white/15 bg-[#111310] hover:-translate-y-px hover:border-[#d2aa55]/45"
                      }`;
                      const content = (
                        <>
                          <span className="flex items-center justify-between gap-2">
                            <strong className="text-sm font-bold text-white">{plan.label}</strong>
                            {purchaseCalculation.plans.length === 1 && (
                              <span className="text-[10px] font-bold text-[#e2c57e]">Tek geçerli plan</span>
                            )}
                          </span>
                          <span className="mt-1 block text-xs text-[#aaa296]">{fmt(order.orderM2, 2)} m²</span>
                          <span className="mt-1.5 block text-sm font-bold tabular-nums text-[#e2c57e]">
                            {fmt(order.totalExVat)} ₺
                          </span>
                        </>
                      );

                      if (purchaseCalculation.plans.length === 1) {
                        return (
                          <div
                            key={plan.label}
                            data-testid="pdp-single-valid-plan"
                            aria-label={`${plan.label}, tek geçerli plan`}
                            className={cardClass}
                          >
                            {content}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={plan.label}
                          type="button"
                          onClick={() => setPlanIdx(index)}
                          aria-pressed={active}
                          className={`${cardClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2aa55] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1d1a]`}
                        >
                          {content}
                        </button>
                      );
                    })}
                </div>

                {purchaseCalculation.requestedM2 &&
                  purchaseCalculation.selectedOrder &&
                  purchaseCalculation.selectedLabel &&
                  Math.abs(purchaseCalculation.selectedOrder.orderM2 - purchaseCalculation.requestedM2) > 0.5 && (
                    <p className="mt-2 text-[11px] leading-4 text-[#999185]">
                      {fmt(purchaseCalculation.requestedM2, 2)} m² proje ihtiyacı korunur; sipariş miktarı sevkiyata uygun {purchaseCalculation.selectedLabel} kapasitesidir.
                    </p>
                  )}

                {purchaseCalculation.lowerAdjustment && (
                  <div
                    data-testid="pdp-lower-vehicle-option"
                    className="mt-3 rounded-[10px] border border-[#d2aa55]/25 bg-[#d2aa55]/[0.06] px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <div>
                        <p className="text-xs font-bold text-[#f2e8d7]">
                          Yakın alt seçenek: {purchaseCalculation.lowerAdjustment.plan.label}
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-[#aaa296]">
                          {fmt(purchaseCalculation.lowerAdjustment.plan.planM2, 2)} m² kapasite · ihtiyacınızdan {fmt(purchaseCalculation.lowerAdjustment.shortfallM2, 2)} m² eksik
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMetraj(
                          purchaseCalculation.lowerAdjustment!.plan.planM2.toLocaleString("tr-TR", {
                            useGrouping: false,
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          }),
                        );
                        setMetrajTouched(true);
                        setPlanIdx(0);
                      }}
                      className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-[8px] border border-[#d2aa55]/35 bg-[#d2aa55]/10 px-3 text-[11px] font-bold text-[#ecd18c] transition-colors hover:border-[#d2aa55]/60 hover:bg-[#d2aa55]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2aa55] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1d1a]"
                    >
                      Metrajı {fmt(purchaseCalculation.lowerAdjustment.plan.planM2, 2)} m² yap ve {purchaseCalculation.lowerAdjustment.plan.label} seç
                    </button>
                  </div>
                )}
              </div>
            )}

            {whatsappHref && product && (
              <>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsapp("product_detail_summary")}
                  data-testid="pdp-whatsapp-primary"
                  className="mt-3 hidden min-h-[52px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#35b975] bg-[#22a861] px-4 text-center text-sm font-black text-[#07140d] shadow-[0_14px_32px_rgba(9,120,66,0.25)] transition-all hover:-translate-y-px hover:bg-[#31bd72] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ce1aa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1d1a] xl:flex [@media(min-width:1280px)_and_(max-height:879px)]:fixed [@media(min-width:1280px)_and_(max-height:879px)]:bottom-[calc(5.5rem+env(safe-area-inset-bottom))] [@media(min-width:1280px)_and_(max-height:879px)]:right-6 [@media(min-width:1280px)_and_(max-height:879px)]:z-40 [@media(min-width:1280px)_and_(max-height:879px)]:w-[min(28rem,calc(100vw-3rem))]"
                >
                  <MessageCircle aria-hidden="true" className="h-5 w-5" />
                  WhatsApp’ta {purchaseCalculation.selectedLabel} Siparişini Başlat
                </a>
                <p className="mt-1.5 hidden text-center text-[11px] leading-4 text-[#999185] [@media(min-width:1280px)_and_(min-height:880px)]:block">
                  Ürün, teslim bölgesi ve fiyat özeti hazır mesaja eklenir.
                </p>
              </>
            )}

            <div className="mt-3 grid gap-2 text-xs leading-[1.45] text-[#c4bcae] sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#55cd88]" />
                <p>
                  <strong className="text-[#eee7dc]">Tam araçta nakliye fiyata dahil.</strong>{" "}
                  Tutar KDV hariçtir.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#55cd88]" />
                <p>
                  <strong className="text-[#eee7dc]">ÖzerGrup satışı.</strong>{" "}
                  Bonus yetkili bayisi.
                </p>
              </div>
            </div>

            <div
              data-testid="pdp-payment-methods"
              className="mt-2.5 flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.025] px-3 py-2"
            >
              <span aria-hidden="true" className="flex shrink-0 items-center gap-1.5 text-[#e2c57e]">
                <CreditCard className="h-[18px] w-[18px]" />
                <Landmark className="h-[18px] w-[18px]" />
              </span>
              <p className="text-xs leading-[1.45] text-[#c2baae]">
                <strong className="font-bold text-[#eee7dc]">Kredi kartı veya banka havalesi.</strong>{" "}
                Ödeme sipariş onayında tek seferde alınır.
              </p>
            </div>

            {product &&
              purchaseCalculation.selectedCapacityM2 &&
              purchaseCalculation.selectedLabel &&
              purchaseCalculation.selectedOrder &&
              !purchaseAreaError && (
              <div data-testid="pdp-pdf-secondary" className="mt-2">
                <SingleProductQuoteButton
                  product={product}
                  activeThickness={activeThicknessCm ?? thicknessCm ?? null}
                  pricePerM2KdvHaric={resolvedData.salePricePerM2}
                  neededM2={purchaseCalculation.selectedCapacityM2}
                  cityCode={cityCode}
                  cityName={cityName}
                  tierLabel={purchaseCalculation.selectedLabel}
                  isShippingIncluded={true}
                  vehicleType={purchaseCalculation.selectedVehicleType}
                  label="Referanslı PDF teklifini hazırla"
                  resultSessionId={resultSessionId}
                  packageSizeM2={resolvedData.packageM2}
                  modelNameOverride={modelShortName}
                  onOpen={trackPdfOpen}
                  buttonClassName="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border-0 bg-transparent px-3 text-xs font-bold text-[#e2c57e] transition-colors hover:bg-white/[0.035] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2aa55] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1d1a]"
                />
              </div>
            )}

            {whatsappHref && purchaseCalculation.selectedOrder && purchaseCalculation.selectedLabel && (
              <div
                data-testid="pdp-mobile-order-sticky"
                className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 rounded-[14px] border border-white/15 bg-[#171916]/95 p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-md xl:hidden"
              >
                <div className="mx-auto flex max-w-screen-sm items-center gap-2.5">
                  <div className="min-w-0 flex-1 px-1">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d9b968]">
                      {purchaseCalculation.selectedLabel} · {fmt(purchaseCalculation.selectedOrder.orderM2, 1)} m²
                    </p>
                    <p className="mt-0.5 truncate text-sm font-black leading-none text-white">
                      {fmt(purchaseCalculation.selectedOrder.totalExVat, 0)} ₺
                    </p>
                    <p className="mt-1 text-[10px] leading-none text-[#a9a195]">KDV hariç</p>
                  </div>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackWhatsapp("sticky_mobile")}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#22a861] px-4 text-xs font-black text-[#07140d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ce1aa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171916]"
                  >
                    <MessageCircle aria-hidden="true" className="h-[18px] w-[18px]" />
                    Siparişi Başlat
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

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
        <p className="text-sm text-fe-muted">Seçiminizden sonra üreticinin bölge listesindeki m² fiyatı gösterilir.</p>
      )}

      {state.status === "ok" && state.requestKey === currentRequestKey && (
        <div>
          <div aria-live="polite" aria-atomic="true">
            <p className="text-2xl font-extrabold leading-none text-white">
              {fmt(state.data.salePricePerM2)}
              <span className="ml-1 text-brand-300">₺/m²</span>
            </p>
            <p className="mt-1 text-[11px] leading-snug text-fe-muted-strong">
              KDV hariç · {modelShortName} · {thicknessCm} cm · {cityName}
              {subLabel} teslim
            </p>
          </div>

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
            // Metraj girildiyse tam araç planları (formül: tam TIR'lara böl;
            // kalan kamyona sığıyorsa 1 Kamyon, sığmıyorsa +1 TIR; varsayılan
            // yukarı tam-TIR yuvarlaması).
            const neededM2 = (() => {
              const n = parseFloat(metraj.replace(/\./g, "").replace(",", "."));
              return Number.isFinite(n) && n > 0 ? n : null;
            })();
            const plans = neededM2
              ? buildBonusVehiclePlans(neededM2, state.data.kamyonM2, state.data.tirM2)
              : [];
            const selectedPlan = plans.length > 0 ? plans[Math.min(planIdx, plans.length - 1)] : null;
            const selectedPlanOrder = selectedPlan
              ? buildBonusPlateOrder(
                  { salePricePerM2: state.data.salePricePerM2, packageM2: state.data.packageM2 },
                  selectedPlan.planM2,
                )
              : null;
            // Ekranda snap'li orderM2 (paket gerçekliği) gösterilir; ancak
            // /api/quotes tam-araç doğrulaması ham kapasiteyi (kamyonM2/tirM2
            // veya plan toplamını) bekler — snap 2 cm² aşağı düşürünce
            // "minimum m² gereklidir" ile reddediyordu. PDF/kayıt ham
            // kapasiteyle gider (kanonik değer, eski tekliflerle tutarlı).
            const capacityM2 = selectedPlan
              ? selectedPlan.planM2
              : vehicle === "kamyon" ? state.data.kamyonM2 : state.data.tirM2;
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
                {pdfEnabled && (
                  <div className="flex items-center gap-2 px-2 pb-1.5">
                    <label htmlFor="bonus-metraj" className="shrink-0 text-[11px] text-fe-muted">
                      Metraj (m²)
                    </label>
                    <input
                      id="bonus-metraj"
                      inputMode="numeric"
                      value={metraj}
                      onChange={(e) => {
                        setMetraj(e.target.value);
                        setPlanIdx(0);
                      }}
                      className="w-full rounded-md border border-fe-border bg-fe-bg/60 px-2.5 py-1.5 text-sm text-fe-text focus:border-brand-400 focus:outline-none"
                    />
                    {metraj && (
                      <button
                        type="button"
                        onClick={() => { setMetraj(""); setPlanIdx(0); }}
                        className="shrink-0 text-[11px] text-fe-muted underline-offset-2 hover:underline"
                      >
                        temizle
                      </button>
                    )}
                  </div>
                )}
                {pdfEnabled && plans.length > 0 ? (
                  <>
                    {plans.map((p, i) => {
                      const order = buildBonusPlateOrder(
                        { salePricePerM2: state.data.salePricePerM2, packageM2: state.data.packageM2 },
                        p.planM2,
                      );
                      if (!order) return null;
                      const active = i === Math.min(planIdx, plans.length - 1);
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setPlanIdx(i)}
                          aria-pressed={active}
                          className={`flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors cursor-pointer ${
                            active ? "bg-brand-900/30 ring-1 ring-brand-500/50" : "hover:bg-fe-raised/60"
                          }`}
                        >
                          <span className={active ? "font-semibold text-brand-200" : "text-fe-muted"}>
                            {p.label} · {fmt(order.orderM2, 1)} m²
                          </span>
                          <span className="font-bold tabular-nums text-white">{fmt(order.totalExVat)} ₺</span>
                        </button>
                      );
                    })}
                    <p className="px-2 text-[10px] leading-snug text-fe-muted">
                      {fmt(neededM2 ?? 0, 0)} m² ihtiyaç tam araç planına yuvarlandı; ara metraja teklif oluşturulmaz.
                    </p>
                  </>
                ) : pdfEnabled ? (
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
                      tierLabel={selectedPlan ? selectedPlan.label : vehicle === "kamyon" ? "Kamyon" : "TIR"}
                      isShippingIncluded={true}
                      vehicleType={selectedPlan ? selectedPlan.vehicleType : vehicle === "kamyon" ? "lorry" : "truck"}
                      label={`PDF teklifimi hazırla · ${selectedPlan ? selectedPlan.label : vehicle === "kamyon" ? "1 Kamyon" : "1 TIR"}`}
                      resultSessionId={resultSessionId}
                      packageSizeM2={state.data.packageM2}
                      modelNameOverride={modelShortName}
                    />
                    <p className="mt-1.5 text-center text-[10px] leading-snug text-fe-muted">
                      Seçili tam araç planıyla (
                      {selectedPlan
                        ? `${selectedPlan.label} · ${fmt(selectedPlanOrder?.orderM2 ?? selectedPlan.planM2, 1)} m²`
                        : `${vehicle === "kamyon" ? "1 Kamyon" : "1 TIR"} · ${fmt(selected.orderM2, 1)} m²`}
                      ) hazırlanır.
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
        <div className="text-sm text-fe-muted" role="alert">
          <p>
            {state.reason === "thickness_unavailable"
              ? "Bu kalınlık üreticinin fiyat listesinde yer almıyor; farklı bir kalınlık seçin."
              : "Bölge fiyatı şu anda hesaplanamıyor; seçimlerinizi değiştirmeden yeniden deneyebilirsiniz."}
          </p>
          {state.reason !== "thickness_unavailable" && (
            <button
              type="button"
              onClick={() => setRetryNonce((value) => value + 1)}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-500/40 bg-brand-900/20 px-4 text-xs font-bold text-brand-200 transition-colors hover:bg-brand-900/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              Fiyatı yeniden hesapla
            </button>
          )}
        </div>
      )}
    </div>
  );
}

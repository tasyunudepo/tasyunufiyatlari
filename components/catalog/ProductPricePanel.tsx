"use client";

// TODO (teknik borç): URL parsing `?kalinlik=7.5cm` için parseInt kullanılıyor
// (app/urunler/[kategori]/[slug]/page.tsx:116) → 7.5 cm'lik kalınlıklar 7 olarak parse ediliyor.
// Düzeltme: parseFloat veya '7-5' URL formatına geçirilmesi gerekecek.
// Bu dosya kapsamında değil; ayrı bir PR'da ele alınacak.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowRight, ChevronDown, Layers, MapPin, Package } from "lucide-react";
import {
  notifyProductDetailCtaClick,
  notifyProductDetailFormOpen,
  notifyProductDetailPriceView,
  type ProductDetailCtaLocation,
} from "@/lib/notifyWizardEvent";
import {
  applyMargin,
  resolveMarginPctStrict,
  type MarginRuleInput,
} from "@/lib/pricing/margin";
import { buildQuoteSurfacePricing } from "@/lib/pricing/quoteTotals";

import type { CatalogProductView, DecisionContext, WizardPrefill } from "@/lib/catalog/types";
import { getPriceDisplay } from "@/lib/catalog/decision";
import SepetUI, { type SepetState } from "./SepetUI";
import SingleProductQuoteButton from "./SingleProductQuoteButton";
import WizardLinkButton from "./WizardLinkButton";
import BonusRegionPrice from "./BonusRegionPrice";
import BonusAlternativeCard from "./BonusAlternativeCard";
import { getBonusFamily, isUnpricedBonusModel } from "@/lib/pricing/bonus/families";
import { getProfileByModel } from "@/lib/technical-profiles";
import { useProductInteractiveOptional } from "./ProductInteractiveContext";
import { getCategoryEntryContext } from "@/lib/catalog/category-entry-context";
import { readCatalogJourneyId } from "@/lib/analytics/catalogJourney";
import type { ProductLogisticsCapacity } from "@/lib/catalog/package-details";

export type { ProductLogisticsCapacity } from "@/lib/catalog/package-details";

export interface ProductShippingZone {
  city_code: number;
  city_name: string;
  base_shipping_cost: string | number;
  optimix_levha_discount: string | number;
  discount_kamyon: string | number;
  discount_tir: string | number;
}

interface Props {
  product: CatalogProductView;
  decision: DecisionContext;
  prefill: WizardPrefill | null;
  shippingZones: ProductShippingZone[];
  logisticsCapacity: ProductLogisticsCapacity[];
  selectedThickness: number | null;
  hideHeroPriceOnMobile?: boolean;
  hideHeroPrice?: boolean;
  presentation?: "default" | "warm-commercial";
}

const roundM2 = (value: number): number => Math.round(value * 10) / 10;
const formatM2Input = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(roundM2(value));
const formatCurrency = (value: number): string =>
  value.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const formatM2 = (value: number): string =>
  value.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export default function ProductPricePanel({
  product,
  decision,
  prefill,
  shippingZones,
  logisticsCapacity,
  selectedThickness,
  hideHeroPriceOnMobile = false,
  hideHeroPrice = false,
  presentation = "default",
}: Props) {
  const isWarmCommercial = presentation === "warm-commercial";
  const defaultCity = shippingZones.find((z) => z.city_code === 34) ?? shippingZones[0];
  const interactive = useProductInteractiveOptional();
  const [localCode, setLocalCode] = useState<number>(defaultCity?.city_code ?? 34);
  // Provider varsa city state context'ten; yoksa local (geri uyumlu)
  const selectedCode = interactive?.cityCode ?? localCode;
  const setSelectedCode = (code: number) => {
    if (interactive) interactive.setCityCode(code);
    else setLocalCode(code);
  };
  const [neededM2, setNeededM2] = useState<string>("");
  const [debouncedM2, setDebouncedM2] = useState<string>("");
  type MetrajMode = "custom" | "lorry" | "truck";
  const [, setMetrajMode] = useState<MetrajMode>("custom");
  // Bonus aile-PDP'de seçili yoğunluk varyantı (null = plate'in kendi modeli)
  const [bonusVariantModel, setBonusVariantModel] = useState<string | null>(null);
  const [resultSessionId] = useState(() =>
    `pdp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );
  const lastPriceViewRef = useRef<string>("");
  const primaryCtaRef = useRef<HTMLDivElement | null>(null);
  const [showMobileSticky, setShowMobileSticky] = useState(false);
  const [loadedMarginRule, setLoadedMarginRule] = useState<{
    slug: string;
    rule: MarginRuleInput;
  } | null>(null);
  const marginRule = loadedMarginRule?.slug === product.material_type
    ? loadedMarginRule.rule
    : null;

  // Mobil yapışkan teklif özeti yalnız kullanıcı ana CTA'yı gördükten ve
  // aşağısına geçtikten sonra açılır. Böylece varsayılan araç/metraj,
  // kullanıcı karar vermeden ürün görselinin üzerine bindirilmez.
  useEffect(() => {
    let frame = 0;
    const syncSticky = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const cta = primaryCtaRef.current;
        if (!cta) {
          setShowMobileSticky(false);
          return;
        }
        const ctaBottom = cta.getBoundingClientRect().bottom + window.scrollY;
        const footer = document.querySelector("footer");
        const footerTop = footer
          ? footer.getBoundingClientRect().top + window.scrollY
          : Number.POSITIVE_INFINITY;
        const viewportBottom = window.scrollY + window.innerHeight;
        setShowMobileSticky(window.scrollY > ctaBottom && viewportBottom < footerTop);
      });
    };

    const initialSync = window.setTimeout(syncSticky, 500);
    window.addEventListener("scroll", syncSticky, { passive: true });
    window.addEventListener("resize", syncSticky);
    return () => {
      window.clearTimeout(initialSync);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncSticky);
      window.removeEventListener("resize", syncSticky);
    };
  }, [product.id]);

  // Ürün sayfası statik üretildiği için marjı doğrudan canlı material_types
  // kaydından okuruz. Kural yoksa/okunamazsa levha fiyatı fail-closed kalır.
  useEffect(() => {
    let active = true;

    if (product.product_type !== "plate") {
      return () => { active = false; };
    }

    void supabase
      .from("material_types")
      .select("slug, tier1_max_m2, tier1_margin_pct, tier2_max_m2, tier2_margin_pct, tier3_margin_pct")
      .eq("slug", product.material_type)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) {
          setLoadedMarginRule({
            slug: product.material_type,
            rule: data as MarginRuleInput,
          });
        }
      });

    return () => { active = false; };
  }, [product.material_type, product.product_type]);

  // Debounce: senaryo hesapları 350ms bekler — "400" yazarken "40" uyarısı tetiklenmez
  useEffect(() => {
    const t = setTimeout(() => setDebouncedM2(neededM2), 350);
    return () => clearTimeout(t);
  }, [neededM2]);
  const [vehicleCardsSlot, setVehicleCardsSlot] = useState<HTMLDivElement | null>(null);

  const [sepetState, setSepetState] = useState<SepetState>({
    kamyon: 0,
    tir: 0,
    autoApplied: false,
    totalM2: 0,
    effectivePrice: null,
    scenario: 'empty',
  });

  // Boş deps: setSepetState React useState'ten gelir → stabil.
  // Boş dep olmadan her render yeni fonksiyon → SepetUI'ın onChange effect'i döngüye girer.
  const setInteractiveOrderPlan = interactive?.setOrderPlan;
  const handleSepetChange = useCallback((state: SepetState) => {
    setSepetState(state);
    setInteractiveOrderPlan?.({
      lorryCount: state.kamyon,
      truckCount: state.tir,
      totalM2: state.totalM2,
    });
  }, [setInteractiveOrderPlan]);

  const zone = shippingZones.find((z) => z.city_code === selectedCode) ?? defaultCity;
  const { rules, base_price, thickness_prices } = product;

  // Provider varsa kalınlık context'ten; yoksa prop. Context yazıldığında
  // panel anında reaktif (URL navigasyonu beklemeden).
  const effectiveThickness = interactive?.activeThickness ?? selectedThickness;

  const activeThicknessPrice = thickness_prices
    ? effectiveThickness
      ? thickness_prices.find((p) => p.thickness === effectiveThickness) ?? thickness_prices[0]
      : thickness_prices.find((p) => p.thickness === (prefill?.kalinlik ?? null)) ?? thickness_prices[0]
    : null;

  const activeThickness = activeThicknessPrice?.thickness ?? selectedThickness;
  const isKdvIncluded = activeThicknessPrice?.is_kdv_included ?? false;
  const rawPrice = activeThicknessPrice?.base_price ?? base_price;
  const neededM2Num = (() => {
    const raw = debouncedM2 ? parseFloat(debouncedM2.replace(",", ".")) : 0;
    return isNaN(raw) || raw < 0 ? 0 : raw;
  })();

  // logistics_capacity.thickness mm cinsinden tutuluyor (50, 75, 125)
  // activeThickness cm cinsinden (5, 7.5, 12.5) — ×10 ile mm'ye çevrilir
  const logistics =
    logisticsCapacity.find((l) => l.thickness === (activeThickness ?? 0) * 10) ?? null;

  // Ürün-thickness başına package_m2 öncelikli; yoksa logistics genel default'u.
  // EPS vs taşyünü için aynı thickness'ta paket m² farklı → araç kapasiteleri yeniden hesaplanır.
  // Wizard'daki mantığın aynısı (WizardCalculator.tsx:142-149).
  const realPkgM2 = logistics
    ? Number(activeThicknessPrice?.package_m2 ?? logistics.package_size_m2)
    : null;
  const lorryPackages = logistics ? Number(logistics.lorry_capacity_packages) : null;
  const truckPackages = logistics ? Number(logistics.truck_capacity_packages) : null;

  const packageSizeM2 = realPkgM2;
  const lorryM2 =
    lorryPackages != null && realPkgM2 != null && Number.isFinite(realPkgM2)
      ? roundM2(lorryPackages * realPkgM2)
      : null;
  const truckM2 =
    truckPackages != null && realPkgM2 != null && Number.isFinite(realPkgM2)
      ? roundM2(truckPackages * realPkgM2)
      : null;

  const discKamyon = zone ? parseFloat(String(zone.discount_kamyon)) : 0;
  const discTir = zone ? parseFloat(String(zone.discount_tir)) : 0;

  const isk2 = (activeThicknessPrice?.discount_2 ?? 8) / 100;
  const kdvHaricListe = rawPrice !== null ? (isKdvIncluded ? rawPrice / 1.2 : rawPrice) : null;
  const pricePerM2Base =
    kdvHaricListe !== null && packageSizeM2 && packageSizeM2 > 0
      ? kdvHaricListe / packageSizeM2
      : kdvHaricListe;

  // Gösterilen birim fiyat = hesaplanan toplam / m²: 342,34 ₺ × 806 = 275.946 ₺.
  // calcPrice çıktısı kuruşa yuvarlanır; tüm türev fiyatlar tutarlı.
  function calcPrice(isk1Pct: number, areaM2: number | null): number | null {
    if (pricePerM2Base === null || areaM2 == null) return null;
    const marginPct = resolveMarginPctStrict(marginRule, areaM2);
    if (marginPct === null) return null;
    const discountedNet = pricePerM2Base * (1 - isk1Pct / 100) * (1 - isk2);
    return applyMargin(discountedNet, marginPct);
  }

  const selectedOrderAreaM2 = sepetState.totalM2 > 0 ? sepetState.totalM2 : null;
  const referenceAreaM2 = selectedOrderAreaM2 ?? (neededM2Num > 0 ? neededM2Num : null);
  const packageRefPrice = calcPrice(0, referenceAreaM2);
  const lorryPrice = lorryM2
    ? calcPrice(discKamyon, referenceAreaM2 ?? lorryM2)
    : null;
  const truckPrice = truckM2
    ? calcPrice(discTir, referenceAreaM2 ?? truckM2)
    : null;

  // Katalog teklifi fabrika çıkışlıdır; başlangıç metrajı 1 Kamyon kapasitesidir.
  // Kalınlık değişince lorryM2 değişir → effect yeniden tetiklenir (doğal sıfırlama).
  useEffect(() => {
    if (lorryM2 !== null) {
      const val = formatM2Input(lorryM2);
      const syncPrefill = window.setTimeout(() => {
        setNeededM2(val);
        setDebouncedM2(val);
        setMetrajMode("lorry");
      }, 0);
      return () => window.clearTimeout(syncPrefill);
    }
  }, [lorryM2]);

  // Geçerlilik kontrolü direkt neededM2 üzerinden (anlık kırmızı border için)
  const inputInvalid = neededM2 !== "" && (() => {
    const raw = parseFloat(neededM2.replace(",", "."));
    return isNaN(raw) || raw < 0;
  })();

  // CTA label — senaryoya ve araç sayısına göre dinamik
  const ctaLabel = (() => {
    switch (sepetState.scenario) {
      case 'lorry_optimal': return `${sepetState.kamyon} Kamyon için PDF Teklif Al`;
      case 'tir_optimal':   return `${sepetState.tir} TIR için PDF Teklif Al`;
      case 'large_project': return "Büyük Metraj için PDF Teklif Al";
      default:              return "PDF Teklif Al";
    }
  })();
  const isTyping = neededM2 !== debouncedM2;
  // Boş/hesaplanmakta olan sepette CTA pasiftir; teklif yalnız tam araç planıyla açılır.
  // Tam dolu araç (lorry/tir/large_project) siparişinde nakliye dahil fiyat çıkar.
  const sepetBos = sepetState.kamyon === 0 && sepetState.tir === 0;
  const ctaDisabled = isTyping || sepetBos;

  // Hero fiyat mantığı:
  // 1. Sepet dolu → blended effective (kamyon × lorryPrice + TIR × truckPrice / toplam m²)
  // 2. Boş sepet, metraj yok → TIR çıpa (SEO için en avantajlı fiyat)
  const heroPrice =
    sepetState.totalM2 > 0
      ? sepetState.effectivePrice
      : truckPrice ?? lorryPrice;

  // Context'e yaz → MobileProductHero senaryo-aware fiyatı okur (sepet doluyken
  // effectivePrice, boşken TIR çıpa). Mobil hero ile TOPLAM hesabı tek kaynaklı.
  useEffect(() => {
    interactive?.setHeroPrice(heroPrice);
  }, [heroPrice, interactive]);

  const showTierPrice =
    rules.pricing_visibility_mode === "from_price" ||
    rules.pricing_visibility_mode === "exact_price";

  // Bonus levhası: fiyat sunucudan bölgeye göre gelir (Faz 2 canlı fiyat).
  // Genel plate_prices/logistics hesapları Bonus'a uygulanmaz.
  const isBonusPlate = product.product_type === "plate" && product.brand?.name === "Bonus";

  // Aile-PDP yoğunluk seçici (20 Temmuz kararı): Gold / Endüstriyel
  // aileleri tek PDP'de yoğunluk varyantlarıyla sunulur. Seçim yalnız
  // fiyat sorgusundaki modeli değiştirir; fiyat yine sunucudan iner.
  const bonusFamily =
    isBonusPlate && product.model ? getBonusFamily(product.model) : null;
  const effectiveBonusModel = bonusVariantModel ?? product.model;

  // Fiyatı listede olmayan Bonus modeli (Desibel, Marin vb.): canlı fiyat
  // kartı yok; statik "Teklif ile belirlenir" akışı geçerli kalır.
  const isPricedBonusModel =
    isBonusPlate && !!product.model && !isUnpricedBonusModel(product.model);

  // Takım/set teklifi yalnız mantolama ürününde anlamlıdır (20 Temmuz
  // geri bildirimi): giydirme cephe, çatı, tesisat, endüstriyel ve marin
  // ürünlerinde levha+toz seti diye bir şey yok — sistem-teklifi bloğu
  // (Takım Fiyatını Gör) bu ürünlerde hiç render edilmez. Profili
  // olmayan ürünlerde (EPS, aksesuar, toz) davranış değişmez.
  const modelScope = product.model
    ? getProfileByModel(product.model)?.applicationScope ?? null
    : null;
  const systemOfferIrrelevant =
    (modelScope !== null && modelScope !== "sivali_dis_cephe_mantolama") ||
    (isBonusPlate && !!product.model && isUnpricedBonusModel(product.model));

  const showSepet =
    showTierPrice &&
    logistics !== null &&
    lorryM2 !== null &&
    truckM2 !== null &&
    (lorryPrice !== null || truckPrice !== null);

  // Quote parametreleri sepet state'inden türetilir.
  // Karışık sepet (TIR + Kamyon) için "mixed" enum yok, CTA disable de edilmez.
  // vehicleType = null geçmek yeterli: DB'ye null gider (yanıltıcı "truck" gitmez).
  // PDF hesabı zaten doğru: blended heroPrice × totalM2 = gerçek toplam.
  const quoteVehicleType: "lorry" | "truck" | null =
    sepetState.tir > 0 && sepetState.kamyon === 0
      ? "truck"
      : sepetState.kamyon > 0 && sepetState.tir === 0
        ? "lorry"
        : null; // karışık veya boş → null

  const quoteTierLabel =
    sepetState.tir > 0 && sepetState.kamyon > 0
      ? "TIR + Kamyon"
      : sepetState.tir > 0
        ? "TIR"
        : sepetState.kamyon > 0
          ? "Kamyon"
          : "";

  const quoteM2 = sepetState.totalM2 > 0 ? sepetState.totalM2 : neededM2Num;
  const quotePackageCount = packageSizeM2 && quoteM2 > 0
    ? Math.max(1, Math.ceil(quoteM2 / packageSizeM2))
    : null;
  const quoteSurfacePricing = heroPrice !== null && quoteM2 > 0
    ? buildQuoteSurfacePricing(heroPrice * quoteM2, 0, quoteM2)
    : null;
  const quoteTotalKdvHaric = quoteSurfacePricing?.priceWithoutVat ?? null;
  const quotePricePerM2KdvHaric = quoteSurfacePricing?.pricePerM2WithoutVat ?? null;
  const quoteShippingIncluded = sepetState.kamyon > 0 || sepetState.tir > 0;
  const quoteVehicleSummary =
    sepetState.tir > 0 && sepetState.kamyon > 0
      ? `${sepetState.tir} TIR + ${sepetState.kamyon} Kamyon`
      : sepetState.tir > 0
        ? `${sepetState.tir} TIR`
        : sepetState.kamyon > 0
          ? `${sepetState.kamyon} Kamyon`
          : 'Metraj seçimi';
  const productDetailVehicleType =
    sepetState.tir > 0 && sepetState.kamyon > 0
      ? 'mixed' as const
      : quoteVehicleType;

  const buildProductDetailPayload = () => {
    const categoryContext = getCategoryEntryContext();
    return {
      product_name: product.name,
      brand_name: product.brand.name,
      category_name: product.category.name,
      material_type: product.material_type === 'eps' ? 'eps' as const : 'tasyunu' as const,
      thickness_cm: activeThickness ?? null,
      city_code: selectedCode,
      city_name: zone?.city_name ?? null,
      area_m2: neededM2Num || null,
      total_m2: quoteM2 || null,
      package_count: quotePackageCount,
      price_per_m2: heroPrice,
      total_price: quoteTotalKdvHaric,
      vehicle_type: productDetailVehicleType,
      product_slug: product.slug,
      result_session_id: resultSessionId,
      entry_surface: categoryContext?.entrySurface ?? 'product_detail' as const,
      catalog_journey_id: categoryContext ? readCatalogJourneyId() : null,
      section_key: categoryContext?.sectionKey ?? null,
    };
  };

  const trackProductDetailCta = (
    ctaType: 'pdf' | 'whatsapp' | 'phone',
    ctaLocation: ProductDetailCtaLocation = 'product_detail_summary'
  ) => {
    notifyProductDetailCtaClick({
      ...buildProductDetailPayload(),
      cta_type: ctaType,
      cta_location: ctaLocation,
    });
  };

  const trackProductDetailPdfOpen = (
    ctaLocation: ProductDetailCtaLocation = 'product_detail_summary'
  ) => {
    trackProductDetailCta('pdf', ctaLocation);
    notifyProductDetailFormOpen({
      ...buildProductDetailPayload(),
      form_type: 'pdf',
      cta_location: ctaLocation,
    });
  };

  useEffect(() => {
    if (!showTierPrice || heroPrice === null) return;
    const signature = [
      product.id,
      activeThickness ?? 'none',
      selectedCode,
      neededM2Num,
      quoteM2,
      heroPrice,
      productDetailVehicleType ?? 'none',
    ].join('|');
    if (lastPriceViewRef.current === signature) return;
    lastPriceViewRef.current = signature;

    notifyProductDetailPriceView(buildProductDetailPayload());
    // Bilinçli: signature guard çift bildirimi engeller; payload builder'ı
    // bağımlılığa eklemek her render'da efekt tetikler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showTierPrice,
    heroPrice,
    product.id,
    activeThickness,
    selectedCode,
    neededM2Num,
    quoteM2,
    productDetailVehicleType,
  ]);

  return (
    <div className={`space-y-3 pb-32 lg:pb-0 ${isWarmCommercial ? "pdp-warm-commercial text-[#282219]" : ""}`}>
      <div className={isWarmCommercial ? "rounded-[15px] bg-[#fffdf8] p-5 sm:p-6" : "rounded-xl border border-fe-border bg-fe-raised/40 p-5"}>

        {/* ─── Fiyat Görünürlük Kontrolleri (decision.ts tek otorite) ─── */}
        {(() => {
          // Bonus levhası: fiyatı BonusRegionPrice kartı (aşağıda) sunucudan
          // bölgeye göre gösterir. Genel plate_prices yok → getPriceDisplay
          // fiyatı gizler ve yanıltıcı "Teklif ile belirlenir" metnini basardı.
          // Bu statik başlığı Bonus'ta hiç göstermeyip tek fiyat otoritesini
          // BonusRegionPrice'a bırakıyoruz. İstisna: fiyat listesinde
          // olmayan modeller (Desibel, Marin vb.) — onlarda canlı kart
          // yoktur, statik "Teklif ile belirlenir" akışı doğru mesajdır.
          if (isPricedBonusModel || hideHeroPrice) return null;

          // Hero dinamik fiyat hesaplandığında statik etiket gizlenir.
          if (showTierPrice && heroPrice !== null) return null;

          // Zone-aware fiyat — 3 katmanlı:
          //   1. truckPrice (plate, TIR — en agresif zone indirimi)
          //   2. lorryPrice (plate, Kamyon)
          //   3. base_price × (1 − discount_tir%) (aksesuar, logistics yok)
          // Şehir değişimi her durumda fiyatı yeniden hesaplar.
          const accessoryTirPrice =
            base_price != null && zone
              ? Math.round(base_price * (1 - parseFloat(String(zone.discount_tir)) / 100) * 100) / 100
              : base_price;
          const dynamicPrice = product.product_type === 'plate'
            ? truckPrice ?? lorryPrice
            : accessoryTirPrice;

          const display = getPriceDisplay(
            rules,
            dynamicPrice,
            product.product_type === 'plate' ? 'm²' : 'paket'
          );

          // Görünmez kategori (hidden / quote_required) — yine de açıklama satırı göster
          if (!display.visible) {
            return (
              <div className={`mb-4 ${hideHeroPriceOnMobile ? "hidden lg:block" : ""}`}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fe-muted-strong">
                  Fiyat
                </p>
                <p className="text-base font-medium text-fe-text">
                  {rules.pricing_visibility_mode === 'hidden'
                    ? 'Fiyat görüntülenmez'
                    : 'Teklif ile belirlenir'}
                </p>
                {display.note && (
                  <p className="mt-1 text-[11px] text-fe-muted">{display.note}</p>
                )}
              </div>
            );
          }

          // from_price / exact_price → statik başlangıç etiketi
          const isFromPrice = rules.pricing_visibility_mode === 'from_price';
          return (
            <div className={`mb-5 ${hideHeroPriceOnMobile ? "hidden lg:block" : ""}`}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fe-muted-strong">
                {isFromPrice ? 'Başlangıç Fiyatı' : 'Fiyat'}
              </p>
              <p className="text-3xl font-bold leading-none text-white">
                {display.label}
              </p>
              {display.note && (
                <p className="mt-1.5 text-[11px] text-fe-muted">{display.note}</p>
              )}
              <p className="mt-1 text-[11px] text-fe-muted-strong">KDV hariç</p>
            </div>
          );
        })()}

        {/* ─── Hero Fiyat (dinamik — şehir/metraj seçildiğinde) ─── */}
        {!hideHeroPrice && showTierPrice && heroPrice !== null && (
          <div className={`mb-5 ${hideHeroPriceOnMobile ? "hidden lg:block" : ""}`} aria-live="polite" aria-atomic="true">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fe-muted-strong">
              m² Fiyatı
            </p>
            <p className="text-3xl font-bold leading-none text-white">
              {heroPrice.toLocaleString("tr-TR", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
              <span className="ml-1 text-sm font-normal text-fe-muted">₺/m²</span>
            </p>
            <div className="mt-1 space-y-0.5 text-xs leading-5">
              <p className="font-medium text-brand-300/80">Fabrika çıkışlı bayilik fiyatı</p>
              <p className="text-fe-muted-strong">KDV hariç · KDV dahil tutar PDF teklifinde gösterilir</p>
            </div>
            {activeThickness && (
              <p className="mt-1 text-xs text-fe-muted">{activeThickness} cm</p>
            )}
          </div>
        )}

        {shippingZones.length > 0 && (
          <div className={`mb-4 space-y-4 border-b pb-5 ${isWarmCommercial ? "border-[#ded2c0]" : "border-fe-border/60"}`}>
            <div className={isWarmCommercial ? "grid items-start gap-5" : "grid grid-cols-2 items-start gap-3"}>
              {/* SOL — şehir + metraj */}
              <div className={isWarmCommercial ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
                <div>
                  <label htmlFor="pdp-delivery-city" className={`mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] ${isWarmCommercial ? "text-[#625a4f]" : "text-fe-muted-strong"}`}>
                    Teslimat Şehri
                  </label>
                  <div className="relative">
                    <select
                      id="pdp-delivery-city"
                      value={selectedCode}
                      onChange={(e) => setSelectedCode(Number(e.target.value))}
                      className={isWarmCommercial
                        ? "min-h-12 w-full appearance-none rounded-[10px] border border-[#bcae99] bg-white px-3 py-2 pr-8 text-base font-semibold text-[#282219] transition-colors hover:border-[#8f7652] focus:border-[#8a5f1d] focus:outline-none focus:ring-2 focus:ring-[#d8b66f]/40"
                        : "min-h-11 w-full appearance-none rounded-lg border border-fe-border bg-fe-surface px-3 py-2 pr-7 text-sm text-fe-text transition-colors hover:bg-fe-raised focus:outline-none focus:border-brand-500/60 [color-scheme:dark]"}
                    >
                      {shippingZones.map((z) => (
                        <option
                          key={z.city_code}
                          value={z.city_code}
                          className="bg-fe-surface text-fe-text"
                        >
                          {z.city_name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className={`pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 ${isWarmCommercial ? "text-[#625a4f]" : "text-fe-muted"}`} />
                  </div>
                  {zone && (zone.city_code === 34 || [41, 16, 14, 54, 81].includes(zone.city_code)) && (
                    <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${isWarmCommercial ? "text-[#625a4f]" : "text-fe-muted-strong"}`}>
                      <MapPin className={`h-3.5 w-3.5 ${isWarmCommercial ? "text-[#8a5f1d]" : "text-brand-300"}`} aria-hidden="true" />
                      {zone.city_name} bölge iskontosu uygulandı
                    </p>
                  )}
                </div>

                {showSepet && (
                  <div>
                    <label htmlFor="pdp-needed-area" className={`mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] ${isWarmCommercial ? "text-[#625a4f]" : "text-fe-muted-strong"}`}>
                      İhtiyaç Metrajı
                    </label>
                    <div className="relative">
                      <input
                        id="pdp-needed-area"
                        type="text"
                        inputMode="decimal"
                        value={neededM2}
                        onChange={(e) => { setNeededM2(e.target.value); setMetrajMode("custom"); }}
                        className={`w-full rounded-[10px] border px-3 py-2 pr-9 transition-colors focus:outline-none ${isWarmCommercial ? "min-h-12 bg-white text-base font-semibold text-[#282219]" : "min-h-11 bg-fe-bg/80 text-sm text-fe-text"} ${
                          inputInvalid
                            ? "border-red-500/60 focus:border-red-500/80"
                            : isWarmCommercial
                              ? "border-[#bcae99] focus:border-[#8a5f1d] focus:ring-2 focus:ring-[#d8b66f]/40"
                              : "border-brand-500/40 focus:border-brand-500/70 focus:shadow-[0_0_0_2px_rgba(212,132,90,0.10)]"
                        }`}
                      />
                      <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs ${isWarmCommercial ? "text-[#625a4f]" : "text-fe-muted"}`}>
                        m²
                      </span>
                    </div>
                    {inputInvalid && (
                      <p className="mt-1 text-xs text-red-400">Geçerli m² giriniz</p>
                    )}
                  </div>
                )}
              </div>

              {/* SAĞ — Kamyon + TIR vehicle cards (SepetUI'dan portal ile gelir) */}
              {showSepet && (
                <div>
                  {isWarmCommercial && (
                    <div className="mb-3 flex items-end justify-between gap-4">
                      <div>
                        <h2 className="font-heading text-2xl font-extrabold text-[#282219]">Geçerli tam araç planları</h2>
                        <p className="mt-1 text-sm text-[#625a4f]">Araç kapasitesi ve KDV hariç toplamı birlikte karşılaştırın.</p>
                      </div>
                    </div>
                  )}
                  <div ref={setVehicleCardsSlot} className="flex min-w-0 flex-col justify-start" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Bonus canlı bölge fiyatı (Faz 2) + PDF teklif köprüsü ───
            Bonus Direkt Alım'a geçince (single_only + from_price) product
            geçilir → araç seçimli PDF teklif butonu açılır. quote_required
            modunda product geçilmez → yalnız fiyat gösterilir. */}
        {isPricedBonusModel && zone && bonusFamily && bonusFamily.variants.length > 1 && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-fe-muted">
              {bonusFamily.selectorTitle}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bonusFamily.variants.map((v) => {
                const active = v.modelShortName === effectiveBonusModel;
                return (
                  <button
                    key={v.modelShortName}
                    type="button"
                    onClick={() => setBonusVariantModel(v.modelShortName)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "border-brand-400 bg-brand-500/15 text-brand-200"
                        : "border-fe-border text-fe-muted hover:border-brand-400/50 hover:text-fe-text"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isPricedBonusModel && zone && effectiveBonusModel && (
          <div className="mb-4">
            <BonusRegionPrice
              key={effectiveBonusModel}
              modelShortName={effectiveBonusModel}
              thicknessCm={effectiveThickness ?? prefill?.kalinlik ?? null}
              cityCode={zone.city_code}
              cityName={zone.city_name}
              product={rules.sales_mode === "quote_only" ? undefined : product}
              activeThicknessCm={activeThickness ?? effectiveThickness ?? null}
              resultSessionId={resultSessionId}
            />
          </div>
        )}

        {/* ─── Ana teklif aksiyonu: kararın hemen ardından ─── */}
        {showSepet && (
          <div ref={primaryCtaRef} data-testid="pdp-standard-primary-quote" className="mt-4 space-y-3">
            {quoteM2 > 0 && heroPrice !== null && quoteTotalKdvHaric !== null && !inputInvalid && (
              <div
                className={isWarmCommercial
                  ? "flex flex-wrap items-end justify-between gap-3 rounded-[12px] border border-[#cdbb9e] bg-[#f8eddb] px-4 py-3 text-sm"
                  : "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-500/30 bg-brand-950/20 px-3 py-2.5 text-sm"}
                aria-live="polite"
              >
                <span className="sr-only">Teklif Özeti</span>
                <span className={isWarmCommercial ? "font-heading text-lg font-bold text-[#282219]" : "font-semibold text-fe-text"}>
                  {quoteVehicleSummary} · {formatM2(quoteM2)} m²
                </span>
                <span className={isWarmCommercial ? "font-heading text-2xl font-extrabold tabular-nums text-[#282219]" : "font-black tabular-nums text-white"}>
                  {formatCurrency(quoteTotalKdvHaric)} ₺ <span className={`text-xs font-medium ${isWarmCommercial ? "text-[#625a4f]" : "text-fe-muted"}`}>KDV hariç</span>
                </span>
              </div>
            )}
            {ctaDisabled ? (
              <button
                type="button"
                disabled
                className={isWarmCommercial
                  ? "min-h-14 w-full cursor-not-allowed rounded-[10px] border border-[#d1c5b4] bg-[#eee8dd] px-4 py-3.5 font-heading text-base font-bold text-[#777066]"
                  : "min-h-12 w-full cursor-not-allowed rounded-xl border border-fe-border/50 bg-fe-raised/60 px-4 py-3.5 text-sm font-semibold text-fe-muted"}
              >
                {ctaLabel}
              </button>
            ) : (
              <SingleProductQuoteButton
                product={product}
                activeThickness={activeThickness ?? null}
                pricePerM2KdvHaric={quotePricePerM2KdvHaric ?? 0}
                neededM2={quoteM2}
                cityCode={selectedCode}
                cityName={zone?.city_name ?? ""}
                tierLabel={quoteTierLabel}
                isShippingIncluded={quoteShippingIncluded}
                vehicleType={quoteVehicleType}
                label={isWarmCommercial ? "Teklifimi hazırla →" : "PDF teklifimi hazırla"}
                resultSessionId={resultSessionId}
                packageSizeM2={packageSizeM2}
                onOpen={() => trackProductDetailPdfOpen('product_detail_summary')}
                buttonClassName={isWarmCommercial
                  ? "inline-flex min-h-14 w-full items-center justify-center rounded-[10px] border border-[#a6751c] bg-[#efb446] px-5 font-heading text-lg font-extrabold text-[#21190e] transition-colors hover:bg-[#dda334] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#704c17]"
                  : undefined}
              />
            )}
            <p className={`px-1 text-center text-xs leading-5 ${isWarmCommercial ? "text-[#625a4f]" : "text-fe-muted-strong"}`}>
              Ürün, şehir ve tam araç planınız teklif referansına eklenir.
            </p>
          </div>
        )}

        {/* Araç kartları üst karar alanına portal olur; açıklayıcı senaryo
            ana teklif aksiyonundan sonra ikincil bilgi olarak kalır. */}
        {showSepet && lorryM2 !== null && truckM2 !== null && (
          <SepetUI
            lorryM2={lorryM2}
            truckM2={truckM2}
            lorryPrice={lorryPrice}
            truckPrice={truckPrice}
            packageRefPrice={packageRefPrice}
            ihtiyac={neededM2Num}
            onChange={handleSepetChange}
            vehicleCardsSlot={vehicleCardsSlot}
            vehicleCardsLayout={isWarmCommercial ? "horizontal" : "vertical"}
            vehicleCardsPresentation={isWarmCommercial ? "commercial" : "default"}
            showScenarioMessage={!isWarmCommercial}
          />
        )}

        {/* Nakliye koşulları karar akışını kesmeden erişilebilir kalır. */}
        {showTierPrice && logistics !== null && activeThickness !== null
          && (lorryM2 !== null || truckM2 !== null) && (
          <details className={`group mt-4 rounded-xl border px-3 py-2.5 ${isWarmCommercial ? "border-[#d8cbb8] bg-[#fffaf2]" : "border-fe-border/50 bg-fe-raised/30"}`}>
            <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold marker:content-none ${isWarmCommercial ? "text-[#282219]" : "text-fe-text"}`}>
              <span>Nakliye ve tam araç koşulları</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className={`border-t pb-1 pt-3 text-xs leading-5 ${isWarmCommercial ? "border-[#d8cbb8] text-[#625a4f]" : "border-fe-border/50 text-fe-muted-strong"}`}>
              <p className={isWarmCommercial ? "text-[#282219]" : "text-fe-text"}>
                {lorryM2 !== null && truckM2 !== null
                  ? `Bu ${activeThickness} cm levhada 1 Kamyon ${formatM2(lorryM2)} m², 1 TIR ${formatM2(truckM2)} m² taşır.`
                  : `Bu kalınlığın araç kapasitesi henüz tanımlı değil.`}
              </p>
              <p className="mt-1">
                Teklifler fabrikadan tam Kamyon veya tam TIR yüklemesiyle hazırlanır. Tam dolu araç siparişinde nakliye fiyata dahildir ve bölge iskontosu uygulanır.
              </p>
            </div>
          </details>
        )}

        {showTierPrice && logistics === null && activeThickness && (
          <div className="mb-3 mt-3 rounded-lg border border-fe-border/50 bg-fe-raised/30 px-3 py-2.5">
            <p className="text-xs leading-5 text-fe-muted">
              Bu kalınlık için lojistik verisi henüz tanımlı değil. Veri tamamlanmadan teklif oluşturulamaz.
            </p>
          </div>
        )}

        {/* Mevcut ürünün teklifi tamamlandıktan sonra alternatif keşfi. */}
        {!isBonusPlate && product.product_type === "plate" && product.material_type === "tasyunu" && zone && product.model && (
          isWarmCommercial ? (
            <details className="group mt-4 rounded-xl border border-[#d8cbb8] bg-[#fffaf2] px-3 py-2.5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-heading text-sm font-bold text-[#282219] marker:content-none">
                <span>Bonus komple sistem alternatifini karşılaştır</span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-[#d8cbb8] pt-3">
                <BonusAlternativeCard
                  sourceModel={product.model}
                  sourceBrandName={product.brand?.name ?? ""}
                  thicknessCm={effectiveThickness ?? prefill?.kalinlik ?? null}
                  cityCode={zone.city_code}
                  cityName={zone.city_name}
                  currentUnitPriceExVat={truckPrice}
                />
              </div>
            </details>
          ) : (
            <div className="mt-4">
              <BonusAlternativeCard
                sourceModel={product.model}
                sourceBrandName={product.brand?.name ?? ""}
                thicknessCm={effectiveThickness ?? prefill?.kalinlik ?? null}
                cityCode={zone.city_code}
                cityName={zone.city_name}
                currentUnitPriceExVat={truckPrice}
              />
            </div>
          )
        )}

        {product.product_type === "plate" &&
          product.material_type === "tasyunu" &&
          modelScope === "sivali_dis_cephe_mantolama" && (
          <Link
            href="/tasyunu-karsilastir?entry=pdp"
            className="mt-4 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-fe-border bg-fe-surface/60 px-3 py-2.5 text-left text-sm font-semibold text-fe-text transition-colors hover:border-brand-500/50 hover:text-brand-300"
          >
            <span>Bu ürünün mantolama alternatiflerini karşılaştır</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        )}
      </div>

      {showSepet && showMobileSticky && !ctaDisabled && quoteM2 > 0 && heroPrice !== null && !inputInvalid && (
        <div
          data-testid="pdp-standard-mobile-quote-sticky"
          className="fixed inset-x-3 bottom-16 z-[60] rounded-2xl border border-fe-border/80 bg-fe-bg/95 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-screen-sm items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-300/80">
                {formatM2(quoteM2)} m²
              </p>
              <p className="truncate text-sm font-black leading-none text-white">
                {heroPrice.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                <span className="ml-0.5 text-xs font-normal text-fe-muted">₺/m²</span>
              </p>
              {quoteTotalKdvHaric !== null && (
                <p className="mt-1 truncate text-xs font-medium leading-none text-fe-muted-strong">
                  ≈ {formatCurrency(quoteTotalKdvHaric)} ₺ toplam · KDV hariç
                </p>
              )}
            </div>
            <div className="w-[126px] shrink-0">
              <SingleProductQuoteButton
                product={product}
                activeThickness={activeThickness ?? null}
                pricePerM2KdvHaric={quotePricePerM2KdvHaric ?? 0}
                neededM2={quoteM2}
                cityCode={selectedCode}
                cityName={zone?.city_name ?? ""}
                tierLabel={quoteTierLabel}
                isShippingIncluded={quoteShippingIncluded}
                vehicleType={quoteVehicleType}
                label="Teklifimi hazırla"
                resultSessionId={resultSessionId}
                packageSizeM2={packageSizeM2}
                onOpen={() => trackProductDetailPdfOpen('sticky_mobile')}
                buttonClassName="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-brand-500/70 bg-brand-500 px-2 text-xs font-black leading-4 text-fe-bg transition-colors hover:bg-brand-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Sistem Teklifi ─── */}
      {!systemOfferIrrelevant && (rules.requires_system_context || rules.sales_mode !== "single_only") && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-950/20 p-5">
          {/* Doğrulanmamış oran iddiası yasak (Sprint 0.2): "%10-15 daha
              uygun" hiçbir markada kanıtlanmış değildi. Fark iddiası ancak
              gerçek hesap sonucundan dinamik üretilirse geri gelebilir. */}
          <p className="mb-1 text-sm font-semibold leading-snug text-fe-text">
            Komple set fiyatı hesaplayıcıda
          </p>
          <p className="mb-4 text-xs text-fe-muted">
            Levha + toz grubu (yapıştırıcı, sıva, dübel, file…) komple set fiyatını bölgenize göre üç paket seçeneğiyle hesaplayın.
          </p>
          <WizardLinkButton
            prefill={prefill}
            targetStep={decision.wizard_target_step}
            label="Takım Fiyatını Gör →"
            variant="primary"
            className="w-full py-3 text-base"
            icon={<Package className="h-4 w-4" />}
          />
        </div>
      )}

      {rules.requires_system_context && (
        <div className="flex items-start gap-2 rounded-lg border border-fe-border/50 bg-fe-raised/30 px-4 py-3">
          <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fe-muted" />
          <p className="text-xs text-fe-muted">Bu ürün genellikle sistem halinde tercih edilir.</p>
        </div>
      )}
    </div>
  );
}

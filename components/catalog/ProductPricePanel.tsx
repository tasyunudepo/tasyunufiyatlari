"use client";

// TODO (teknik borç): URL parsing `?kalinlik=7.5cm` için parseInt kullanılıyor
// (app/urunler/[kategori]/[slug]/page.tsx:116) → 7.5 cm'lik kalınlıklar 7 olarak parse ediliyor.
// Düzeltme: parseFloat veya '7-5' URL formatına geçirilmesi gerekecek.
// Bu dosya kapsamında değil; ayrı bir PR'da ele alınacak.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronDown, Layers, MessageCircle, Package, Phone } from "lucide-react";
import { notifyWhatsappIntent } from "@/lib/notifyWhatsappIntent";
import { notifyPhoneCall } from "@/lib/notifyPhoneCall";
import {
  notifyProductDetailCtaClick,
  notifyProductDetailFormOpen,
  notifyProductDetailPriceView,
  type ProductDetailCtaLocation,
} from "@/lib/notifyWizardEvent";
import { BUSINESS_INFO } from "@/lib/business/info";
import { buildWhatsAppLink, generateQuoteWhatsAppMessage } from "@/lib/utils/whatsapp";
import { formatBrandProductName } from "@/lib/brandFormat";
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

interface ShippingZone {
  city_code: number;
  city_name: string;
  base_shipping_cost: string | number;
  optimix_levha_discount: string | number;
  discount_kamyon: string | number;
  discount_tir: string | number;
}

interface LogisticsCap {
  thickness: number;
  lorry_capacity_m2: string | number;
  truck_capacity_m2: string | number;
  package_size_m2: string | number;
  lorry_capacity_packages: number;
  truck_capacity_packages: number;
}

interface Props {
  product: CatalogProductView;
  decision: DecisionContext;
  prefill: WizardPrefill | null;
  shippingZones: ShippingZone[];
  logisticsCapacity: LogisticsCap[];
  selectedThickness: number | null;
  hideHeroPriceOnMobile?: boolean;
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
}: Props) {
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
  const [loadedMarginRule, setLoadedMarginRule] = useState<{
    slug: string;
    rule: MarginRuleInput;
  } | null>(null);
  const marginRule = loadedMarginRule?.slug === product.material_type
    ? loadedMarginRule.rule
    : null;

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
  const handleSepetChange = useCallback((state: SepetState) => {
    setSepetState(state);
  }, []);

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

  const buildProductDetailPayload = () => ({
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
  });

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
    <div className="space-y-3 pb-32 lg:pb-0">
      <div className="rounded-xl border border-fe-border bg-fe-raised/40 p-5">

        {/* ─── Fiyat Görünürlük Kontrolleri (decision.ts tek otorite) ─── */}
        {(() => {
          // Bonus levhası: fiyatı BonusRegionPrice kartı (aşağıda) sunucudan
          // bölgeye göre gösterir. Genel plate_prices yok → getPriceDisplay
          // burada "görünmez" der ve yanıltıcı "Teklif ile belirlenir" basardı.
          // Bu statik başlığı Bonus'ta hiç göstermeyip tek fiyat otoritesini
          // BonusRegionPrice'a bırakıyoruz. İstisna: fiyat listesinde
          // olmayan modeller (Desibel, Marin vb.) — onlarda canlı kart
          // yoktur, statik "Teklif ile belirlenir" akışı doğru mesajdır.
          if (isPricedBonusModel) return null;

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
        {showTierPrice && heroPrice !== null && (
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
            <div className="mt-1 space-y-0.5 text-[11px]">
              <p className="font-medium text-brand-300/80">Fabrika çıkışlı bayilik fiyatı</p>
              <p className="text-fe-muted-strong">KDV hariç · KDV dahil tutar PDF teklifinde gösterilir</p>
            </div>
            {activeThickness && (
              <p className="mt-1 text-xs text-fe-muted">{activeThickness} cm</p>
            )}
          </div>
        )}

        {shippingZones.length > 0 && (
          <div className="mb-4 space-y-3 border-b border-fe-border/60 pb-4">
            <div className="grid grid-cols-2 items-start gap-3">
              {/* SOL — şehir + metraj */}
              <div className="space-y-3">
                {/* Sipariş Toplamı — sol karar kolonunda, araç seçimiyle aynı hizada */}
                {showTierPrice && heroPrice !== null && showSepet && (() => {
                  const orderM2 = sepetState.totalM2 > 0 ? sepetState.totalM2 : neededM2Num;
                  if (orderM2 <= 0 || heroPrice === null || inputInvalid) return null;
                  const orderTotal = orderM2 * heroPrice;
                  return (
                    <div className="border-t border-fe-border/60 pt-4" aria-live="polite" aria-atomic="true">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-fe-muted-strong">
                        Sipariş Toplamı
                      </p>
                      <p className="text-2xl font-extrabold leading-none text-white">
                        {orderTotal.toLocaleString("tr-TR", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                        <span className="ml-1 text-brand-300">₺</span>
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-fe-muted-strong">
                        KDV hariç · {orderM2.toLocaleString("tr-TR")} m² ×{" "}
                        {heroPrice.toLocaleString("tr-TR", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                        {" "}₺/m²
                      </p>
                    </div>
                  );
                })()}

                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-fe-muted-strong">
                    Teslimat Şehri
                  </p>
                  <div className="relative">
                    <select
                      value={selectedCode}
                      onChange={(e) => setSelectedCode(Number(e.target.value))}
                      className="w-full appearance-none rounded-lg border border-fe-border bg-fe-surface px-3 py-2 pr-7 text-sm text-fe-text transition-colors hover:bg-fe-raised focus:outline-none focus:border-brand-500/60 [color-scheme:dark]"
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
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-fe-muted" />
                  </div>
                  {zone && (zone.city_code === 34 || [41, 16, 14, 54, 81].includes(zone.city_code)) && (
                    <p className="mt-1 text-[10px] text-fe-muted">
                      📍 Bölgesel avantaj
                    </p>
                  )}
                </div>

                {showSepet && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-fe-muted-strong">
                      İhtiyaç Metrajı
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={neededM2}
                        onChange={(e) => { setNeededM2(e.target.value); setMetrajMode("custom"); }}
                        className={`w-full rounded-lg border bg-fe-bg/80 px-3 py-2 pr-9 text-sm text-fe-text transition-colors focus:outline-none ${
                          inputInvalid
                            ? "border-red-500/60 focus:border-red-500/80"
                            : "border-brand-500/40 focus:border-brand-500/70 focus:shadow-[0_0_0_2px_rgba(212,132,90,0.10)]"
                        }`}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-fe-muted">
                        m²
                      </span>
                    </div>
                    {inputInvalid && (
                      <p className="mt-1 text-[10px] text-red-400">Geçerli m² giriniz</p>
                    )}
                  </div>
                )}
              </div>

              {/* SAĞ — Kamyon + TIR vehicle cards (SepetUI'dan portal ile gelir) */}
              {showSepet && (
                <div ref={setVehicleCardsSlot} className="flex min-w-0 flex-col justify-start" />
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

        {/* ─── Bonus alternatif kartı (Sprint 1.3) — Filli grubu taşyünü
            levhalarında; rakip eşleşmesi teknik profillerden gelir, profili
            olmayan (çatı/endüstriyel) ürünlerde kart kendiliğinden çıkmaz. */}
        {!isBonusPlate && product.product_type === "plate" && product.material_type === "tasyunu" && zone && product.model && (
          <div className="mb-4">
            <BonusAlternativeCard
              sourceModel={product.model}
              sourceBrandName={product.brand?.name ?? ""}
              thicknessCm={effectiveThickness ?? prefill?.kalinlik ?? null}
              cityCode={zone.city_code}
              cityName={zone.city_name}
              currentUnitPriceExVat={truckPrice}
            />
          </div>
        )}

        {/* ─── Karşılaştırma merkezi çapraz linki (Sprint 2) ─── */}
        {product.product_type === "plate" && product.material_type === "tasyunu" && (
          <p className="mb-4 text-center text-xs">
            <a
              href="/tasyunu-karsilastir"
              className="text-fe-muted underline-offset-2 transition-colors hover:text-brand-300 hover:underline"
            >
              Tüm taşyünü levhalarını aynı koşulda karşılaştır →
            </a>
          </p>
        )}

        {/* ─── SepetUI ─── */}
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
          />
        )}

        {/* Nakliye verisi yok uyarısı */}
        {showTierPrice && logistics === null && activeThickness && (
          <div className="mb-3 mt-3 rounded-lg border border-fe-border/50 bg-fe-raised/30 px-3 py-2.5">
            <p className="text-xs text-fe-muted">
              Bu kalınlık için nakliye verisi henüz girilmemiştir. Teklif formu veya WhatsApp
              üzerinden fiyat alabilirsiniz.
            </p>
          </div>
        )}

        {/* Lojistik minimum — yalnız fabrika tam araç kuralı. */}
        {showTierPrice && logistics !== null && activeThickness !== null
          && (lorryM2 !== null || truckM2 !== null) && (
          <div className="mt-3 rounded-lg border border-fe-border/50 bg-fe-raised/40 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fe-muted-strong">
              Lojistik Minimum · {activeThickness} cm
            </p>
            <p className="mt-1 text-xs text-fe-text">
              {lorryM2 !== null && truckM2 !== null
                ? `Fabrika alımında minimum 1 Kamyon = ${formatM2(lorryM2)} m² veya 1 TIR = ${formatM2(truckM2)} m².`
                : `Fabrika alımında nakliye verisi henüz tanımlı değil.`}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-fe-muted-strong">
              Teklifler fabrikadan tam Kamyon veya tam TIR yüklemesiyle hazırlanır. Tam dolu
              araç siparişinde nakliye fiyata dahildir ve bölge iskontosu uygulanır.
            </p>
          </div>
        )}

        {/* ─── CTA ─── */}
        {showSepet && (
          <div className="mt-4 space-y-3">
            {quoteM2 > 0 && heroPrice !== null && !inputInvalid && (
              <div className="hidden rounded-xl border border-brand-600/30 bg-brand-950/20 px-3 py-3 lg:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300/80">
                  Teklif Özeti
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-fe-muted">Sevkiyat planı</p>
                    <p className="mt-0.5 font-semibold text-white">{quoteVehicleSummary}</p>
                  </div>
                  <div>
                    <p className="text-fe-muted">Toplam metraj</p>
                    <p className="mt-0.5 font-semibold text-white">{formatM2(quoteM2)} m²</p>
                  </div>
                  {quotePackageCount !== null && (
                    <div>
                      <p className="text-fe-muted">Paket adedi</p>
                      <p className="mt-0.5 font-semibold text-white">
                        {quotePackageCount} paket
                        {packageSizeM2 && (
                          <span className="ml-1 text-fe-muted">× {formatM2(packageSizeM2)} m²</span>
                        )}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-fe-muted">Birim fiyat</p>
                    <p className="mt-0.5 font-semibold text-white">{heroPrice.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺/m²</p>
                  </div>
                  {quoteTotalKdvHaric !== null && (
                    <div>
                      <p className="text-fe-muted">Toplam tutar</p>
                      <p className="mt-0.5 font-semibold text-white">{formatCurrency(quoteTotalKdvHaric)} ₺</p>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-fe-muted-strong">
                  Birim fiyat ve toplam tutar KDV hariçtir.
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-fe-muted-strong">
                  Sipariş, seçilen tam Kamyon/TIR planına göre fabrikadan çıkar. Bölge iskontosu
                  uygulanır ve nakliye fiyata dahildir.
                </p>
              </div>
            )}
            {ctaDisabled ? (
              <button
                type="button"
                disabled
                className="w-full rounded-xl bg-fe-raised/60 px-4 py-3.5 text-sm font-semibold text-fe-muted border border-fe-border/50 cursor-not-allowed"
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
                label="PDF teklifimi hazırla"
                resultSessionId={resultSessionId}
                packageSizeM2={packageSizeM2}
                onOpen={() => trackProductDetailPdfOpen('product_detail_summary')}
              />
            )}
            <div className="hidden grid-cols-2 gap-2 lg:grid">
              <a
                href={buildWhatsAppLink(generateQuoteWhatsAppMessage({
                  productName: formatBrandProductName(product.brand.name, product.name),
                  thicknessCm: activeThickness,
                  metrajM2: quoteM2,
                  vehicleLabel: (sepetState.kamyon > 0 || sepetState.tir > 0)
                    ? quoteVehicleSummary
                    : `${formatM2(quoteM2)} m²`,
                  cityName: zone?.city_name ?? '',
                  pricePerM2: quotePricePerM2KdvHaric ?? 0,
                  totalKdvHaric: quoteTotalKdvHaric ?? 0,
                  shippingMessage: quoteShippingIncluded ? 'fiyata dahil' : 'satış görüşmesinde netleşir',
                }))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackProductDetailCta('whatsapp');
                  notifyWhatsappIntent({
                    source: 'product_detail_summary',
                    productName: product.name,
                    resultSessionId,
                    ctaLocation: 'product_detail_summary',
                  });
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-green-600/50 bg-green-600/12 px-3 py-2.5 text-center text-xs font-bold text-green-300 transition-colors hover:border-green-500 hover:bg-green-600/18 hover:text-green-200"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp&apos;tan teyit iste
              </a>
              <a
                href={`tel:${BUSINESS_INFO.phone.tel}`}
                onClick={() => {
                  trackProductDetailCta('phone');
                  notifyPhoneCall({
                    source: 'product_detail_phone',
                    productName: product.name,
                    resultSessionId,
                    ctaLocation: 'product_detail_summary',
                  });
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-fe-border bg-fe-raised px-3 py-2.5 text-center text-xs font-bold text-fe-text transition-colors hover:border-brand-500/50 hover:text-brand-200"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Telefonla konuş
              </a>
            </div>
            <p className="hidden px-1 text-center text-[11px] leading-relaxed text-fe-muted-strong lg:block">
              PDF teklif ürün, şehir ve metraj bilginizle hazırlanır. Teyit için WhatsApp veya telefonla görüşebilirsiniz.
            </p>
          </div>
        )}

        {/* "Neden tam araç?" eğitsel metni yukarıdaki özet kartı dipnotuyla birleştirildi */}
      </div>

      {showSepet && !ctaDisabled && quoteM2 > 0 && heroPrice !== null && !inputInvalid && (
        <div className="fixed inset-x-3 bottom-16 z-[60] rounded-2xl border border-fe-border/80 bg-fe-bg/95 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-screen-sm items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300/80">
                {formatM2(quoteM2)} m²
              </p>
              <p className="truncate text-sm font-black leading-none text-white">
                {heroPrice.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                <span className="ml-0.5 text-[10px] font-normal text-fe-muted">₺/m²</span>
              </p>
              {quoteTotalKdvHaric !== null && (
                <p className="mt-0.5 truncate text-[11px] font-medium leading-none text-fe-muted-strong">
                  ≈ {formatCurrency(quoteTotalKdvHaric)} ₺ toplam · KDV hariç
                </p>
              )}
            </div>
            <div className="w-[104px] shrink-0">
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
                label="PDF"
                resultSessionId={resultSessionId}
                packageSizeM2={packageSizeM2}
                onOpen={() => trackProductDetailPdfOpen('sticky_mobile')}
                buttonClassName="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-brand-500/70 bg-brand-500 px-3 text-[13px] font-black text-fe-bg transition-colors hover:bg-brand-400"
              />
            </div>
            <a
              href={buildWhatsAppLink(generateQuoteWhatsAppMessage({
                productName: formatBrandProductName(product.brand.name, product.name),
                thicknessCm: activeThickness,
                metrajM2: quoteM2,
                vehicleLabel: (sepetState.kamyon > 0 || sepetState.tir > 0)
                  ? quoteVehicleSummary
                  : `${formatM2(quoteM2)} m²`,
                cityName: zone?.city_name ?? '',
                pricePerM2: quotePricePerM2KdvHaric ?? 0,
                totalKdvHaric: quoteTotalKdvHaric ?? 0,
                shippingMessage: quoteShippingIncluded ? 'fiyata dahil' : 'satış görüşmesinde netleşir',
              }))}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp'tan teyit iste"
              onClick={() => {
                trackProductDetailCta('whatsapp', 'sticky_mobile');
                notifyWhatsappIntent({
                  source: 'product_detail_cta',
                  productName: product.name,
                  resultSessionId,
                  ctaLocation: 'sticky_mobile',
                });
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-green-600/50 bg-green-600/15 text-green-300"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              href={`tel:${BUSINESS_INFO.phone.tel}`}
              aria-label="Telefonla konuş"
              onClick={() => {
                trackProductDetailCta('phone', 'sticky_mobile');
                notifyPhoneCall({
                  source: 'product_detail_phone',
                  productName: product.name,
                  resultSessionId,
                  ctaLocation: 'sticky_mobile',
                });
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-fe-border bg-fe-raised text-fe-text"
            >
              <Phone className="h-5 w-5" aria-hidden="true" />
            </a>
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

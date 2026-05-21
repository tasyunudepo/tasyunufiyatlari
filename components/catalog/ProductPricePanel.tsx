"use client";

// TODO (teknik borç): URL parsing `?kalinlik=7.5cm` için parseInt kullanılıyor
// (app/urunler/[kategori]/[slug]/page.tsx:116) → 7.5 cm'lik kalınlıklar 7 olarak parse ediliyor.
// Düzeltme: parseFloat veya '7-5' URL formatına geçirilmesi gerekecek.
// Bu dosya kapsamında değil; ayrı bir PR'da ele alınacak.

import { useCallback, useEffect, useState } from "react";
import { WHATSAPP_ORDER } from "@/lib/config";
import { ChevronDown, Layers, Package } from "lucide-react";
import { notifyWhatsappIntent } from "@/lib/notifyWhatsappIntent";

import type { CatalogProductView, DecisionContext, WizardPrefill } from "@/lib/catalog/types";
import { getPriceDisplay } from "@/lib/catalog/decision";
import SepetUI, { type SepetState } from "./SepetUI";
import SingleProductQuoteButton from "./SingleProductQuoteButton";
import StokAlternatifSection from "./StokAlternatifSection";
import WizardLinkButton from "./WizardLinkButton";
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

const PROFIT_MARGIN = 0.1;
const roundM2 = (value: number): number => Math.round(value * 10) / 10;
const formatM2Input = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(roundM2(value));

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
    stokOnerisi: false,
    scenario: 'empty',
  });

  // Boş deps: setSepetState React useState'ten gelir → stabil.
  // Boş dep olmadan her render yeni fonksiyon → SepetUI'ın onChange effect'i döngüye girer.
  const handleSepetChange = useCallback((state: SepetState) => {
    setSepetState(state);
  }, []);

  const zone = shippingZones.find((z) => z.city_code === selectedCode) ?? defaultCity;
  const { rules, base_price, minimum_order, thickness_prices } = product;

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

  // Gösterilen birim fiyat = hesaplanan toplam / m²: ₺342,34 × 806 = ₺275.946.
  // calcPrice çıktısı kuruşa yuvarlanır; tüm türev fiyatlar tutarlı.
  function calcPrice(isk1Pct: number): number | null {
    if (pricePerM2Base === null) return null;
    const raw = pricePerM2Base * (1 - isk1Pct / 100) * (1 - isk2) * (1 + PROFIT_MARGIN);
    return Math.round(raw * 100) / 100;
  }

  const packageRefPrice = calcPrice(0);
  const lorryPrice = lorryM2 ? calcPrice(discKamyon) : null;
  const truckPrice = truckM2 ? calcPrice(discTir) : null;

  const depotDiscountPct = product.depot_discount ?? 0;
  const depotStock = activeThicknessPrice?.stock_tuzla ?? 0;
  const depotPrice = depotStock > 0 ? calcPrice(depotDiscountPct) : null;

  // Stoksuz kalınlıklarda metraj inputunu 1 kamyon kapasitesiyle prefill et.
  // Kalınlık değişince lorryM2 değişir → effect yeniden tetiklenir (doğal sıfırlama).
  // depotStock > 0 ise depo yolu aktif; prefill gereksiz.
  useEffect(() => {
    if (lorryM2 !== null && depotStock === 0) {
      const val = formatM2Input(lorryM2);
      const syncPrefill = window.setTimeout(() => {
        setNeededM2(val);
        setDebouncedM2(val);
        setMetrajMode("lorry");
      }, 0);
      return () => window.clearTimeout(syncPrefill);
    }
  }, [lorryM2, depotStock]);

  const neededM2Num = (() => {
    const raw = debouncedM2 ? parseFloat(debouncedM2.replace(",", ".")) : 0;
    return isNaN(raw) || raw < 0 ? 0 : raw;
  })();

  // Geçerlilik kontrolü direkt neededM2 üzerinden (anlık kırmızı border için)
  const inputInvalid = neededM2 !== "" && (() => {
    const raw = parseFloat(neededM2.replace(",", "."));
    return isNaN(raw) || raw < 0;
  })();

  const minOrderM2 =
    minimum_order.has_minimum && rules.minimum_order_type === "m2"
      ? (rules.minimum_order_value ?? null)
      : null;

  // CTA label — senaryoya ve araç sayısına göre dinamik
  const ctaLabel = (() => {
    switch (sepetState.scenario) {
      case 'below_minimum': return `Teklif için en az ${minOrderM2 ?? ""} m² giriniz`;
      case 'depot_optimal': return "PDF Teklif Al";
      case 'lorry_optimal': return `${sepetState.kamyon} Kamyon için PDF Teklif Al`;
      case 'tir_optimal':   return `${sepetState.tir} TIR için PDF Teklif Al`;
      case 'large_project': return "Büyük Metraj için PDF Teklif Al";
      default:              return "PDF Teklif Al";
    }
  })();
  const isTyping = neededM2 !== debouncedM2;
  const ctaDisabled = !isTyping && sepetState.scenario === 'below_minimum' && sepetState.totalM2 === 0;

  // Hero fiyat mantığı:
  // 1. Sepet dolu → blended effective (kamyon × lorryPrice + TIR × truckPrice / toplam m²)
  // 2. Stok önerisi aktif → depotPrice (depo tek seçenek, TIR fiyatı yanıltıcı olur)
  // 3. Boş sepet, metraj yok → TIR çıpa (SEO için en avantajlı fiyat)
  const heroPrice =
    sepetState.totalM2 > 0
      ? sepetState.effectivePrice
      : sepetState.stokOnerisi && depotPrice !== null
        ? depotPrice
        : truckPrice ?? lorryPrice;

  // Context'e yaz → MobileProductHero senaryo-aware fiyatı okur (sepet doluyken
  // effectivePrice, boşken TIR çıpa). Mobil hero ile TOPLAM hesabı tek kaynaklı.
  useEffect(() => {
    interactive?.setHeroPrice(heroPrice);
  }, [heroPrice, interactive]);

  const showTierPrice =
    rules.pricing_visibility_mode === "from_price" ||
    rules.pricing_visibility_mode === "exact_price";

  const showSepet =
    showTierPrice &&
    logistics !== null &&
    lorryM2 !== null &&
    truckM2 !== null &&
    (lorryPrice !== null || truckPrice !== null);

  // Quote parametreleri sepet state'inden türetilir.
  // SingleProductQuoteButton vehicleType: 'lorry' | 'truck' | 'depot' | null kabul eder.
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

  // Depo uygunsa depot kartı ana kartın üstüne çıkar
  const depotBlock = depotStock > 0 && depotPrice !== null ? (
    <StokAlternatifSection
      depotStock={depotStock}
      depotPrice={depotPrice}
      depotMinM2={product.depot_min_m2 ?? 300}
      ihtiyac={neededM2Num}
      packageRefPrice={packageRefPrice}
    />
  ) : null;

  return (
    <div className="space-y-3">
      {/* Depo optimal → depot kartı en üstte */}
      {sepetState.scenario === 'depot_optimal' && depotBlock}

      <div className="rounded-xl border border-fe-border bg-fe-raised/40 p-5">

        {/* ─── Fiyat Görünürlük Kontrolleri (decision.ts tek otorite) ─── */}
        {(() => {
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
          const dynamicPrice = truckPrice ?? lorryPrice ?? accessoryTirPrice;

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
              ₺
              {heroPrice.toLocaleString("tr-TR", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
              <span className="ml-1 text-sm font-normal text-fe-muted">/ m²</span>
            </p>
            <p className="mt-1 text-[11px] text-fe-muted-strong">KDV hariç</p>
            {activeThickness && (
              <p className="mt-1 text-xs text-fe-muted">{activeThickness} cm</p>
            )}
          </div>
        )}

        {/* ─── Teslimat Şehri + Metraj (sol) · Kamyon/TIR (sağ) ─── */}
        {shippingZones.length > 0 && (
          <div className="mb-4 space-y-3 border-b border-fe-border/60 pb-4">
            <div className="grid grid-cols-2 items-stretch gap-3">
              {/* SOL — şehir + metraj */}
              <div className="space-y-3">
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
                      {zone.city_code === 34 ? "📍 Depoya en yakın" : "📍 Bölgesel avantaj"}
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
                        placeholder="örn. 1200"
                        className={`w-full rounded-lg border bg-fe-bg/80 px-3 py-2 pr-9 text-sm text-fe-text transition-colors placeholder:text-fe-muted focus:outline-none ${
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

                    {/* SİPARİŞ TOPLAMI — sepet doluyken gerçek araç toplamı (PDF ile aynı),
                        sepet boşken kullanıcının girdiği metraj × hero fiyatı */}
                    {(() => {
                      const orderM2 = sepetState.totalM2 > 0 ? sepetState.totalM2 : neededM2Num;
                      if (orderM2 <= 0 || heroPrice === null || inputInvalid) return null;
                      const orderTotal = orderM2 * heroPrice;
                      return (
                        <div className="mt-2 rounded-xl border border-brand-500/30 bg-brand-500/[0.07] px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-300/80">
                            Sipariş Toplamı
                          </p>
                          <p className="mt-1 text-[18px] font-extrabold leading-none">
                            <span className="text-brand-300">₺</span>
                            <span className="text-white">
                              {orderTotal.toLocaleString("tr-TR", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </p>
                          <p className="mt-1 text-[9px] leading-snug text-fe-muted">
                            KDV hariç · {orderM2.toLocaleString("tr-TR")} m² × ₺
                            {heroPrice.toLocaleString("tr-TR", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}
                            /m²
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* SAĞ — Kamyon + TIR vehicle cards (SepetUI'dan portal ile gelir) */}
              {showSepet && (
                <div ref={setVehicleCardsSlot} className="flex min-w-0 flex-col justify-end" />
              )}
            </div>
          </div>
        )}

        {/* ─── SepetUI ─── */}
        {showSepet && lorryM2 !== null && truckM2 !== null && (
          <SepetUI
            lorryM2={lorryM2}
            truckM2={truckM2}
            lorryPrice={lorryPrice}
            truckPrice={truckPrice}
            packageRefPrice={packageRefPrice}
            depotStock={depotStock}
            depotPrice={depotPrice}
            depotMinM2={product.depot_min_m2 ?? 300}
            minOrderM2={minOrderM2 ?? 0}
            ihtiyac={neededM2Num}
            onChange={handleSepetChange}
            onSetIhtiyac={(m2) => {
              const val = formatM2Input(m2);
              setNeededM2(val);
              setDebouncedM2(val);
              setMetrajMode(m2 === lorryM2 ? "lorry" : m2 === truckM2 ? "truck" : "custom");
            }}
            hideMinWarning={isTyping}
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

        {/* Minimum Sipariş — stok olan kalınlıklarda geçerli (depo bazlı); stok yoksa
            fabrika minimumu lorry/TIR olarak KararKutusu'nda gösterilir */}
        {minimum_order.has_minimum && minimum_order.label
          && sepetState.scenario !== 'below_minimum'
          && depotStock > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-fe-muted">Minimum sipariş</span>
            <span className="text-xs font-medium text-brand-400">{minimum_order.label}</span>
          </div>
        )}

        {/* ─── CTA ─── */}
        {showSepet && (
          <div className="mt-4 space-y-2">
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
                pricePerM2KdvHaric={heroPrice ?? 0}
                neededM2={quoteM2}
                cityCode={selectedCode}
                cityName={zone?.city_name ?? ""}
                tierLabel={quoteTierLabel}
                isShippingIncluded={true}
                vehicleType={quoteVehicleType}
                label={ctaLabel}
              />
            )}
            <p className="px-1 text-center text-[10px] leading-relaxed text-fe-muted">
              Fiyat, şehir ve metraj bilginizle kişisel teklif oluşturulur, PDF olarak sunulur
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_ORDER}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => notifyWhatsappIntent({
                source: 'product_detail_cta',
                productName: product.name,
              })}
              className={`block py-1 text-center text-xs transition-colors ${
                sepetState.scenario === 'depot_optimal'
                  ? "font-semibold text-green-400 hover:text-green-300"
                  : "text-fe-muted hover:text-fe-muted"
              }`}
            >
              {sepetState.scenario === 'depot_optimal'
                ? "WhatsApp ile Hızlı Sipariş →"
                : "Sormak istediğiniz mi var? → WhatsApp"}
            </a>
          </div>
        )}

        {/* Eğitsel Kutu — CTA altında, en altta */}
        {showSepet && (
          <div className="mt-4 rounded-lg border border-brand-700/25 bg-brand-950/20 px-3 py-3">
            <p className="mb-1 text-xs font-semibold text-brand-200">Neden tam araç avantajlı?</p>
            <p className="text-[11px] leading-relaxed text-brand-200/70">
              Fabrika çıkışlı alımlarda tam araç yüklemesi gerekir. Ara metraj ihtiyaçlarında sistem
              önce depo stoklarını kontrol eder.
            </p>
          </div>
        )}
      </div>

      {/* Depo optimal değilse normal pozisyonda göster */}
      {sepetState.scenario !== 'depot_optimal' && depotBlock}

      {/* ─── Sistem Teklifi ─── */}
      {(rules.requires_system_context || rules.sales_mode !== "single_only") && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-950/20 p-5">
          <p className="mb-1 text-sm font-semibold leading-snug text-fe-text">
            Sistem halinde %10-15 daha uygun
          </p>
          <p className="mb-4 text-xs text-fe-muted">
            Dübel · Sıva · File eklenince metrekare maliyeti düşer. Takım fiyatını hesapla.
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

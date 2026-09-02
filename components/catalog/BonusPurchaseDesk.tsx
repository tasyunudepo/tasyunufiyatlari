"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CatalogProductView } from "@/lib/catalog/types";
import { getBonusFamily } from "@/lib/pricing/bonus/families";
import { useProductInteractive } from "./ProductInteractiveContext";
import BonusRegionPrice from "./BonusRegionPrice";

export interface BonusPurchaseShippingZone {
  city_code: number;
  city_name: string;
  base_shipping_cost: string | number;
  optimix_levha_discount: string | number;
  discount_kamyon: string | number;
  discount_tir: string | number;
}

interface BonusPurchaseDeskProps {
  product: CatalogProductView;
  shippingZones: BonusPurchaseShippingZone[];
}

export default function BonusPurchaseDesk({
  product,
  shippingZones,
}: BonusPurchaseDeskProps) {
  const interactive = useProductInteractive();
  const [bonusVariantModel, setBonusVariantModel] = useState<string | null>(null);
  const resultSessionId = interactive.resultSessionId;

  const defaultZone = shippingZones.find((zone) => zone.city_code === 34) ?? shippingZones[0];
  const zone =
    shippingZones.find((item) => item.city_code === interactive.cityCode) ?? defaultZone;
  const thicknessOptions = product.thickness_options ?? [];
  const activeThickness =
    interactive.activeThickness != null && thicknessOptions.includes(interactive.activeThickness)
      ? interactive.activeThickness
      : thicknessOptions[0] ?? null;
  const bonusFamily = product.model ? getBonusFamily(product.model) : null;
  const effectiveBonusModel = bonusVariantModel ?? product.model;

  if (!zone || !effectiveBonusModel) return null;

  return (
    <section
      id="siparis-masasi"
      aria-labelledby="siparis-masasi-baslik"
      data-testid="pdp-order-panel"
      className="min-w-0 bg-[#1c1d1a] px-4 py-5 text-[#f7f1e7] sm:px-6 sm:py-6 xl:px-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d9b968]">
            Sipariş Masası
          </p>
          <h2
            id="siparis-masasi-baslik"
            className="mt-2 font-heading text-2xl font-bold leading-tight tracking-[-0.025em] text-white"
          >
            {zone.city_name} için satın alma özeti
          </h2>
          <p className="mt-1 max-w-[48ch] text-xs leading-5 text-[#b8b1a6]">
            Bölge ve kalınlığı seçin; geçerli araç planını motor hesaplasın.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-md border border-[#d2aa55]/30 bg-[#d2aa55]/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#e2c57e] sm:inline-flex">
          Canlı fiyat
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold text-[#bdb5a8]">
            Teslim ili
          </span>
          <span className="relative block">
            <select
              aria-label="Teslim ili"
              value={zone.city_code}
              onChange={(event) => interactive.setCityCode(Number(event.target.value))}
              className="min-h-12 w-full appearance-none rounded-[10px] border border-white/15 bg-[#111310] px-3 pr-9 text-sm font-medium text-[#f5eee4] outline-none transition-colors hover:border-[#d2aa55]/45 focus:border-[#d2aa55] focus:ring-2 focus:ring-[#d2aa55]/20 [color-scheme:dark]"
            >
              {shippingZones.map((item) => (
                <option key={item.city_code} value={item.city_code}>
                  {item.city_name}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a9a195]"
            />
          </span>
        </label>

        {thicknessOptions.length > 0 && (
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-[#bdb5a8]">
              Kalınlık
            </span>
            <span className="relative block">
              <select
                aria-label="Kalınlık"
                value={activeThickness ?? ""}
                onChange={(event) => interactive.setActiveThickness(Number(event.target.value))}
                className="min-h-12 w-full appearance-none rounded-[10px] border border-white/15 bg-[#111310] px-3 pr-9 text-sm font-medium text-[#f5eee4] outline-none transition-colors hover:border-[#d2aa55]/45 focus:border-[#d2aa55] focus:ring-2 focus:ring-[#d2aa55]/20 [color-scheme:dark]"
              >
                {thicknessOptions.map((thickness) => (
                  <option key={thickness} value={thickness}>
                    {thickness} cm
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a9a195]"
              />
            </span>
          </label>
        )}
      </div>

      {bonusFamily && bonusFamily.variants.length > 1 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold text-[#bdb5a8]">
            {bonusFamily.selectorTitle}
          </p>
          <div className="flex flex-wrap gap-2">
            {bonusFamily.variants.map((variant) => {
              const active = variant.modelShortName === effectiveBonusModel;
              return (
                <button
                  key={variant.modelShortName}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBonusVariantModel(variant.modelShortName)}
                  className={`min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2aa55] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1d1a] ${
                    active
                      ? "border-[#d2aa55] bg-[#d2aa55]/12 text-[#f0d38d]"
                      : "border-white/15 bg-white/[0.025] text-[#c5bdb1] hover:border-[#d2aa55]/45"
                  }`}
                >
                  {variant.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <BonusRegionPrice
        key={effectiveBonusModel}
        modelShortName={effectiveBonusModel}
        thicknessCm={activeThickness}
        cityCode={zone.city_code}
        cityName={zone.city_name}
        product={product}
        activeThicknessCm={activeThickness}
        resultSessionId={resultSessionId}
        variant="purchase-desk"
      />
    </section>
  );
}

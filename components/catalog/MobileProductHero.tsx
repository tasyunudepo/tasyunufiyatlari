"use client";

// MobileProductHero
// Mobil sol kolonun "M² FİYATI + delta + paket kartları" özet kartı.
// Önceden page.tsx'te server-side hesaplanıyordu → şehir değişince
// tepki vermiyordu. Artık ProductInteractiveContext üzerinden
// cityCode + activeThickness'e abone, anında reaktif.

import type { CatalogProductView } from "@/lib/catalog/types";
import {
  computeM2Price,
  getPackageM2,
  type PricingLogistics,
  type PricingZone,
} from "@/lib/catalog/pricing";
import { useProductInteractive } from "./ProductInteractiveContext";

interface ShippingZone extends PricingZone {
  city_name: string;
}

interface Props {
  product: CatalogProductView;
  shippingZones: ShippingZone[];
  logisticsCapacity: PricingLogistics[];
}

export default function MobileProductHero({
  product,
  shippingZones,
  logisticsCapacity,
}: Props) {
  const { cityCode, activeThickness, heroPrice: ctxHeroPrice } = useProductInteractive();

  if (product.rules.pricing_visibility_mode === "hidden") return null;

  const zone = shippingZones.find((z) => z.city_code === cityCode) ?? shippingZones[0] ?? null;
  // ProductPricePanel context'e senaryo-aware heroPrice yazar; o gelene kadar
  // (ilk render veya panel henüz mount olmadıysa) liste/TIR fiyatına düş.
  // Levha marjı ProductPricePanel tarafından canlı okunup context'e yazılır.
  // İlk render'da sessiz %10 varsayımı göstermek yerine fail-closed kalır.
  const fallback = computeM2Price({
    product,
    thickness: activeThickness,
    zone,
    logisticsCapacity,
    marginPct: null,
  });
  const heroPrice = ctxHeroPrice ?? fallback;
  if (heroPrice === null) return null;

  const packageM2 = getPackageM2(product, activeThickness, logisticsCapacity);

  return (
    <div className="mt-2 rounded-2xl border border-fe-border/70 bg-fe-raised/30 px-3 py-2.5">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-fe-muted-strong">
          M² Fiyatı
        </p>
        <p className="mt-1 text-[1.6rem] font-extrabold leading-none">
          <span className="text-white">
            {heroPrice.toLocaleString("tr-TR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="ml-1 text-xs font-normal text-fe-muted">₺/m²</span>
        </p>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-fe-muted-strong">
        KDV hariç{activeThickness ? ` · ${activeThickness} cm` : ""}
      </p>

      {(activeThickness != null || packageM2 != null) && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-fe-border/60 bg-fe-bg/40 px-2 py-1.5">
            <p className="text-[8px] font-medium uppercase tracking-[0.16em] text-fe-muted-strong whitespace-nowrap">
              Seçili Kalınlık
            </p>
            <p className="mt-0.5 text-[14px] font-semibold leading-none text-white">
              {activeThickness ?? "—"}
              {activeThickness != null && (
                <span className="ml-0.5 text-[10px] font-normal text-fe-muted">cm</span>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-fe-border/60 bg-fe-bg/40 px-2 py-1.5">
            <p className="text-[8px] font-medium uppercase tracking-[0.16em] text-fe-muted-strong whitespace-nowrap">
              Paket Metrajı
            </p>
            <p className="mt-0.5 text-[14px] font-semibold leading-none text-white">
              {packageM2 != null
                ? packageM2.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "—"}
              {packageM2 != null && (
                <span className="ml-0.5 text-[10px] font-normal text-fe-muted">m²</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

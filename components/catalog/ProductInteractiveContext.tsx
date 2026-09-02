"use client";

// ProductDetailInteractive Context
// Tüm interactive ürün detayı state'inin tek otoritesi:
//   - selectedCityCode  → şehir seçimi (ProductPricePanel + MobileProductHero okur)
//   - activeThickness   → kalınlık seçimi (ThicknessSelector yazar; herkes okur)
// Mobil özet kart, picker ve fiyat paneli bu state'e abone → şehir/kalınlık her
// değiştiğinde tüm bağımlı bloklar anında reaktif.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  buildProductPathWithThickness,
} from "@/lib/catalog/thickness-url";
import {
  bucketElapsedMs,
  bucketScrollPercent,
  serializeSeenSections,
  type PdpJourneySnapshot,
  type PdpMeasuredSection,
} from "@/lib/analytics/pdpJourney";

interface ContextValue {
  cityCode: number;
  setCityCode: (code: number) => void;
  activeThickness: number | null;
  setActiveThickness: (thickness: number | null) => void;
  /** Senaryo-aware m² fiyatı (sepet dolu → effectivePrice; boş → liste).
   *  ProductPricePanel yazar, MobileProductHero ve diğer tüketiciler okur. */
  heroPrice: number | null;
  setHeroPrice: (price: number | null) => void;
  orderPlan: ProductOrderPlan | null;
  setOrderPlan: (plan: ProductOrderPlan | null) => void;
  resultSessionId: string;
  markSectionSeen: (section: PdpMeasuredSection) => void;
  getMeasurementSnapshot: () => PdpJourneySnapshot;
}

export interface ProductOrderPlan {
  lorryCount: number;
  truckCount: number;
  totalM2: number;
}

const ProductInteractiveContext = createContext<ContextValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  initialCityCode: number;
  initialThickness: number | null;
}

export function ProductInteractiveProvider({
  children,
  initialCityCode,
  initialThickness,
}: ProviderProps) {
  const pathname = usePathname();

  const [cityCode, setCityCodeState] = useState(initialCityCode);
  const [activeThickness, setActiveThicknessState] = useState<number | null>(initialThickness);
  const [heroPrice, setHeroPriceState] = useState<number | null>(null);
  const [orderPlan, setOrderPlanState] = useState<ProductOrderPlan | null>(null);
  const [resultSessionId] = useState(
    () => `pdp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  );
  const [journeyStartedAt] = useState(() => Date.now());
  const maxScrollPercentRef = useRef(0);
  const seenSectionsRef = useRef<Set<PdpMeasuredSection>>(new Set());
  const setHeroPrice = useCallback((price: number | null) => {
    setHeroPriceState(price);
  }, []);
  const setOrderPlan = useCallback((plan: ProductOrderPlan | null) => {
    setOrderPlanState(plan);
  }, []);
  const markSectionSeen = useCallback((section: PdpMeasuredSection) => {
    seenSectionsRef.current.add(section);
  }, []);
  const getMeasurementSnapshot = useCallback((): PdpJourneySnapshot => ({
    seen_sections: serializeSeenSections(seenSectionsRef.current),
    elapsed_ms_bucket: bucketElapsedMs(Date.now() - journeyStartedAt),
    max_scroll_bucket: bucketScrollPercent(maxScrollPercentRef.current),
  }), [journeyStartedAt]);

  useEffect(() => {
    let frame = 0;
    const updateScrollDepth = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const documentHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        );
        const available = Math.max(1, documentHeight - window.innerHeight);
        const percent = Math.min(100, Math.max(0, (window.scrollY / available) * 100));
        maxScrollPercentRef.current = Math.max(maxScrollPercentRef.current, percent);
      });
    };
    updateScrollDepth();
    window.addEventListener('scroll', updateScrollDepth, { passive: true });
    window.addEventListener('resize', updateScrollDepth);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateScrollDepth);
      window.removeEventListener('resize', updateScrollDepth);
    };
  }, []);

  const setActiveThickness = useCallback(
    (thickness: number | null) => {
      setActiveThicknessState(thickness);
      // URL'i de güncelle; sayfa yeniden render edilmez, fiyat paneli context'ten güncellenir.
      if (thickness != null && typeof window !== "undefined") {
        const nextPath = buildProductPathWithThickness(window.location.pathname || pathname, thickness);
        const params = new URLSearchParams(window.location.search);
        params.delete("kalinlik");
        const queryString = params.toString();
        window.history.replaceState(
          window.history.state,
          "",
          `${nextPath}${queryString ? `?${queryString}` : ""}`
        );
      }
    },
    [pathname]
  );

  const setCityCode = useCallback((code: number) => {
    setCityCodeState(code);
  }, []);

  return (
    <ProductInteractiveContext.Provider
      value={{
        cityCode,
        setCityCode,
        activeThickness,
        setActiveThickness,
        heroPrice,
        setHeroPrice,
        orderPlan,
        setOrderPlan,
        resultSessionId,
        markSectionSeen,
        getMeasurementSnapshot,
      }}
    >
      {children}
    </ProductInteractiveContext.Provider>
  );
}

export function useProductInteractive(): ContextValue {
  const ctx = useContext(ProductInteractiveContext);
  if (!ctx) {
    throw new Error("useProductInteractive must be used inside <ProductInteractiveProvider>");
  }
  return ctx;
}

/** Provider yoksa null döner — opsiyonel kullanım için. */
export function useProductInteractiveOptional(): ContextValue | null {
  return useContext(ProductInteractiveContext);
}

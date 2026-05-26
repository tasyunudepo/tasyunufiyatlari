"use client";

// ProductDetailInteractive Context
// Tüm interactive ürün detayı state'inin tek otoritesi:
//   - selectedCityCode  → şehir seçimi (ProductPricePanel + MobileProductHero okur)
//   - activeThickness   → kalınlık seçimi (ThicknessSelector yazar; herkes okur)
// Mobil özet kart, picker ve fiyat paneli bu state'e abone → şehir/kalınlık her
// değiştiğinde tüm bağımlı bloklar anında reaktif.

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import {
  buildProductPathWithThickness,
} from "@/lib/catalog/thickness-url";

interface ContextValue {
  cityCode: number;
  setCityCode: (code: number) => void;
  activeThickness: number | null;
  setActiveThickness: (thickness: number | null) => void;
  /** Senaryo-aware m² fiyatı (sepet dolu → effectivePrice; boş → liste).
   *  ProductPricePanel yazar, MobileProductHero ve diğer tüketiciler okur. */
  heroPrice: number | null;
  setHeroPrice: (price: number | null) => void;
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
  const setHeroPrice = useCallback((price: number | null) => {
    setHeroPriceState(price);
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
      value={{ cityCode, setCityCode, activeThickness, setActiveThickness, heroPrice, setHeroPrice }}
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

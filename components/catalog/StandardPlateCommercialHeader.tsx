"use client";

import Image from "next/image";
import type { BrandMarkPresentation } from "@/lib/brandLogo";
import { useProductInteractiveOptional } from "./ProductInteractiveContext";

interface Props {
  title: string;
  categoryName: string;
  brandMark: BrandMarkPresentation;
  isFilliGroup: boolean;
  cityOptions: Array<{ code: number; name: string }>;
  fallbackThickness: number | null;
}

export default function StandardPlateCommercialHeader({
  title,
  categoryName,
  brandMark,
  isFilliGroup,
  cityOptions,
  fallbackThickness,
}: Props) {
  const interactive = useProductInteractiveOptional();
  const cityCode = interactive?.cityCode ?? cityOptions[0]?.code ?? 34;
  const cityName = cityOptions.find((city) => city.code === cityCode)?.name ?? cityOptions[0]?.name ?? "Teslimat bölgesi";
  const thickness = interactive?.activeThickness ?? fallbackThickness;
  const heroPrice = interactive?.heroPrice ?? null;

  function scrollToPlanner() {
    document.getElementById("pdp-commercial-planner")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <header data-testid="pdp-commercial-header" className="overflow-hidden rounded-[16px] border border-[#ddcfba] bg-[#fffdf8] shadow-[0_18px_44px_rgba(58,43,22,0.1)] xl:col-span-2">
      <div className="grid lg:grid-cols-[1.18fr_0.82fr]">
        <div className="px-5 py-5 sm:px-8 sm:py-7 lg:px-10 lg:py-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div data-testid="pdp-standard-plate-brand" className="flex min-w-0 items-center gap-3">
              {brandMark.logo ? (
                <Image
                  src={brandMark.logo.src}
                  alt={brandMark.accessibleName}
                  width={brandMark.logo.width}
                  height={brandMark.logo.height}
                  className="h-10 w-auto max-w-[142px] object-contain object-left"
                />
              ) : (
                <strong className="font-heading text-xl text-[#211c15]">{brandMark.displayName}</strong>
              )}
              <span className="border-l border-[#ddcfba] pl-3 font-heading text-sm font-extrabold uppercase tracking-[0.08em] text-[#2d261d]">
                {brandMark.displayName}
              </span>
            </div>

            {isFilliGroup && (
              <div data-testid="pdp-filli-group-mark" className="flex items-center gap-2 border-l border-[#ddcfba] pl-4">
                <Image
                  src="/images/markalogolar/filli-boya-mantolama.webp"
                  alt="Filli Boya"
                  width={126}
                  height={34}
                  className="h-7 w-auto object-contain"
                />
                <span className="max-w-[112px] text-xs font-semibold leading-4 text-[#625a4f]">
                  Filli Boya ürün grubudur
                </span>
              </div>
            )}
          </div>

          <h1
            id="standard-plate-title"
            className="mt-7 max-w-[18ch] text-balance font-heading text-[2.25rem] font-extrabold leading-[0.98] tracking-[-0.035em] text-[#201c17] sm:text-[3.2rem] lg:text-[3.65rem]"
          >
            {title}
          </h1>
          <p className="mt-3 text-base font-medium text-[#625a4f] sm:text-lg">{categoryName}</p>
        </div>

        <div className="flex flex-col justify-center border-t border-[#ddcfba] bg-[#f2e1c3] px-5 py-6 sm:px-8 lg:border-l lg:border-t-0 lg:px-10 lg:py-8">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#66543a]">
            {cityName}{thickness ? ` · ${thickness.toLocaleString("tr-TR")} cm` : ""}
          </p>
          <div className="mt-3 min-h-[64px]" aria-live="polite" aria-atomic="true">
            {heroPrice !== null ? (
              <p data-testid="pdp-commercial-unit-price" className="font-heading text-[3.1rem] font-extrabold leading-none tracking-[-0.035em] text-[#201c17] sm:text-[4rem]">
                {heroPrice.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                <span className="ml-2 text-xl font-semibold tracking-normal text-[#625a4f]">₺/m²</span>
              </p>
            ) : (
              <p className="font-heading text-2xl font-bold text-[#625a4f]">Fiyat hesaplanıyor…</p>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-[#625a4f]">
            KDV hariç · Fabrika çıkışlı bayilik fiyatı
          </p>
          <button
            type="button"
            onClick={scrollToPlanner}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] border border-[#9b6b20] bg-[#fff8ea] px-5 font-heading text-base font-bold text-[#704c17] transition-colors hover:bg-[#f8e6c4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#704c17] sm:w-fit"
          >
            Teslimat fiyatını hesapla ↓
          </button>
        </div>
      </div>
    </header>
  );
}

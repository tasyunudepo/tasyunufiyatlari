"use client";

import { ChevronDown, PackageOpen, Ruler, Truck } from "lucide-react";
import type { CatalogProductView } from "@/lib/catalog/types";
import {
  buildPlatePackageDetails,
  resolvePlatePackageDetail,
  type ProductLogisticsCapacity,
} from "@/lib/catalog/package-details";
import { useProductInteractiveOptional } from "./ProductInteractiveContext";

interface Props {
  product: CatalogProductView;
  logisticsCapacity: ProductLogisticsCapacity[];
  fallbackThickness: number | null;
}

const integerFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function planLabel(lorryCount: number, truckCount: number): string {
  if (lorryCount > 0 && truckCount > 0) return `${truckCount} TIR + ${lorryCount} Kamyon`;
  if (truckCount > 0) return `${truckCount} TIR`;
  if (lorryCount > 0) return `${lorryCount} Kamyon`;
  return "Araç planı";
}

export default function PlatePackageDetails({
  product,
  logisticsCapacity,
  fallbackThickness,
}: Props) {
  const interactive = useProductInteractiveOptional();
  const activeThickness = interactive?.activeThickness ?? fallbackThickness;
  const activeDetail = resolvePlatePackageDetail(product, logisticsCapacity, activeThickness);
  const allDetails = buildPlatePackageDetails(product, logisticsCapacity);
  const orderPlan = interactive?.orderPlan ?? null;

  if (!activeDetail) return null;

  const packageCount = orderPlan
    ? orderPlan.lorryCount * activeDetail.lorryPackages + orderPlan.truckCount * activeDetail.truckPackages
    : 0;
  const boardCount = activeDetail.itemsPerPackage ? packageCount * activeDetail.itemsPerPackage : null;

  return (
    <section
      data-testid="pdp-package-details"
      aria-labelledby="pdp-package-details-title"
      className="overflow-hidden rounded-[16px] border border-[#ddcfba] bg-[#fffdf8] shadow-[0_16px_36px_rgba(39,31,17,0.09)]"
    >
      <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:px-8">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#765621]">Paket ve levha bilgisi</p>
          <h2 id="pdp-package-details-title" className="mt-2 font-heading text-2xl font-extrabold tracking-[-0.02em] text-[#282219] sm:text-3xl">
            {activeDetail.thicknessCm.toLocaleString("tr-TR")} cm paket bilgisi
          </h2>
          <p className="mt-2 max-w-[48ch] text-sm leading-6 text-[#625a4f]">
            Kalınlık değiştiğinde paket içeriği ve araçtaki toplam paket adedi otomatik güncellenir.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-live="polite" aria-atomic="true">
          {activeDetail.boardSizeLabel && (
            <div className="min-h-[112px] rounded-[12px] border border-[#ded2c0] bg-white p-4">
              <Ruler className="h-5 w-5 text-[#8a5f1d]" aria-hidden="true" />
              <dt className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#625a4f]">Levha ölçüsü</dt>
              <dd className="mt-1 font-heading text-xl font-extrabold text-[#282219]">{activeDetail.boardSizeLabel}</dd>
            </div>
          )}
          {activeDetail.itemsPerPackage && (
            <div className="min-h-[112px] rounded-[12px] border border-[#ded2c0] bg-white p-4">
              <PackageOpen className="h-5 w-5 text-[#8a5f1d]" aria-hidden="true" />
              <dt className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#625a4f]">Paket içeriği</dt>
              <dd className="mt-1 font-heading text-xl font-extrabold text-[#282219]">{activeDetail.itemsPerPackage} levha</dd>
            </div>
          )}
          <div className="min-h-[112px] rounded-[12px] border border-[#ded2c0] bg-white p-4">
            <PackageOpen className="h-5 w-5 text-[#8a5f1d]" aria-hidden="true" />
            <dt className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#625a4f]">Paket alanı</dt>
            <dd className="mt-1 font-heading text-xl font-extrabold text-[#282219]">{decimalFormat.format(activeDetail.packageM2)} m²</dd>
          </div>
          <div className="min-h-[112px] rounded-[12px] border border-[#b88a3d] bg-[#f7ead3] p-4">
            <Truck className="h-5 w-5 text-[#76501a]" aria-hidden="true" />
            <dt className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#62533b]">
              {orderPlan ? planLabel(orderPlan.lorryCount, orderPlan.truckCount) : "Seçili araç planı"}
            </dt>
            {packageCount > 0 ? (
              <dd className="mt-1 font-heading text-lg font-extrabold leading-6 text-[#282219]">
                {integerFormat.format(packageCount)} paket
                {boardCount !== null && <span className="block text-sm font-bold text-[#62533b]">{integerFormat.format(boardCount)} levha</span>}
              </dd>
            ) : (
              <dd className="mt-1 text-sm font-semibold leading-5 text-[#62533b]">Araç seçiminizle hesaplanır</dd>
            )}
          </div>
        </dl>
      </div>

      {allDetails.length > 1 && (
        <details data-testid="pdp-package-table" className="group border-t border-[#ded2c0] bg-[#fffaf2]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-heading text-sm font-bold text-[#704c17] marker:content-none sm:px-7 lg:px-8">
            <span>Tüm kalınlıkların paket bilgisini göster</span>
            <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="overflow-x-auto border-t border-[#ded2c0]">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="bg-[#f5ead8] text-[#625a4f]">
                <tr>
                  <th className="px-5 py-3 font-semibold sm:px-7 lg:px-8">Kalınlık</th>
                  <th className="px-5 py-3 font-semibold">Levha ölçüsü</th>
                  <th className="px-5 py-3 font-semibold">Paket içi</th>
                  <th className="px-5 py-3 font-semibold">Paket alanı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8ddcc] text-[#282219]">
                {allDetails.map((detail) => (
                  <tr key={detail.thicknessCm} className={detail.thicknessCm === activeDetail.thicknessCm ? "bg-[#fff3d7]" : "bg-white"}>
                    <td className="px-5 py-3 font-bold sm:px-7 lg:px-8">{detail.thicknessCm.toLocaleString("tr-TR")} cm</td>
                    <td className="px-5 py-3">{detail.boardSizeLabel ?? "—"}</td>
                    <td className="px-5 py-3">{detail.itemsPerPackage ? `${detail.itemsPerPackage} levha` : "—"}</td>
                    <td className="px-5 py-3 font-semibold">{decimalFormat.format(detail.packageM2)} m²</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

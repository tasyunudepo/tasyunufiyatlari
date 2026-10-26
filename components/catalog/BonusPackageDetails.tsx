"use client";

import type { CatalogProductView } from "@/lib/catalog/types";
import type { PlatePackageDetail } from "@/lib/catalog/package-details";
import { resolvePackageSpec } from "@/lib/catalog/packageSpec";
import PlatePackageDetails from "./PlatePackageDetails";
import { useProductInteractive } from "./ProductInteractiveContext";

/** Sunucudan gelen fiyatsız paket satırı (lib/pricing/bonus/packageTable.ts ile aynı biçim). */
export interface BonusPackageTableRow {
  thicknessCm: number;
  packagePieces: number;
  packageM2: number;
  lorryPackages: number;
  lorryM2: number;
  truckPackages: number;
  truckM2: number;
}

interface Props {
  product: CatalogProductView;
  /** Model kısa adı → kalınlık satırları; aile ürün sayfasında her yoğunluk varyantı ayrı. */
  packageTable: Record<string, BonusPackageTableRow[]>;
}

// Bonus ürün sayfasında kalınlığa göre paket bilgisi (Emrah, 26 Ekim 2026).
// Gold Plus 50/70/90 gibi varyantlarda paket içeriği farklıdır (90'da 10 cm
// paketi 3 levha), tablo satın alma masasındaki yoğunluk seçimini izler.
export default function BonusPackageDetails({ product, packageTable }: Props) {
  const interactive = useProductInteractive();
  const model = interactive.bonusVariantModel ?? product.model ?? "";
  const rows = packageTable[model] ?? [];
  if (rows.length === 0) return null;

  const pieceLabel = model.startsWith("Endüstriyel Şilte") ? "rulo" : "levha";
  const details: PlatePackageDetail[] = rows.map((row) => ({
    thicknessCm: row.thicknessCm,
    packageM2: row.packageM2,
    itemsPerPackage: row.packagePieces,
    boardSizeLabel:
      resolvePackageSpec({
        brandName: "Bonus",
        materialSlug: "tasyunu",
        modelShortName: model,
        packageM2: row.packageM2,
        packagePieces: row.packagePieces,
      })?.sizeLabel ?? null,
    lorryPackages: row.lorryPackages,
    truckPackages: row.truckPackages,
    isPopular: false,
    pieceLabel,
  }));

  const fallbackThickness = details.some((d) => d.thicknessCm === interactive.activeThickness)
    ? interactive.activeThickness
    : details[0].thicknessCm;

  return <PlatePackageDetails product={product} logisticsCapacity={[]} fallbackThickness={fallbackThickness} details={details} />;
}

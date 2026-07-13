// ============================================================
// Catalog Pricing — Saf hesap fonksiyonları
// Hem server (page.tsx initial render) hem client (interactive)
// taraflarda aynı sonucu üretir. Tüm zone-aware m² fiyat akışı
// burada tek noktada tutulur.
// ============================================================

import type { CatalogProductView } from './types';
import { applyMargin } from '@/lib/pricing/margin';

export interface PricingZone {
  city_code: number;
  discount_tir: string | number;
}

export interface PricingLogistics {
  thickness: number;
  package_size_m2: string | number;
}

export interface PricingArgs {
  product: CatalogProductView;
  thickness: number | null;
  zone: PricingZone | null;
  logisticsCapacity: PricingLogistics[];
  /** material_types kuralından açıkça çözülmüş marj; levhada zorunludur. */
  marginPct: number | null;
}

/** Aktif kalınlık için zone-aware m² fiyatı (KDV hariç). */
export function computeM2Price({
  product,
  thickness,
  zone,
  logisticsCapacity,
  marginPct,
}: PricingArgs): number | null {
  if (!zone) return null;

  // Plates → thickness_prices üzerinden
  if (thickness != null && product.thickness_prices) {
    if (marginPct == null || !Number.isFinite(marginPct) || marginPct < 0 || marginPct > 100) {
      return null;
    }
    const tp = product.thickness_prices.find((p) => p.thickness === thickness);
    if (!tp) return null;
    const log = logisticsCapacity.find((l) => l.thickness === thickness * 10);
    if (!log) return null;
    const pkg = Number(tp.package_m2 ?? log.package_size_m2);
    if (!pkg || pkg <= 0) return null;
    const isk2 = (tp.discount_2 ?? 8) / 100;
    const raw = tp.base_price ?? product.base_price;
    if (raw == null) return null;
    const kdvHaric = tp.is_kdv_included ? raw / 1.2 : raw;
    const perM2Base = kdvHaric / pkg;
    const discTir = parseFloat(String(zone.discount_tir));
    if (!Number.isFinite(discTir)) return null;
    const discountedNet = perM2Base * (1 - discTir / 100) * (1 - isk2);
    return applyMargin(discountedNet, marginPct);
  }

  // Accessory / fallback → base_price + zone discount_tir
  if (product.base_price != null) {
    const discTir = parseFloat(String(zone.discount_tir));
    return Math.round(product.base_price * (1 - discTir / 100) * 100) / 100;
  }
  return null;
}

export interface DeltaResult {
  nextThickness: number | null;
  deltaPerM2: number | null;
}

/** Bir üst kalınlığa m² fiyat farkı. */
export function computeDelta({
  product,
  activeThickness,
  zone,
  logisticsCapacity,
  marginPct,
}: {
  product: CatalogProductView;
  activeThickness: number | null;
  zone: PricingZone | null;
  logisticsCapacity: PricingLogistics[];
  marginPct: number | null;
}): DeltaResult {
  if (activeThickness == null) return { nextThickness: null, deltaPerM2: null };
  const sorted = Array.isArray(product.thickness_options)
    ? [...product.thickness_options].sort((a, b) => a - b)
    : [];
  const idx = sorted.indexOf(activeThickness);
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  if (next === null) return { nextThickness: null, deltaPerM2: null };

  const cur = computeM2Price({ product, thickness: activeThickness, zone, logisticsCapacity, marginPct });
  const nxt = computeM2Price({ product, thickness: next, zone, logisticsCapacity, marginPct });
  if (cur === null || nxt === null) return { nextThickness: next, deltaPerM2: null };
  return { nextThickness: next, deltaPerM2: Math.round((nxt - cur) * 100) / 100 };
}

/** Aktif kalınlığın paket m² miktarı (logistics + thickness_prices.package_m2 öncelikli). */
export function getPackageM2(
  product: CatalogProductView,
  thickness: number | null,
  logisticsCapacity: PricingLogistics[]
): number | null {
  if (thickness == null) return null;
  const tp = product.thickness_prices?.find((p) => p.thickness === thickness);
  const log = logisticsCapacity.find((l) => l.thickness === thickness * 10);
  if (!log) return null;
  const pkg = Number(tp?.package_m2 ?? log.package_size_m2);
  return Number.isFinite(pkg) && pkg > 0 ? pkg : null;
}

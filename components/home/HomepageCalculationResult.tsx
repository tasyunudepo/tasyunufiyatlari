'use client';

import { CaretDown, CheckCircle, DownloadSimple, WhatsappLogo } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';

import { buildQuoteSurfacePricing } from '@/lib/pricing/quoteTotals';
import type { CalculatedPackage, CalculatedPackageItem } from '@/lib/types';

type MaterialType = 'tasyunu' | 'eps';

interface HomepageCalculationResultProps {
  packages: CalculatedPackage[];
  materialType: MaterialType;
  requestedAreaM2: number;
  cityName: string;
  subRegionName?: string | null;
  onWhatsApp: (pkg: CalculatedPackage) => void;
  onPdf: (pkg: CalculatedPackage) => void;
}

const tierRank = (pkg: CalculatedPackage): number => {
  const tier = pkg.definition.tier.toLocaleLowerCase('tr-TR');
  if (tier === 'eco' || tier === 'economic') return 0;
  if (tier === 'performance' || tier === 'balanced') return 1;
  if (tier === 'premium') return 2;
  return 3;
};

const isRecommended = (pkg: CalculatedPackage): boolean => {
  const name = pkg.definition.name.toLocaleLowerCase('tr-TR');
  const tier = pkg.definition.tier.toLocaleLowerCase('tr-TR');
  return name.includes('dengeli') || tier === 'performance' || tier === 'balanced';
};

const selectRecommended = (packages: CalculatedPackage[]): CalculatedPackage | null =>
  packages.find(isRecommended) ?? packages[1] ?? packages[0] ?? null;

const formatCurrency = (value: number): string =>
  value.toLocaleString('tr-TR', { maximumFractionDigits: 0 });

const formatM2 = (value: number): string =>
  value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatQuantity = (item: CalculatedPackageItem): string =>
  `${item.quantity.toLocaleString('tr-TR', {
    minimumFractionDigits: Number.isInteger(item.quantity) ? 0 : 1,
    maximumFractionDigits: 2,
  })} ${item.unit}`;

const itemCategory = (item: CalculatedPackageItem, index: number): string =>
  item.categoryLabel || (item.isPlate ? 'Levha' : item.shortName || `${index + 1}. kalem`);

const tierShortName = (pkg: CalculatedPackage): string =>
  pkg.definition.name.replace(/\s+Sistem$/u, '');

export default function HomepageCalculationResult({
  packages,
  materialType,
  requestedAreaM2,
  cityName,
  subRegionName,
  onWhatsApp,
  onPdf,
}: HomepageCalculationResultProps) {
  const recommended = useMemo(() => selectRecommended(packages), [packages]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(recommended?.definition.id ?? null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const selectedPackage = packages.find(pkg => pkg.definition.id === selectedPackageId)
    ?? recommended;
  if (!selectedPackage) return null;

  const orderAreaM2 = selectedPackage.logistics?.packageCount && selectedPackage.logistics.packageSizeM2
    ? selectedPackage.logistics.packageCount * selectedPackage.logistics.packageSizeM2
    : requestedAreaM2;
  const pricing = buildQuoteSurfacePricing(
    selectedPackage.totalProductCost || 0,
    selectedPackage.shippingCost || 0,
    orderAreaM2 || 1,
  );
  const plate = selectedPackage.items.find(item => item.isPlate);
  const itemCount = selectedPackage.items.length;
  const orderedPackages = [...packages].sort((a, b) => tierRank(a) - tierRank(b));
  const includedItems = selectedPackage.items.map(itemCategory).join(' · ');
  const shippingStatus = selectedPackage.logistics?.shippingMode === 'included_in_sale_price'
    ? 'Nakliye fiyata dahil'
    : selectedPackage.logistics?.shippingMode === 'buyer_pays'
      ? 'Nakliye alıcıya ait'
      : 'Nakliye satış görüşmesinde netleşir';
  const shippingReason = selectedPackage.logistics?.shippingQualification === 'eps_complete_set'
    ? 'Levha + toz grubu set koşulu sağlandı'
    : selectedPackage.logistics?.shippingQualification === 'full_vehicle'
      ? 'Tam araç sipariş koşulu sağlandı'
      : selectedPackage.logistics?.shippingWarning;
  const deliveryLabel = [cityName, subRegionName].filter(Boolean).join(' / ');

  return (
    <section
      className="mt-4 scroll-mt-24 overflow-hidden rounded-2xl bg-[#1d1c18] text-white shadow-[0_22px_60px_rgba(25,23,18,0.16)]"
      data-testid="homepage-calculation-result"
      aria-live="polite"
    >
      <div className="border-b border-white/10 px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#d7bb76]">Sistem</p>
        <div className="mt-2">
          <div className="min-w-0">
            <h2 className="font-heading text-2xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-3xl">
              {itemCount} Kalem Komple Mantolama Seti
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/68 sm:text-base">
              {plate?.name || selectedPackage.plateBrandName} · {selectedPackage.definition.name} · {formatM2(requestedAreaM2)} m²
            </p>
            {materialType === 'eps' && (
              <p className="mt-2 text-sm font-semibold text-[#e7cf91]">EPS Levha + Toz Grubu + Aksesuarlar</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5" data-testid="homepage-tier-selector">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-xs font-semibold text-white/72">Sistem alternatifleri</p>
          <p className="hidden text-[11px] text-white/45 sm:block">Seçiminiz reçete ve toplamı anında günceller</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {orderedPackages.map(pkg => {
            const pkgAreaM2 = pkg.logistics?.packageCount && pkg.logistics.packageSizeM2
              ? pkg.logistics.packageCount * pkg.logistics.packageSizeM2
              : requestedAreaM2;
            const pkgPricing = buildQuoteSurfacePricing(
              pkg.totalProductCost || 0,
              pkg.shippingCost || 0,
              pkgAreaM2 || 1,
            );
            const selected = pkg.definition.id === selectedPackage.definition.id;
            return (
              <button
                key={pkg.definition.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setSelectedPackageId(pkg.definition.id);
                  setDetailsOpen(false);
                }}
                className={`min-w-0 rounded-xl px-2.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0b736] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1c18] sm:px-4 sm:py-4 ${
                  selected
                    ? 'bg-[#f2dfaa] text-[#211b0e] shadow-[0_8px_22px_rgba(0,0,0,0.2)]'
                    : 'bg-white/[0.055] text-white hover:bg-white/[0.09]'
                }`}
              >
                <span className="block truncate text-[11px] font-bold uppercase tracking-[0.08em] sm:text-xs">
                  {tierShortName(pkg)}
                </span>
                <span className={`mt-1.5 block truncate text-sm font-bold tabular-nums sm:text-base ${selected ? 'text-[#211b0e]' : 'text-white'}`}>
                  {formatCurrency(pkgPricing.totalPrice)} ₺
                </span>
                {isRecommended(pkg) && (
                  <span className={`mt-1 block text-[10px] font-bold uppercase tracking-wide ${selected ? 'text-[#6b531a]' : 'text-[#e7c76f]'}`}>
                    Önerilen
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr_1fr_1.18fr]">
        <div className="grid grid-cols-2 border-b border-white/10 lg:col-span-3 lg:grid-cols-3 lg:border-b-0 lg:border-r">
          <dl className="border-b border-r border-white/10 p-4 sm:p-5 lg:border-b-0">
            <dt className="text-[11px] uppercase tracking-wide text-white/50">Metraj</dt>
            <dd className="mt-1.5 text-base font-bold tabular-nums">{formatM2(orderAreaM2)} m²</dd>
            {Math.abs(orderAreaM2 - requestedAreaM2) > 0.01 && (
              <dd className="mt-1 text-[11px] text-white/48">Talep: {formatM2(requestedAreaM2)} m²</dd>
            )}
          </dl>
          <dl className="border-b border-white/10 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <dt className="text-[11px] uppercase tracking-wide text-white/50">Sevkiyat</dt>
            <dd className="mt-1.5 text-sm font-bold leading-5">{shippingStatus}</dd>
            {shippingReason && <dd className="mt-1 text-[11px] leading-4 text-emerald-300">{shippingReason}</dd>}
            {deliveryLabel && <dd className="mt-1 text-[11px] text-white/45">{deliveryLabel}</dd>}
          </dl>
          <dl className="col-span-2 grid grid-cols-2 divide-x divide-white/10 p-0 lg:col-span-1 lg:block">
            <div className="p-4 sm:p-5 lg:border-b lg:border-white/10">
              <dt className="text-[11px] uppercase tracking-wide text-white/50">Ara toplam</dt>
              <dd className="mt-1.5 text-base font-bold tabular-nums" data-testid="homepage-result-subtotal">
                {formatCurrency(pricing.priceWithoutVat)} ₺
              </dd>
              <dd className="mt-1 text-[11px] text-white/45">KDV hariç</dd>
            </div>
            <div className="p-4 sm:p-5">
              <dt className="text-[11px] uppercase tracking-wide text-white/50">KDV</dt>
              <dd className="mt-1.5 text-base font-bold tabular-nums" data-testid="homepage-result-vat">
                {formatCurrency(pricing.vatAmount)} ₺
              </dd>
              <dd className="mt-1 text-[11px] text-white/45">%20</dd>
            </div>
          </dl>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-wide text-white/50">Toplam</p>
          <p className="mt-1 font-heading text-3xl font-extrabold tabular-nums text-white" data-testid="homepage-result-total">
            {formatCurrency(pricing.totalPrice)} ₺
          </p>
          <p className="mt-1 text-[11px] text-white/45">KDV dahil</p>
          <button
            type="button"
            onClick={() => onWhatsApp(selectedPackage)}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f9d55] px-4 text-sm font-bold text-white shadow-[0_10px_28px_rgba(31,157,85,0.24)] transition hover:bg-[#18894a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52cf86] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1c18]"
          >
            <WhatsappLogo size={19} weight="fill" aria-hidden="true" />
            WhatsApp&apos;ta Siparişi Başlat
          </button>
          <button
            type="button"
            onClick={() => onPdf(selectedPackage)}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-white/68 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <DownloadSimple size={16} aria-hidden="true" />
            Teklif detayını indir
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3 text-sm font-semibold text-white">
          <CheckCircle className="mt-0.5 shrink-0 text-emerald-400" size={19} weight="fill" aria-hidden="true" />
          <p>Bu fiyata {itemCount} kalem tam sistem dahildir.</p>
        </div>
        <p className="mt-2 pl-8 text-xs leading-5 text-white/52">{includedItems}</p>
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls="homepage-set-details"
          onClick={() => setDetailsOpen(open => !open)}
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#e5cc8d] transition hover:bg-white/[0.06] hover:text-[#f2dda7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5cc8d]"
        >
          {detailsOpen ? 'Set içeriğini ve miktarları gizle' : 'Set içeriğini ve miktarları gör'}
          <CaretDown className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`} size={16} aria-hidden="true" />
        </button>

        {detailsOpen && (
          <div
            id="homepage-set-details"
            data-testid="homepage-set-details"
            className="mt-4 overflow-hidden rounded-xl bg-white/[0.045]"
          >
            <div className="divide-y divide-white/[0.07] sm:hidden" data-testid="homepage-set-details-mobile">
              {selectedPackage.items.map((item, index) => (
                <div key={`${item.name}-mobile-${index}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3">
                  <p className="text-xs font-bold text-[#e5cc8d]">{itemCategory(item, index)}</p>
                  <p className="row-span-2 self-center whitespace-nowrap text-sm font-bold tabular-nums text-white">
                    {formatQuantity(item)}
                  </p>
                  <p className="text-sm leading-5 text-white/82">{item.name}</p>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="bg-white/[0.045] text-[11px] uppercase tracking-wide text-white/48">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Kalem</th>
                    <th className="px-4 py-3 font-semibold">Ürün / marka-model</th>
                    <th className="px-4 py-3 text-right font-semibold">Miktar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {selectedPackage.items.map((item, index) => (
                    <tr key={`${item.name}-${index}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#e5cc8d]">{itemCategory(item, index)}</td>
                      <td className="px-4 py-3 text-white/82">
                        <span className="font-medium text-white">{item.name}</span>
                        {item.brandName && !item.name.toLocaleLowerCase('tr-TR').includes(item.brandName.toLocaleLowerCase('tr-TR')) && (
                          <span className="mt-0.5 block text-xs text-white/48">{item.brandName}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-white">{formatQuantity(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

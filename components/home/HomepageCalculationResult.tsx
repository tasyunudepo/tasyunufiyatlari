'use client';

import { CaretDown, CheckCircle, Circle, DownloadSimple, WhatsappLogo } from '@phosphor-icons/react';
import Image from 'next/image';
import { useId, useMemo, useState } from 'react';

import { resolveBrandMark, type BrandMarkPresentation } from '@/lib/brandLogo';
import { buildQuoteSurfacePricing } from '@/lib/pricing/quoteTotals';
import { getPackageTierDescriptor, getTierGridClass } from '@/lib/pricing/packagePresentation';
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

interface TierBrandMarkProps {
  label: 'Levha' | 'Toz grubu';
  mark: BrandMarkPresentation;
  selected: boolean;
}

function TierBrandMark({ label, mark, selected }: TierBrandMarkProps) {
  const isFaworiFamilyLogo = mark.logo?.src.includes('/fawori-taşyünü-') ?? false;

  return (
    <span className="min-w-0">
      <span className={`block text-[9px] font-bold uppercase tracking-[0.08em] ${selected ? 'text-[#6b531a]' : 'text-white/68'}`}>
        {label}
      </span>
      <span className="mt-1 flex h-10 min-w-0 flex-col items-center justify-center rounded-lg bg-[#fffdf8] px-1.5 py-1 ring-1 ring-black/10">
        {mark.logo ? (
          <Image
            src={mark.logo.src}
            alt=""
            width={mark.logo.width}
            height={mark.logo.height}
            className={`h-5 w-auto max-w-full object-contain ${isFaworiFamilyLogo ? 'scale-[1.4]' : ''}`}
          />
        ) : (
          <span className="text-xs font-extrabold text-[#403724]" aria-hidden="true">
            {mark.displayName.slice(0, 2).toLocaleUpperCase('tr-TR')}
          </span>
        )}
        <span className="block max-w-full truncate text-[9px] font-bold leading-3 text-[#403724] sm:text-[10px]">
          {mark.displayName}
        </span>
      </span>
    </span>
  );
}

function TierBrandPair({ pkg, selected }: { pkg: CalculatedPackage; selected: boolean }) {
  const plateBrandName = pkg.items.find(item => item.isPlate)?.brandName || pkg.plateBrandName;
  const accessoryBrandName = pkg.accessoryBrandName
    || pkg.items.find(item => !item.isPlate)?.brandName;
  const plateMark = resolveBrandMark(plateBrandName);
  const accessoryMark = resolveBrandMark(accessoryBrandName);

  return (
    <span
      className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-1.5"
      role="img"
      aria-label={`${plateMark.accessibleName} levha + ${accessoryMark.accessibleName} toz grubu`}
      data-tier-brand-pair
      data-plate-brand={plateMark.displayName}
      data-accessory-brand={accessoryMark.displayName}
    >
      <TierBrandMark label="Levha" mark={plateMark} selected={selected} />
      <span className={`flex items-center pt-4 text-sm font-bold ${selected ? 'text-[#765b1d]' : 'text-white/54'}`} aria-hidden="true">
        +
      </span>
      <TierBrandMark label="Toz grubu" mark={accessoryMark} selected={selected} />
    </span>
  );
}

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
  const tierGroupLabelId = useId();
  const tierGroupHelpId = useId();
  const tierGroupName = useId();

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

      <div
        className="border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5"
        data-testid="homepage-tier-selector"
        data-tier-count={orderedPackages.length}
      >
        <div className="mb-3">
          <p id={tierGroupLabelId} className="text-sm font-bold text-white">
            Sisteminizi seçin
          </p>
          <p id={tierGroupHelpId} className="mt-1 text-xs leading-5 text-white/58">
            Seçiminiz ürün reçetesini ve toplam fiyatı anında günceller.
          </p>
        </div>
        <div
          className={`grid gap-2 sm:gap-3 ${getTierGridClass(orderedPackages.length)}`}
          data-tier-grid
          role="radiogroup"
          aria-labelledby={tierGroupLabelId}
          aria-describedby={tierGroupHelpId}
        >
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
            const descriptor = getPackageTierDescriptor(pkg, orderedPackages);
            return (
              <label
                key={pkg.definition.id}
                className="group relative block min-w-0 cursor-pointer"
                data-tier-card
                data-tier-card-state={selected ? 'selected' : 'available'}
              >
                <input
                  type="radio"
                  name={tierGroupName}
                  value={pkg.definition.id}
                  checked={selected}
                  onChange={() => {
                    setSelectedPackageId(pkg.definition.id);
                    setDetailsOpen(false);
                  }}
                  className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0"
                />
                <span
                  className={`block h-full min-h-[184px] rounded-xl px-3 py-3.5 text-left transition-[background-color,border-color,box-shadow,color] duration-150 ease-out motion-reduce:transition-none peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[#e0b736] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#1d1c18] sm:px-4 sm:py-4 ${
                    selected
                      ? 'border border-transparent bg-[#f2dfaa] text-[#211b0e] shadow-[0_8px_22px_rgba(0,0,0,0.2)]'
                      : 'border border-white/20 bg-[#2b2a26] text-white group-hover:border-[#d7bb76]/65 group-hover:bg-[#32302a]'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[11px] font-bold uppercase tracking-[0.08em] sm:text-xs">
                        {tierShortName(pkg)}
                      </span>
                      {isRecommended(pkg) && (
                        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide sm:text-[9px] ${selected ? 'border-[#765b1d]/35 text-[#6b531a]' : 'border-[#d7bb76]/45 text-[#e7c76f]'}`}>
                          ÖNERİLEN
                        </span>
                      )}
                    </span>
                    <span className={`flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase tracking-wide sm:text-[10px] ${selected ? 'text-[#5f4815]' : 'text-white/70'}`}>
                      {selected ? (
                        <>
                          <CheckCircle size={15} weight="fill" aria-hidden="true" />
                          SEÇİLİ
                        </>
                      ) : (
                        <>
                          <Circle size={16} weight="regular" aria-hidden="true" />
                          <span className="sr-only">Seçilebilir</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span
                    className={`mt-2 block truncate text-base font-bold tabular-nums sm:text-lg ${selected ? 'text-[#211b0e]' : 'text-white'}`}
                    data-tier-price
                  >
                    {formatCurrency(pkgPricing.totalPrice)} ₺
                  </span>
                  <span className={`mt-0.5 block text-[10px] font-semibold ${selected ? 'text-[#6b531a]' : 'text-white/62'}`}>
                    KDV dahil
                  </span>
                  <TierBrandPair pkg={pkg} selected={selected} />
                  <span className={`mt-2 block text-[11px] leading-4 sm:text-xs ${selected ? 'text-[#4e4227]' : 'text-white/74'}`}>
                    {descriptor}
                  </span>
                </span>
              </label>
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

'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';
import { PdfOfferModal } from '@/components/modal/PdfOfferModal';
import { PdfDeliveryCard } from '@/components/quote/PdfDeliveryCard';
import { generateQuotePDF } from '@/lib/pdfGenerator';
import { uploadPdfToStorage } from '@/lib/uploadPdfToStorage';
import { notifyPdfQuoteRequested } from '@/lib/notifyWizardEvent';
import type { PdfOfferFormData } from '@/lib/schemas/pdfOffer.schema';
import type { CatalogProductView } from '@/lib/catalog/types';
import { formatBrandProductName, formatBrandName } from '@/lib/brandFormat';
import { generateQuoteWhatsAppMessage, buildWhatsAppLink } from '@/lib/utils/whatsapp';
import { buildQuoteSurfacePricing } from '@/lib/pricing/quoteTotals';

interface Props {
  product: CatalogProductView;
  activeThickness: number | null;
  pricePerM2KdvHaric: number;   // KDV hariç hesaplı m² fiyatı
  neededM2: number;              // 0 ise girilen alan yok
  cityCode: number;
  cityName: string;
  tierLabel: string;             // Kamyon / TIR / depo stok
  isShippingIncluded: boolean;
  vehicleType: 'lorry' | 'truck' | null;
  label?: string;                // CTA buton metni
  resultSessionId?: string;      // PDP session zinciri için
  packageSizeM2?: number | null;  // plate_prices boşsa logistics_capacity fallback'i
  // API'ye gidecek model adı override'ı. Bonus'ta /api/quotes kapasite
  // doğrulaması KISA model adı (short_name = "F 150") bekler; product.name
  // uzun ad olduğu için ("Bonus Premium F 150 Taşyünü…") eşleşmez ve
  // "kapasite doğrulanamadı" ile reddedilir. Bonus PDP kısa adı geçer.
  modelNameOverride?: string | null;
  onOpen?: () => void;
  buttonClassName?: string;
}

interface SuccessState {
  refCode: string;
  pdfUrl: string;
  pdfFilename: string;
  whatsappUrl: string;
  emailUrl: string;
}

export default function SingleProductQuoteButton({
  product,
  activeThickness,
  pricePerM2KdvHaric,
  neededM2,
  cityCode,
  cityName,
  tierLabel: _tierLabel,
  isShippingIncluded,
  vehicleType,
  label,
  resultSessionId,
  packageSizeM2: fallbackPackageSizeM2,
  modelNameOverride,
  onOpen,
  buttonClassName,
}: Props) {
  // API kapasite doğrulaması için model adı (Bonus'ta kısa ad şart).
  const apiModelName = modelNameOverride ?? product.name;
  const [showModal, setShowModal]       = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (formData: PdfOfferFormData) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const areaM2        = Math.max(1, neededM2);
      const pricing       = buildQuoteSurfacePricing(
        pricePerM2KdvHaric * areaM2,
        0,
        areaM2,
      );
      const pricePerM2    = pricing.pricePerM2WithoutVat;
      const totalKdvHaric = pricing.priceWithoutVat;
      const vatAmount     = pricing.vatAmount;
      const grandTotal    = pricing.totalPrice;
      const thickness     = String(activeThickness ?? 0);
      const matType: 'tasyunu' | 'eps' = product.material_type === 'eps' ? 'eps' : 'tasyunu';
      const refCode       = `TY${String(Date.now()).slice(-7)}`;

      // Marka+ürün adını duplikasyonsuz, Fawori parent ekleyerek formatla
      const brandProductName = formatBrandProductName(product.brand.name, product.name);
      const plateBrandLabel  = formatBrandName(product.brand.name);

      // Aktif kalınlığa karşılık gelen paket başına m² → paket sayısı
      const activeRow = activeThickness != null
        ? product.thickness_prices?.find(r => r.thickness === activeThickness) ?? null
        : null;
      const activeRowPackageSizeM2 = activeRow?.package_m2 && activeRow.package_m2 > 0
        ? activeRow.package_m2
        : null;
      const effectivePackageSizeM2 =
        activeRowPackageSizeM2 ?? (
          fallbackPackageSizeM2 && fallbackPackageSizeM2 > 0
            ? fallbackPackageSizeM2
            : null
        );
      const computedPackageCount = effectivePackageSizeM2
        ? Math.max(1, Math.ceil(areaM2 / effectivePackageSizeM2))
        : 0;

      // 1. PDF üret (müşteri otomatik indirir)
      const message = generateQuoteWhatsAppMessage({
        productName: brandProductName,
        thicknessCm: activeThickness,
        metrajM2: areaM2,
        vehicleLabel: (() => {
          // PDP'den gelen vehicleType'a göre kısa etiket
          if (vehicleType === 'lorry') return '1 Kamyon dolusu';
          if (vehicleType === 'truck') return '1 TIR dolusu';
          return `${areaM2.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;
        })(),
        cityName,
        pricePerM2,
        totalKdvHaric: totalKdvHaric,
        shippingMessage: isShippingIncluded ? 'fiyata dahil' : 'satış görüşmesinde netleşir',
        refCode,
      });
      const pdfResult = await generateQuotePDF({
        packageName:        brandProductName,
        packageDescription: brandProductName,
        plateBrandName:     plateBrandLabel,
        accessoryBrandName: '-',
        metraj:             areaM2,
        thickness,
        materialType:       matType,
        materialLongName:   matType === 'tasyunu' ? 'Taşyünü' : 'EPS',
        cityName,
        grandTotal,
        pricePerM2,
        totalProductCost:   totalKdvHaric,
        shippingCost:       0,
        priceWithoutVat:    totalKdvHaric,
        vatAmount,
        refCode,
        validityDate:       new Date().toLocaleString('tr-TR'),
        whatsappOrderLink:  buildWhatsAppLink(message),
        customerCompany:    formData.customerCompany || '',
        relatedPerson:      formData.relatedPerson,
        deliveryAddress:    formData.deliveryAddress || '',
        phone:              formData.phone,
        email:              formData.email || '',
        city:               formData.city,
        district:           formData.district,
        systemDescription:  `${brandProductName}${activeThickness ? ` — ${thickness} cm` : ''}`,
        isShippingIncluded,
        shippingMode: isShippingIncluded
          ? 'included_in_sale_price'
          : 'separate_quote_required',
        items: [
          {
            description:     `${brandProductName}${activeThickness ? ` (${thickness} cm)` : ''}`,
            quantity:        areaM2,
            unit:            'm²',
            consumptionRate: 1,
            unitPrice:       pricePerM2,
            totalPrice:      totalKdvHaric,
            isPlate:         true,
            packageCount:    computedPackageCount,
          },
        ],
      });

      // Teklif kaydı önce oluşur. Private storage yüklemesi yalnızca
      // server'ın bu kayda bağlı capability vermesinden sonra yapılır.
      const quoteRes = await fetch('/api/quotes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            customerName:    formData.relatedPerson,
            customerEmail:   formData.email || '',
            customerPhone:   formData.phone,
            customerCompany: formData.customerCompany || '',
            customerAddress: [formData.deliveryAddress, formData.district, formData.city].filter(Boolean).join(' / '),
            submissionType:  'pdf_quote',
            sourceChannel:   'catalog',
            materialType:    matType,
            brandId:         product.brand.id,
            brandName:       product.brand.name,
            modelId:         product.id,
            modelName:       apiModelName,
            thicknessCm:     Math.min(15, Math.max(2, activeThickness ?? 5)),
            areaM2,
            cityCode:        String(cityCode),
            cityName,
            districtCode:    null,
            districtName:    formData.district || null,
            packageName:     brandProductName,
            packageDescription: `${brandProductName}${activeThickness ? ` ${thickness}cm` : ''}`,
            plateBrandName:  plateBrandLabel,
            accessoryBrandName: '-',
            totalPrice:      grandTotal,
            pricePerM2,
            shippingCost:    0,
            discountPercentage: 0,
            priceWithoutVat: totalKdvHaric,
            vatAmount,
            packageCount:    computedPackageCount || 1,
            packageSizeM2:   effectivePackageSizeM2 ?? 1,
            itemsPerPackage: 1,
            vehicleType:     vehicleType ?? null,
            lorryCapacityPackages: null,
            truckCapacityPackages: null,
            lorryFillPercentage:  null,
            truckFillPercentage:  null,
            packageItems:    { product: product.name, thickness: activeThickness, pricePerM2 },
            quoteCode:       refCode,
            kvkkConsent:   formData.kvkkConsent,
          }),
      });
      const quoteResult = await quoteRes.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        quoteId?: string | number;
        pdfUploadCapability?: string;
      } | null;
      if (!quoteRes.ok || !quoteResult?.ok) {
        console.error('Catalog PDF quote save failed:', { status: quoteRes.status });
        throw new Error(quoteResult?.error || 'Teklif kaydı oluşturulamadı.');
      }
      if (!quoteResult.quoteId || !quoteResult.pdfUploadCapability) {
        throw new Error('PDF yükleme yetkisi oluşturulamadı.');
      }

      const uploaded = await uploadPdfToStorage(pdfResult.blob, {
        quoteId: quoteResult.quoteId,
        capability: quoteResult.pdfUploadCapability,
        filename: `${refCode}.pdf`,
      });
      if (!uploaded) {
        console.warn('[catalog-pdf] Private arşiv yüklemesi tamamlanamadı; yerel PDF korunuyor.');
      }

      notifyPdfQuoteRequested({
            material_type:         matType,
            brand_name:            product.brand.name,
            model_name:            product.name,
            thickness_cm:          Math.min(15, Math.max(2, activeThickness ?? 5)),
            city_code:             cityCode,
            city_name:             cityName,
            area_m2:               areaM2,
            total_m2:              areaM2,
            package_count:         computedPackageCount || 1,
            selected_package_name: brandProductName,
            selected_package_total: grandTotal,
            selected_per_m2:       pricePerM2,
            customer_type:         formData.customerCompany ? 'company' : 'individual',
            source_channel:        'catalog',
            result_session_id:     resultSessionId ?? undefined,
      });

      setShowModal(false);
      setSuccessState({
        refCode,
        pdfUrl: pdfResult.blobUrl,
        pdfFilename: pdfResult.filename,
        whatsappUrl: buildWhatsAppLink(message),
        emailUrl: `mailto:${encodeURIComponent(formData.email || '')}?subject=${encodeURIComponent(`Fiyat teklifi ${refCode}`)}&body=${encodeURIComponent(`${message}\n\nPDF teklifini bu ekrandan indirebilirsiniz.`)}`,
      });
    } catch {
      console.error('Katalog PDF teklif akışı tamamlanamadı.');
      setSubmitError(
        'Teklif kaydı oluşturulamadı. Bilgilerinizi kontrol edip tekrar deneyin.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success state ───────────────────────────────────────────
  if (successState) {
    return (
      <PdfDeliveryCard
        {...successState}
        onClose={() => {
          URL.revokeObjectURL(successState.pdfUrl);
          setSuccessState(null);
        }}
      />
    );
  }

  // ── Normal state ────────────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={() => {
          onOpen?.();
          setSubmitError(null);
          setShowModal(true);
        }}
        className={buttonClassName ?? "inline-flex w-full items-center justify-center gap-2 py-3 rounded-xl border-2 border-brand-500/70 bg-fe-raised text-brand-200 font-bold text-sm transition-colors hover:bg-brand-500/10 hover:border-brand-500 hover:text-white active:bg-brand-500/15"}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        {label ?? "PDF Teklif Al"}
      </button>

      {submitError && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2">
          <p className="text-xs text-red-200">{submitError}</p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-2 text-xs font-semibold text-brand-300 underline underline-offset-2"
          >
            Tekrar deneyin
          </button>
        </div>
      )}

      {showModal && createPortal(
        <PdfOfferModal
          isOpen={showModal}
          onClose={() => !isSubmitting && setShowModal(false)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          defaultCity={cityName}
        />,
        document.body
      )}
    </>
  );
}

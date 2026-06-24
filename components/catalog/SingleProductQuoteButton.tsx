'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';
import { PdfOfferModal } from '@/components/modal/PdfOfferModal';
import { generateQuotePDF } from '@/lib/pdfGenerator';
import { uploadPdfToStorage } from '@/lib/uploadPdfToStorage';
import { notifyPdfQuoteRequested } from '@/lib/notifyWizardEvent';
import type { PdfOfferFormData } from '@/lib/schemas/pdfOffer.schema';
import type { CatalogProductView } from '@/lib/catalog/types';
import { WHATSAPP_ORDER } from '@/lib/config';
import { formatBrandProductName, formatBrandName } from '@/lib/brandFormat';

interface Props {
  product: CatalogProductView;
  activeThickness: number | null;
  pricePerM2KdvHaric: number;   // KDV hariç hesaplı m² fiyatı
  neededM2: number;              // 0 ise girilen alan yok
  cityCode: number;
  cityName: string;
  tierLabel: string;             // Kamyon / TIR / depo stok
  isShippingIncluded: boolean;
  vehicleType: 'lorry' | 'truck' | 'depot' | null;
  label?: string;                // CTA buton metni
  resultSessionId?: string;      // PDP session zinciri için
  onOpen?: () => void;
  buttonClassName?: string;
}

interface SuccessState {
  refCode: string;
  pdfUrl: string;
  pdfFilename: string;
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
  onOpen,
  buttonClassName,
}: Props) {
  const [showModal, setShowModal]       = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);

  const handleSubmit = async (formData: PdfOfferFormData) => {
    setIsSubmitting(true);
    try {
      const areaM2        = Math.max(1, neededM2);
      const pricePerM2    = pricePerM2KdvHaric;
      const totalKdvHaric = pricePerM2 * areaM2;
      const vatAmount     = Math.round(totalKdvHaric * 0.20 * 100) / 100;
      const grandTotal    = totalKdvHaric + vatAmount;
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
      const packageSizeM2 = activeRow?.package_m2 && activeRow.package_m2 > 0
        ? activeRow.package_m2
        : null;
      const computedPackageCount = packageSizeM2
        ? Math.max(1, Math.ceil(areaM2 / packageSizeM2))
        : 0;

      // 1. PDF üret (müşteri otomatik indirir)
      const whatsappMsg = encodeURIComponent(
        `Merhaba, ${refCode} no'lu teklif hakkında bilgi almak istiyorum.`
      );
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
        whatsappOrderLink:  `https://wa.me/${WHATSAPP_ORDER}?text=${whatsappMsg}`,
        customerCompany:    formData.customerCompany || '',
        relatedPerson:      formData.relatedPerson,
        deliveryAddress:    formData.deliveryAddress || '',
        phone:              formData.phone,
        email:              formData.email || '',
        city:               formData.city,
        district:           formData.district,
        systemDescription:  `${brandProductName}${activeThickness ? ` — ${thickness} cm` : ''}`,
        isShippingIncluded,
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

      // 2. Storage'a yükle
      let storedPdfUrl: string | null = null;
      let storedPdfPath: string | null = null;
      try {
        const uploaded = await uploadPdfToStorage(pdfResult.blob, `${refCode}.pdf`);
        if (uploaded) { storedPdfUrl = uploaded.publicUrl; storedPdfPath = uploaded.storagePath; }
      } catch { /* storage hatası akışı durdurmasın */ }

      // 3. DB kaydet
      try {
        const quoteRes = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            modelName:       product.name,
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
            packageSizeM2:   packageSizeM2 ?? 1,
            itemsPerPackage: 1,
            vehicleType:     vehicleType === 'depot' ? 'none' : (vehicleType ?? null),
            lorryCapacityPackages: null,
            truckCapacityPackages: null,
            lorryFillPercentage:  null,
            truckFillPercentage:  null,
            packageItems:    { product: product.name, thickness: activeThickness, pricePerM2 },
            quoteCode:       refCode,
            pdfUrl:          storedPdfUrl,
            pdfStoragePath:  storedPdfPath,
          }),
        });

        if (quoteRes.ok) {
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
            ref_code:              refCode,
            customer_type:         formData.customerCompany ? 'company' : 'individual',
            source_channel:        'catalog',
            result_session_id:     resultSessionId ?? undefined,
          });
        }
      } catch { /* DB hatası PDF'i engellemez */ }

      // 4. Yeni sekmede aç
      try { window.open(pdfResult.blobUrl, '_blank'); } catch { /* popup blocker */ }

      setShowModal(false);
      setSuccessState({ refCode, pdfUrl: pdfResult.blobUrl, pdfFilename: pdfResult.filename });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success state ───────────────────────────────────────────
  if (successState) {
    return (
      <div className="rounded-xl border border-green-700/40 bg-green-950/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base leading-none">✅</span>
          <p className="text-sm font-semibold text-green-300">Teklifiniz hazır</p>
        </div>
        <ul className="space-y-1.5 mb-3">
          {[
            'En avantajlı fiyat uygulandı',
            'Talep sisteme kaydedildi',
            'PDF hazırlandı',
          ].map(item => (
            <li key={item} className="flex items-center gap-2 text-xs text-fe-muted">
              <span className="text-green-400 text-[11px] flex-shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>

        <p className="text-[10px] text-fe-muted leading-relaxed mb-3">
          PDF yeni sekmede açıldı. İsterseniz cihazınıza da indirebilirsiniz.
        </p>

        {successState.pdfUrl && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <a
              href={successState.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 text-center text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors"
            >
              Teklifi Görüntüle
            </a>
            <a
              href={successState.pdfUrl}
              download={successState.pdfFilename}
              className="py-2 text-center text-xs font-semibold text-fe-text bg-fe-raised hover:bg-fe-raised/80 rounded-lg transition-colors"
            >
              ↓ PDF İndir
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => setSuccessState(null)}
          className="block w-full text-center text-xs text-fe-muted hover:text-fe-muted transition-colors mt-1"
        >
          Yeni teklif oluştur
        </button>
      </div>
    );
  }

  // ── Normal state ────────────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={() => {
          onOpen?.();
          setShowModal(true);
        }}
        className={buttonClassName ?? "inline-flex w-full items-center justify-center gap-2 py-3 rounded-xl border-2 border-brand-500/70 bg-fe-raised text-brand-200 font-bold text-sm transition-colors hover:bg-brand-500/10 hover:border-brand-500 hover:text-white active:bg-brand-500/15"}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        {label ?? "PDF Teklif Al"}
      </button>

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

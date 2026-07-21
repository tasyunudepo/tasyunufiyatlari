"use client";

import type { ProductRules } from '@/lib/catalog/types';
import { getPriceDisplay } from '@/lib/catalog/decision';

interface PriceDisplayProps {
  rules: ProductRules;
  basePrice: number | null;
  /** "paket" | "m²" | "adet" — listede ek bilgi için */
  unitLabel?: string;
  /**
   * Fiyat görünmez durumundaki genel not yerine bağlama özel metin
   * (ör. liste kartında "Şehrini seç…"). Fiyat KARARI yine decision.ts'te;
   * bu yalnız fiyatsız durumun yardımcı cümlesini özelleştirir.
   */
  emptyNoteOverride?: string;
}

/**
 * Liste kartı + detay panel için ortak fiyat etiketi.
 * Tek karar otoritesi: lib/catalog/decision.ts → getPriceDisplay()
 * Listede ve detayda farklı render gösterirse hata buraya değil
 * decision.ts'ye gider.
 */
export default function PriceDisplay({ rules, basePrice, unitLabel = 'paket', emptyNoteOverride }: PriceDisplayProps) {
  const display = getPriceDisplay(rules, basePrice, unitLabel);

  if (!display.visible) {
    return (
      <span className="text-sm text-fe-muted italic">
        {emptyNoteOverride ?? display.note ?? 'Teklif ile belirlenir'}
      </span>
    );
  }

  // Etiketi parse et: "850 ₺ / paket'ten başlayan" — ana fiyat + suffix
  const isFromPrice = rules.pricing_visibility_mode === 'from_price';

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={isFromPrice ? 'text-brand-400 font-semibold' : 'text-white font-semibold'}>
        {display.label}
      </span>
      <span className="text-[10px] font-normal text-fe-muted-strong">KDV hariç</span>
    </span>
  );
}

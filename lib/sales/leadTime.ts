// Termin süresi (Emrah, 16 Ekim 2026): "Taşyününde termin süresi: 7–21 gün", altında "çoğunlukla 1 haftada
// teslim edilir" notu. Yalnız taşyünü ürünlerinde gösterilir (EPS için süre söylenmedi). Tek kaynak: süre
// değişirse yalnız burası değişir; ürün sayfası, sipariş düğmeleri ve PDF teklif buradan okur.

import { ORDER_PROCESS_TEXT } from '@/lib/pdf/orderProcess';

export const LEAD_TIME_LABEL = 'Termin süresi: 7–21 gün' as const;
export const LEAD_TIME_SHORT = 'Termin 7–21 gün' as const;
export const LEAD_TIME_NOTE = 'Çoğunlukla 1 hafta içinde teslim edilir.' as const;
/** Sürenin neyi kapsadığı (editör bulgusu): ürün sayfasının ana termin bilgisinde bir kez yazılır. */
export const LEAD_TIME_SCOPE = 'Sipariş onayından teslime kadar.' as const;

export function showsLeadTime(materialType: string | null | undefined): boolean {
  return materialType === 'tasyunu';
}

/** Soru-cevap (ana sayfa, kalınlık ve 150 yoğunluk sayfaları; FAQPage verisine de girer). */
export const LEAD_TIME_FAQ = {
  q: 'Taşyünü siparişi kaç günde teslim edilir?',
  a: `${LEAD_TIME_LABEL.replace('Termin süresi: ', 'Termin süresi sipariş onayından teslime ')}dür. ${LEAD_TIME_NOTE} ${ORDER_PROCESS_TEXT.shippingPlan}`,
} as const;

// Google Merchant Center teslim süresini yalnız iş günüyle alır. 7–21 takvim günü ≈ 5–15 iş günü:
// hazırlık 4–13 + taşıma 1–2 iş günü (beslemede min/max_handling_time ve shipping içinde transit süresi).
export const MERCHANT_HANDLING_BUSINESS_DAYS = { min: 4, max: 13 } as const;
export const MERCHANT_TRANSIT_BUSINESS_DAYS = { min: 1, max: 2 } as const;

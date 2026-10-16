// Termin süresi (Emrah, 16 Ekim 2026): "Taşyününde termin süresi: 7–21 gün", altında "çoğunlukla 1 haftada
// teslim edilir" notu. Yalnız taşyünü ürünlerinde gösterilir (EPS için süre söylenmedi). Tek kaynak: süre
// değişirse yalnız burası değişir; ürün sayfası, sipariş düğmeleri ve PDF teklif buradan okur.

export const LEAD_TIME_LABEL = 'Termin süresi: 7–21 gün' as const;
export const LEAD_TIME_SHORT = 'Termin 7–21 gün' as const;
export const LEAD_TIME_NOTE = 'Çoğunlukla 1 hafta içinde teslim edilir.' as const;
/** Sürenin neyi kapsadığı (editör bulgusu): ürün sayfasının ana termin bilgisinde bir kez yazılır. */
export const LEAD_TIME_SCOPE = 'Sipariş onayından teslime kadar.' as const;

export function showsLeadTime(materialType: string | null | undefined): boolean {
  return materialType === 'tasyunu';
}

// Google Merchant Center teslim süresini yalnız iş günüyle alır. 7–21 takvim günü ≈ 5–15 iş günü:
// hazırlık 4–13 + taşıma 1–2 iş günü (beslemede min/max_handling_time ve shipping içinde transit süresi).
export const MERCHANT_HANDLING_BUSINESS_DAYS = { min: 4, max: 13 } as const;
export const MERCHANT_TRANSIT_BUSINESS_DAYS = { min: 1, max: 2 } as const;

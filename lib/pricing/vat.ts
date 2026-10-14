// KDV (%20) — müşteri yüzeyinde "KDV dahil" karşılığı (14 Ekim 2026: Merchant Center Türkiye'de KDV dahil fiyat
// ister ve sayfadaki fiyatla aynı olmasını şart koşar). Teklif toplamları lib/pricing/quoteTotals.ts'te.
export const VAT_RATE = 0.2

export const withVat = (amountExVat: number): number => amountExVat * (1 + VAT_RATE)

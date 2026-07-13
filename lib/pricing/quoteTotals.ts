const VAT_RATE = 0.2

export const roundToKurus = (value: number): number =>
  Math.round(value * 100) / 100

export function buildQuoteTotals(
  productTotalNet: number,
  shippingChargeNet: number,
) {
  const priceWithoutVat = roundToKurus(productTotalNet + shippingChargeNet)
  const vatAmount = roundToKurus(priceWithoutVat * VAT_RATE)
  const totalPrice = roundToKurus(priceWithoutVat + vatAmount)

  return { priceWithoutVat, vatAmount, totalPrice }
}

export function buildQuoteSurfacePricing(
  productTotalNet: number,
  shippingChargeNet: number,
  billableAreaM2: number,
) {
  if (!Number.isFinite(billableAreaM2) || billableAreaM2 <= 0) {
    throw new Error('Teklif metrajı sıfırdan büyük olmalıdır.')
  }

  const totals = buildQuoteTotals(productTotalNet, shippingChargeNet)

  return {
    ...totals,
    pricePerM2WithoutVat: roundToKurus(
      totals.priceWithoutVat / billableAreaM2,
    ),
  }
}

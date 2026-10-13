const VAT_MULTIPLIER = 1.2

interface M2PriceSource {
  /** KDV hariç m² fiyatı; akış doldurmuşsa bu kullanılır. */
  pricePerM2: number
  /** KDV hariç ara toplam. */
  priceWithoutVat: number
  /** KDV dâhil genel toplam. */
  grandTotal: number
}

/**
 * Belgede "KDV hariç" diye basılan m² fiyatı. "KDV dâhil" satırı bu
 * tabanın 1,2 katıdır; bu yüzden yedek hesap da KDV HARİÇ olmalıdır.
 *
 * Eski yedek `grandTotal / metraj` idi: KDV dâhil değeri taban alıp
 * üstüne bir kez daha KDV ekliyordu.
 */
export function resolveNetM2Price(data: M2PriceSource, areaM2: number): number {
  if (data.pricePerM2 > 0) return data.pricePerM2
  if (!(areaM2 > 0)) return 0

  const netTotal = data.priceWithoutVat > 0 ? data.priceWithoutVat : data.grandTotal / VAT_MULTIPLIER
  return netTotal > 0 ? netTotal / areaM2 : 0
}

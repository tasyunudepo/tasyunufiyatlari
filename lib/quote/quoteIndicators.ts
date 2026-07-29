import { applyMargin } from '@/lib/pricing/margin'
import { buildQuoteTotals, roundToKurus } from '@/lib/pricing/quoteTotals'

// Teklif göstergelerinin saf çekirdeği.
//
// NEDEN: 27 Temmuz 2026'da gerçek bir teklif çıkarılırken iki sayı ekranda
// yoktu ve sonradan elle hesaplandı:
//
//   1. "Site fiyatından ne kadar indirim yaptık?" → 59.643,71 ₺ (%1,90)
//   2. "Paket yuvarlamasından doğan artık ne kadar?" → 7002 m²'de 4.869 ₺,
//      6.652,8 m²'de 2.337 ₺
//
// İkisi de karar değiştiren sayılar. Artık kaydetmeden önce görünüyorlar.
//
// GİZLİLİK: bu modülün ürettiği hiçbir alan müşteriye giden yüzeye
// (PDF / WhatsApp / HTML teklif) yazılmaz. Yalnız /ofis panelinde görünür.

/** Bir satırın maliyet dayanağı — katalogdan veya toz setinden gelir. */
export interface LineCostBasis {
  /** İskontolar uygulanmış birim alış, KDV hariç. */
  netCost: number
  /** Sistemin bugünkü marjıyla önerdiği birim satış — "site fiyatı". */
  listUnitPrice: number
  /** m² başına sarfiyat (yalnız toz setinden gelen kalemlerde). */
  consumptionRate?: number | null
  /** Paket içeriği (adet/kg/m²) — artık hesabı için. */
  unitContent?: number | null
}

export interface IndicatorLine extends Partial<LineCostBasis> {
  quantity: number
  /** Operatörün ekranda gördüğü birim fiyat (toplu iskonto ÖNCESİ). */
  unitPrice: number
  lineDiscountPct?: number
}

export interface QuoteIndicators {
  /** KDV hariç mal bedeli (nakliye hariç). */
  netSales: number
  /** Maliyeti bilinen kalemlerin toplam alışı. */
  knownCost: number
  /** netSales − knownCost. Maliyeti bilinmeyen satır varsa eksik ölçer. */
  grossProfit: number
  /** Gerçekleşen marj: kâr ÷ maliyet. Maliyet yoksa null. */
  effectiveMarginPct: number | null
  /** Maliyeti bilinen satırların net satış içindeki payı (%). */
  costCoveragePct: number
  /** Maliyeti bilinmeyen satır sayısı — göstergenin ne kadar güvenilir olduğu. */
  unknownCostLines: number

  /** Sistemin bugünkü fiyatıyla aynı sepetin KDV hariç tutarı. */
  siteTotal: number
  /** siteTotal − netSales. Pozitif = müşteriye indirim yapıldı. */
  siteDiff: number
  siteDiffPct: number

  /** Paket yuvarlamasından doğan fazla malzemenin satış değeri. */
  surplusValue: number

  pricePerM2ExVat: number
  pricePerM2IncVat: number
}

/** Toplu iskonto işlenmiş birim fiyat — belgeye basılan fiyat. */
function netUnitPrice(line: IndicatorLine, discountPct: number): number {
  const satir = 1 - (line.lineDiscountPct ?? 0) / 100
  const toplu = 1 - discountPct / 100
  return roundToKurus(line.unitPrice * satir * toplu)
}

/**
 * Bir satırın hedef marja göre birim fiyatını üretir.
 * Maliyeti bilinmeyen satır DEĞİŞMEZ — uydurma maliyetten fiyat türetilmez.
 */
export function unitPriceAtMargin(
  line: IndicatorLine,
  marginPct: number,
): number | null {
  if (line.netCost == null || !Number.isFinite(line.netCost) || line.netCost <= 0) {
    return null
  }
  return applyMargin(line.netCost, marginPct)
}

/** Bir satırın birim fiyatının ima ettiği marj. */
export function impliedMarginPct(line: IndicatorLine): number | null {
  if (line.netCost == null || line.netCost <= 0) return null
  return (line.unitPrice / line.netCost - 1) * 100
}

/**
 * Paket yuvarlamasından doğan artık: ihtiyaçtan fazla alınan malzemenin
 * satış değeri. Yalnız sarfiyatı ve paket içeriği bilinen kalemlerde
 * hesaplanır (toz grubu seti); levha ve serbest satırlar sayılmaz.
 */
export function packageSurplusValue(
  lines: IndicatorLine[],
  areaM2: number,
  discountPct: number,
): number {
  if (areaM2 <= 0) return 0

  let toplam = 0
  for (const l of lines) {
    const sarfiyat = l.consumptionRate ?? 0
    const icerik = l.unitContent ?? 0
    if (sarfiyat <= 0 || icerik <= 0) continue

    const ihtiyac = areaM2 * sarfiyat
    const alinan = l.quantity * icerik
    const fazla = alinan - ihtiyac
    if (fazla <= 0) continue

    toplam += (fazla / icerik) * netUnitPrice(l, discountPct)
  }
  return roundToKurus(toplam)
}

export function computeQuoteIndicators(input: {
  lines: IndicatorLine[]
  discountPct: number
  shippingCharge: number
  areaM2: number
}): QuoteIndicators {
  const { lines, discountPct, shippingCharge, areaM2 } = input

  let netSales = 0
  let knownCost = 0
  let knownSales = 0
  let siteTotal = 0
  let unknownCostLines = 0

  for (const l of lines) {
    const satirNet = roundToKurus(netUnitPrice(l, discountPct) * l.quantity)
    netSales += satirNet

    const maliyetVar = l.netCost != null && Number.isFinite(l.netCost) && l.netCost > 0
    if (maliyetVar) {
      knownCost += roundToKurus((l.netCost as number) * l.quantity)
      knownSales += satirNet
    } else {
      unknownCostLines += 1
    }

    // Site fiyatı bilinmiyorsa satırın kendi fiyatı esas alınır; böylece
    // "fark" o satırdan sıfır gelir, uydurma indirim gösterilmez.
    const siteBirim = l.listUnitPrice != null && l.listUnitPrice > 0
      ? l.listUnitPrice
      : l.unitPrice
    siteTotal += roundToKurus(siteBirim * l.quantity)
  }

  netSales = roundToKurus(netSales)
  knownCost = roundToKurus(knownCost)
  knownSales = roundToKurus(knownSales)
  siteTotal = roundToKurus(siteTotal)

  const grossProfit = roundToKurus(knownSales - knownCost)
  const effectiveMarginPct = knownCost > 0 ? (grossProfit / knownCost) * 100 : null
  const costCoveragePct = netSales > 0 ? (knownSales / netSales) * 100 : 0

  const siteDiff = roundToKurus(siteTotal - netSales)
  const siteDiffPct = siteTotal > 0 ? (siteDiff / siteTotal) * 100 : 0

  // m² fiyatı belgedeki toplamdan türetilir — KDV tek kaynak
  // (`buildQuoteTotals`) ve nakliye dahil, tıpkı PDF'te olduğu gibi.
  const belge = buildQuoteTotals(netSales, shippingCharge)
  const pricePerM2ExVat = areaM2 > 0 ? roundToKurus(belge.priceWithoutVat / areaM2) : 0
  const pricePerM2IncVat = areaM2 > 0 ? roundToKurus(belge.totalPrice / areaM2) : 0

  return {
    netSales,
    knownCost,
    grossProfit,
    effectiveMarginPct,
    costCoveragePct,
    unknownCostLines,
    siteTotal,
    siteDiff,
    siteDiffPct,
    surplusValue: packageSurplusValue(lines, areaM2, discountPct),
    pricePerM2ExVat,
    pricePerM2IncVat,
  }
}

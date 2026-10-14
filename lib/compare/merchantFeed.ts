// Google Merchant Center ürün beslemesi (Emrah onayı, 14 Ekim 2026 — site dışı plan madde 1).
//
// NEDEN: "taş yünü fiyatları" aramasında Alışveriş sekmesinde ürün ve fiyat görünsün. Satılan birim 1 tam
// kamyondur (en az sipariş); her ürün × kalınlık bir kalemdir, fiyat 1 kamyonun KDV dahil tutarıdır (Merchant
// Center Türkiye'de KDV dahil fiyat ister), m² fiyatı birim fiyat olarak verilir. Tutar ürün sayfasındaki
// "KDV dahil" satırıyla aynı hesaptır: Filli/öteki markalarda TL'ye yuvarlı (SepetVehicleCards), Bonus'ta
// kuruşa yuvarlı (BonusRegionPrice). Koşul: İstanbul Avrupa Yakası teslim (ürün sayfasının varsayılanı).

import type { ComparisonProfile } from '@/lib/technical-profiles'
import { withVat } from '@/lib/pricing/vat'
import type { VehiclePrice } from './vehiclePrices'

export const MERCHANT_FEED_PATH = '/google-merchant-feed.xml'

export interface MerchantFeedItem {
  profile: ComparisonProfile
  thicknessCm: number
  kamyon: VehiclePrice
  /** https://… ürün kalınlık sayfası */
  link: string
  imageLink: string | null
}

const roundToKurus = (n: number) => Math.round(n * 100) / 100

/** Ürün sayfasındaki "KDV dahil" tutarla birebir aynı. */
export function kamyonPriceWithVat(profile: ComparisonProfile, kamyon: VehiclePrice): number {
  return profile.brandName === 'Bonus'
    ? roundToKurus(withVat(kamyon.total))
    : Math.round(withVat(kamyon.unit * kamyon.m2))
}

const m2Text = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
const brandOf = (p: ComparisonProfile) => p.displayName.split(' ')[0]

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function merchantItemFields(item: MerchantFeedItem): Record<string, string> {
  const { profile, thicknessCm, kamyon } = item
  const name = profile.displayName.replace(/\s+Taşyünü$/u, '')
  const density = profile.density.sourceType === 'manufacturer_verbal'
    ? `${profile.density.display} (üretici sözlü beyanı)`
    : profile.density.display
  return {
    id: `${profile.productKey}-${thicknessCm}cm-kamyon`,
    item_group_id: profile.productKey,
    title: `${name} ${thicknessCm} cm Taşyünü Levha — 1 Kamyon (${m2Text(kamyon.m2)} m²)`,
    description:
      `${name} ${thicknessCm} cm taşyünü ısı yalıtım levhası, sıvalı dış cephe mantolaması için. `
      + `Yoğunluk ${density}, ısı iletkenliği ${profile.lambdaDisplay}, A1 yanmaz. `
      + `Satış birimi 1 tam kamyon (${m2Text(kamyon.m2)} m²); en az sipariş 1 tam kamyon. `
      + 'Fiyat İstanbul Avrupa Yakası teslim, tam kamyonda nakliye fiyata dahildir; şehre göre değişir.',
    link: item.link,
    ...(item.imageLink ? { image_link: item.imageLink } : {}),
    availability: 'in_stock',
    condition: 'new',
    price: `${kamyonPriceWithVat(profile, kamyon).toFixed(2)} TRY`,
    unit_pricing_measure: `${kamyon.m2} sqm`,
    unit_pricing_base_measure: '1 sqm',
    brand: brandOf(profile),
    identifier_exists: 'no',
    product_type: `Taşyünü > Mantolama levhası > ${thicknessCm} cm`,
    size: `${thicknessCm} cm`,
  }
}

export function buildMerchantFeedXml(items: MerchantFeedItem[], siteOrigin: string): string {
  const itemXml = items.map((item) => {
    const fields = merchantItemFields(item)
    const lines = Object.entries(fields).map(([key, value]) => `      <g:${key}>${escapeXml(value)}</g:${key}>`)
    lines.push('      <g:shipping><g:country>TR</g:country><g:price>0.00 TRY</g:price></g:shipping>')
    return `    <item>\n${lines.join('\n')}\n    </item>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    '    <title>Taşyünü Fiyatları — taşyünü mantolama levhaları (1 kamyon)</title>',
    `    <link>${escapeXml(siteOrigin)}</link>`,
    '    <description>Sıvalı dış cephe mantolamasına uygun taşyünü levhalar; satış birimi 1 tam kamyon, fiyat KDV dahil.</description>',
    ...itemXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

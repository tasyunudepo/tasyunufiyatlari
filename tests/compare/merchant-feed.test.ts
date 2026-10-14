import { describe, expect, it } from 'vitest'

import { getProfileByKey, type ComparisonProfile } from '@/lib/technical-profiles'
import { buildMerchantFeedXml, kamyonPriceWithVat, merchantItemFields, MERCHANT_FEED_PATH } from '@/lib/compare/merchantFeed'

// Merchant Center beslemesi (14 Ekim 2026): satış birimi 1 kamyon, fiyat KDV dahil ve ürün sayfasındaki
// "KDV dahil" satırıyla aynı hesap; m² fiyatı birim fiyat.

const sw035 = getProfileByKey('dalmacyali-sw035') as ComparisonProfile
const f150 = getProfileByKey('bonus-premium-f-150') as ComparisonProfile

describe('Merchant Center beslemesi', () => {
  it('adres robots.txt "/feed" önekine takılmaz', () => {
    expect(MERCHANT_FEED_PATH.startsWith('/feed')).toBe(false)
  })

  it('Filli/öteki: KDV dahil tutar TL\'ye yuvarlı (kamyon kartıyla aynı)', () => {
    expect(kamyonPriceWithVat(sw035, { unit: 654.92, m2: 403.2, total: 264064 })).toBe(Math.round(654.92 * 403.2 * 1.2))
  })

  it('Bonus: KDV dahil tutar kuruşa yuvarlı (sipariş masası kartıyla aynı)', () => {
    expect(kamyonPriceWithVat(f150, { unit: 370.03, m2: 967.68, total: 358070.63 })).toBe(429684.76)
  })

  it('kalem alanları: 1 kamyon başlığı, birim fiyat, kimlik, kargo', () => {
    const fields = merchantItemFields({
      profile: sw035,
      thicknessCm: 10,
      kamyon: { unit: 654.92, m2: 403.2, total: 264064 },
      link: 'https://www.tasyunufiyatlari.com/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu/10-cm',
      imageLink: 'https://example.invalid/sw035.webp',
    })
    expect(fields.title).toBe('Dalmaçyalı Stonewool SW035 10 cm Taşyünü Levha — 1 Kamyon (403,2 m²)')
    expect(fields.price).toBe(`${Math.round(654.92 * 403.2 * 1.2)}.00 TRY`)
    expect(fields.unit_pricing_measure).toBe('403.2 sqm')
    expect(fields.unit_pricing_base_measure).toBe('1 sqm')
    expect(fields.id).toBe('dalmacyali-sw035-10cm-kamyon')
    expect(fields.description).toContain('en az sipariş 1 tam kamyon')
    expect(fields.description).toContain('üretici sözlü beyanı')
    expect(JSON.stringify(fields)).not.toMatch(/marj|kâr|iskonto/iu)
  })

  it('XML geçerli ad alanı ve kaçışla üretilir', () => {
    const xml = buildMerchantFeedXml([{
      profile: f150,
      thicknessCm: 5,
      kamyon: { unit: 370.03, m2: 967.68, total: 358070.63 },
      link: 'https://www.tasyunufiyatlari.com/urunler/tasyunu-levha/bonus-f-150-tasyunu/5-cm?a=1&b=2',
      imageLink: null,
    }], 'https://www.tasyunufiyatlari.com')
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"')
    expect(xml).toContain('<g:price>429684.76 TRY</g:price>')
    expect(xml).toContain('?a=1&amp;b=2')
    expect(xml).toContain('<g:shipping><g:country>TR</g:country><g:price>0.00 TRY</g:price></g:shipping>')
    expect(xml).not.toContain('<g:image_link>')
  })
})

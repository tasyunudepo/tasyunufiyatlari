import { describe, expect, it } from 'vitest'

import {
  GENERATOR_SITE,
  MATERIAL_OFFER_KEYS,
  PORTFOLIO_OFFERS,
  SALES_CHANNEL_KEYS,
  offerHref,
  showsMaterialOffers,
} from '@/lib/portfolio/offers'

describe('kardeş satış kanalı bağlantıları', () => {
  it('AC-201: kart hedefleri ilgili kategori sayfalarıdır, ana sayfa değil', () => {
    expect(PORTFOLIO_OFFERS.alci.url).toBe('https://alcifiyatlari.com/urun-kategori/makina-alcisi/')
    expect(PORTFOLIO_OFFERS.alcipan.url).toBe('https://alcipanfiyatlari.net/urunler/alcipan-fiyatlari/')
  })

  it('AC-201/207: statik yüzeylerde adres temizdir', () => {
    for (const placement of ['pdp', 'anasayfa', 'hakkimizda'] as const) {
      for (const key of SALES_CHANNEL_KEYS) {
        expect(offerHref(key, placement)).toBe(PORTFOLIO_OFFERS[key].url)
      }
    }
  })

  it('AC-205: teklif sonrası ve PDF bağlantıları yerleşimi ayıran UTM taşır', () => {
    const cases = [
      ['hesap_sonucu', 'hesap-sonucu'],
      ['teklif_teslim', 'teklif-teslim'],
      ['pdf', 'pdf'],
    ] as const

    for (const [placement, content] of cases) {
      const href = new URL(offerHref('alci', placement))
      expect(`${href.origin}${href.pathname}`).toBe(PORTFOLIO_OFFERS.alci.url)
      expect(href.searchParams.get('utm_source')).toBe('tasyunufiyatlari.com')
      expect(href.searchParams.get('utm_medium')).toBe('referral')
      expect(href.searchParams.get('utm_campaign')).toBe('portfoy')
      expect(href.searchParams.get('utm_content')).toBe(content)
    }
  })

  it('AC-203: kart fiyatları koşul ve liste tarihiyle birlikte gelir', () => {
    for (const key of MATERIAL_OFFER_KEYS) {
      const price = PORTFOLIO_OFFERS[key].price
      expect(price, key).toBeDefined()
      expect(price?.amount).toMatch(/\d ₺/u)
      expect(price?.terms).toMatch(/KDV (dâhil|hariç)/u)
      expect(price?.listDate).toMatch(/^\d{1,2} \p{L}+ \d{4}$/u)
    }
  })

  it('alçı kartında TIR toplamı önde, torba fiyatı ondan türetilmiş olarak yazılır', () => {
    // 129.366 / 750 = 172,488 → 172,49. Sıra ters olursa 172,49 × 750 toplamı tutmaz.
    const price = PORTFOLIO_OFFERS.alci.price
    expect(price?.amount).toBe('1 TIR 129.366 ₺')
    expect(price?.vehicle).toBe('750 torba · torbası 172,49 ₺')
    expect((129366 / 750).toFixed(2).replace('.', ',')).toBe('172,49')
    expect(PORTFOLIO_OFFERS.alcipan.price?.amount).toBe('59,77 ₺/m²')
  })

  it('AC-207: jeneratör satış kanalları arasında değildir', () => {
    const channelUrls = SALES_CHANNEL_KEYS.map((key) => PORTFOLIO_OFFERS[key].url).join(' ')
    expect(channelUrls).not.toContain('jenerat')
    expect(Object.keys(PORTFOLIO_OFFERS)).toEqual(['alci', 'alcipan', 'gazbeton'])
  })
})

describe('ürün sayfası kapsamı', () => {
  it('AC-201: üç SW035 kalınlık sayfasında açıktır', () => {
    for (const thickness of [5, 8, 10]) {
      expect(showsMaterialOffers('dalmacyali-sw035-tasyunu', thickness)).toBe(true)
    }
  })

  it('AC-202: listede olmayan sayfada kapalıdır', () => {
    expect(showsMaterialOffers('dalmacyali-sw035-tasyunu', 3)).toBe(false)
    expect(showsMaterialOffers('dalmacyali-sw035-tasyunu', null)).toBe(false)
    expect(showsMaterialOffers('expert-hd150-tasyunu', 10)).toBe(false)
  })
})

describe('Kiralık Jeneratör bağlantıları', () => {
  it('AC-106: www\'li kanonik punycode adrese gider', () => {
    expect(GENERATOR_SITE.homeUrl).toBe('https://www.xn--kiralkjeneratr-7pb94g.com/')
    expect(GENERATOR_SITE.siteUseUrl).toBe(
      'https://www.xn--kiralkjeneratr-7pb94g.com/kullanim-alanlari/santiye',
    )
    expect(new URL(GENERATOR_SITE.homeUrl).hostname).toBe(
      new URL('https://www.kiralıkjeneratör.com/').hostname,
    )
  })

  it('AC-106: çıpa metinleri karardaki gibidir', () => {
    expect(GENERATOR_SITE.homeAnchor).toBe('kiralık jeneratör')
    expect(GENERATOR_SITE.siteUseAnchor).toBe('şantiye için jeneratör kiralama')
  })
})

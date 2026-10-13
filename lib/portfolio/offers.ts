// ============================================================
// Kardeş satış kanalları — tek doğruluk kaynağı
// ============================================================
//
// ÖzerGrup'un diğer malzeme satış kanallarına (alçı, alçıpan, gazbeton)
// verilen bağlantılar ve kartlardaki fiyat satırları yalnız bu dosyadan
// okunur. Karar: reports/capraz-satis-seo-geo-2026-10-09/yuvarlak-masa.md
// (13 Ekim 2026).
//
// Fiyat satırları ilgili sitenin yayındaki listesinden alınır ve aylık
// fiyat güncellemesiyle birlikte elle yenilenir; kartta liste tarihi
// görünür.
// ============================================================

export type OfferKey = 'alci' | 'alcipan' | 'gazbeton'

/** Bağlantının durduğu yüzey. GA4 `placement` parametresi ve `utm_content` bu değeri taşır. */
export type OfferPlacement =
  | 'pdp'
  | 'hesap_sonucu'
  | 'teklif_teslim'
  | 'pdf'
  | 'anasayfa'
  | 'hakkimizda'

export interface OfferPrice {
  /** Fiyatı verilen ürün. */
  product: string
  /** Kartın büyük rakamı: tam araç toplamı ya da birim fiyat, birimiyle. */
  amount: string
  /** Varsa büyük rakamın açılımı (araçtaki adet, birim fiyat). */
  vehicle?: string
  /** KDV ve nakliye koşulu. */
  terms: string
  /** Fiyatın okunduğu liste tarihi. */
  listDate: string
}

export interface PortfolioOffer {
  key: OfferKey
  title: string
  cta: string
  /** Hedef sayfanın kanonik adresi. */
  url: string
  domainLabel: string
  /** Satış kanalları listesindeki bağlantı metni. */
  channelAnchor: string
  /** Satış kanalları listesinde kullanılan tek cümle. */
  channelLine: string
  price?: OfferPrice
}

export const PORTFOLIO_OFFERS: Record<OfferKey, PortfolioOffer> = {
  alci: {
    key: 'alci',
    title: 'Makine alçısı',
    cta: 'Alçı fiyatlarını gör',
    url: 'https://alcifiyatlari.com/urun-kategori/makina-alcisi/',
    domainLabel: 'alcifiyatlari.com',
    channelAnchor: 'Makine alçısı fiyatları',
    channelLine: 'Makine, saten ve perlitli alçıda TIR bazında nakliye dâhil fiyat.',
    price: {
      product: 'Alçıtek Toro makine sıva alçısı (35 kg)',
      // Önce TIR toplamı: torba fiyatı toplamdan türetilip yuvarlanmıştır
      // (129.366 / 750 = 172,488). Ters sırada yazılınca çarpım 1,50 ₺ şaşar.
      amount: '1 TIR 129.366 ₺',
      vehicle: '750 torba · torbası 172,49 ₺',
      terms: 'İstanbul Pendik teslim, nakliye ve KDV dâhil',
      listDate: '13 Ekim 2026',
    },
  },
  alcipan: {
    key: 'alcipan',
    title: 'Alçıpan',
    cta: 'Alçıpan fiyatlarını gör',
    url: 'https://alcipanfiyatlari.net/urunler/alcipan-fiyatlari/',
    domainLabel: 'alcipanfiyatlari.net',
    channelAnchor: 'Alçıpan fiyatları',
    channelLine: 'Alçı levha, profil ve aksesuarda TIR bazında toptan teklif.',
    price: {
      product: 'Dalsan Beyaz COREX 12,5 mm standart levha',
      amount: '59,77 ₺/m²',
      terms: 'Gebze fabrika teslim, KDV hariç',
      listDate: '6 Ekim 2026',
    },
  },
  gazbeton: {
    key: 'gazbeton',
    title: 'Gazbeton',
    cta: 'Gazbeton fiyatlarını gör',
    url: 'https://gazbetonfiyatlari.com/',
    domainLabel: 'gazbetonfiyatlari.com',
    channelAnchor: 'Gazbeton fiyatları',
    channelLine: 'Gazbeton blokta adet, m³ ve palet hesabı.',
  },
}

/** Ürün ve teklif ekranlarında kart olarak sunulan kanallar. */
export const MATERIAL_OFFER_KEYS = ['alci', 'alcipan'] as const

/** Satış kanalları listesinde (ana sayfa, hakkımızda) yer alan kanallar. */
export const SALES_CHANNEL_KEYS = ['alci', 'alcipan', 'gazbeton'] as const

// Google'ın gördüğü statik yüzeylerde adres temiz kalır: hedef sitenin
// GA4'ü geleni zaten `tasyunufiyatlari.com / referral` diye yazar.
// Teklif sonrası ve PDF bağlantıları tarayıcı yönlendirme bilgisini
// taşımayabildiği için (PDF başka cihazda açılır) UTM alır.
const STATIC_PLACEMENTS: ReadonlySet<OfferPlacement> = new Set(['pdp', 'anasayfa', 'hakkimizda'])

export function offerHref(key: OfferKey, placement: OfferPlacement): string {
  const { url } = PORTFOLIO_OFFERS[key]
  if (STATIC_PLACEMENTS.has(placement)) return url

  const target = new URL(url)
  target.searchParams.set('utm_source', 'tasyunufiyatlari.com')
  target.searchParams.set('utm_medium', 'referral')
  target.searchParams.set('utm_campaign', 'portfoy')
  target.searchParams.set('utm_content', placement.replace(/_/gu, '-'))
  return target.toString()
}

// ── Ürün sayfası kapsamı ─────────────────────────────────────
//
// Blok, girişlerin en yoğun olduğu üç SW035 sayfasında başlar. Listeye
// satır eklemek kapsamı genişletmek için yeterlidir; kod değişmez.

export const PORTFOLIO_PDP_PAGES: ReadonlyArray<{ slug: string; thicknesses: readonly number[] }> = [
  { slug: 'dalmacyali-sw035-tasyunu', thicknesses: [5, 8, 10] },
]

export function showsMaterialOffers(slug: string, thicknessCm: number | null | undefined): boolean {
  if (thicknessCm == null) return false
  return PORTFOLIO_PDP_PAGES.some(
    (page) => page.slug === slug && page.thicknesses.includes(thicknessCm),
  )
}

// ── Kiralık Jeneratör ────────────────────────────────────────
//
// Ayrı bir işletmedir; ürün ve teklif ekranlarında gösterilmez, satış
// kanalları listesine girmez. Yalnız /kiralik-jenerator sayfasından
// bağlanır. Alan adı Türkçe karakterli olduğu için adresler punycode'dur.

export const GENERATOR_SITE = {
  label: 'kiralıkjeneratör.com',
  homeUrl: 'https://www.xn--kiralkjeneratr-7pb94g.com/',
  homeAnchor: 'kiralık jeneratör',
  siteUseUrl: 'https://www.xn--kiralkjeneratr-7pb94g.com/kullanim-alanlari/santiye',
  siteUseAnchor: 'şantiye için jeneratör kiralama',
} as const

export const GENERATOR_PAGE_PATH = '/kiralik-jenerator'

// Hub sayfalarının metni (Emrah onayı, 14 Ekim 2026). Rakamlar derleme anı fiyat fotoğrafından gelir;
// kâr / iskonto oranı yazılmaz, yalnız nihai m² fiyatı, kamyon metrajı ve en az sipariş.

import { formatThicknessSegment } from '@/lib/catalog/thickness-url'
import type { ComparisonProfile } from '@/lib/technical-profiles'
import type { ComparisonSnapshot, VehiclePrice } from './vehiclePrices'
import { LEAD_TIME_FAQ } from '@/lib/sales/leadTime'

export interface HubFaq { q: string; a: string }

export interface HubPricedProduct {
  profile: ComparisonProfile
  kamyon: VehiclePrice
  slug: string | null
  href: string | null
}

export interface HubFacts {
  thicknessCm: number
  priced: HubPricedProduct[]
  missing: ComparisonProfile[]
  min: number | null
  max: number | null
  cheapest: HubPricedProduct | null
  /** kamyon m² → o metrajdaki markalar */
  lorryGroups: Array<{ m2: number; brands: string[] }>
}

const tl = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const m2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
/** "Fawori Optimix TR7.5" → "Fawori" (marka kaydı "Optimix" olsa da müşterinin bildiği ad). */
const brandOf = (p: ComparisonProfile) => p.displayName.split(' ')[0]

function joinTr(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

export function hubFacts(snapshot: ComparisonSnapshot, profiles: ComparisonProfile[]): HubFacts {
  const priced: HubPricedProduct[] = []
  const missing: ComparisonProfile[] = []
  for (const profile of profiles) {
    const prices = snapshot.prices[profile.productKey]
    if (!prices?.kamyon) {
      missing.push(profile)
      continue
    }
    const slug = snapshot.slugs[profile.modelShortName] ?? null
    priced.push({
      profile,
      kamyon: prices.kamyon,
      slug,
      href: slug ? `/urunler/tasyunu-levha/${slug}/${formatThicknessSegment(snapshot.thicknessCm)}` : null,
    })
  }
  priced.sort((a, b) => a.kamyon.unit - b.kamyon.unit)
  const groups = new Map<number, string[]>()
  for (const item of priced) {
    const list = groups.get(item.kamyon.m2) ?? []
    const brand = brandOf(item.profile)
    if (!list.includes(brand)) list.push(brand)
    groups.set(item.kamyon.m2, list)
  }
  return {
    thicknessCm: snapshot.thicknessCm,
    priced,
    missing,
    min: priced[0]?.kamyon.unit ?? null,
    max: priced[priced.length - 1]?.kamyon.unit ?? null,
    cheapest: priced[0] ?? null,
    lorryGroups: [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([value, brands]) => ({ m2: value, brands })),
  }
}

function priceRange(f: HubFacts): string {
  if (f.min == null || f.max == null) return ''
  return f.min === f.max ? `${tl(f.min)} ₺` : `${tl(f.min)} ₺ ile ${tl(f.max)} ₺ arasında`
}

function lorryAnswer(f: HubFacts): string {
  if (f.lorryGroups.length === 0) return 'Kamyon metrajı ürünün paketine göre değişir; her satırda o ürünün 1 kamyon metrajı yazar.'
  if (f.lorryGroups.length === 1) {
    return `${f.thicknessCm} cm'de 1 kamyon ${m2(f.lorryGroups[0].m2)} m² taşır. Her satırda o ürünün 1 kamyon tutarı da yazar.`
  }
  const parts = f.lorryGroups.map((g) => `${joinTr(g.brands)} levhalarda ${m2(g.m2)} m²`)
  return `Kamyon metrajı markanın paketine göre değişir: ${parts.join('; ')}. Her satırda o ürünün 1 kamyon tutarı da yazar.`
}

const MINIMUM_FAQ: HubFaq = {
  q: 'En az ne kadar sipariş verebilirim?',
  a: 'En az 1 tam kamyon. Paket, adet ve düşük metrajlı taleplere destek veremiyoruz.',
}
const SHIPPING_FAQ: HubFaq = {
  q: 'Nakliye fiyata dahil mi?',
  a: 'Tam kamyon veya tam TIR siparişinde nakliye fiyata dahildir. Fiyatlar KDV hariçtir.',
}

export interface HubCopy {
  title: string
  description: string
  eyebrow: string
  h1: string
  summary: string
  faq: HubFaq[]
  listName: string
}

export function thicknessHubCopy(f: HubFacts, monthYear: string, cityLabel: string): HubCopy {
  const t = f.thicknessCm
  const n = f.priced.length
  const range = priceRange(f)
  const cheapest = f.cheapest
  return {
    title: `${t} cm Taş Yünü Fiyatları - ${monthYear} | ${n} Levha Yan Yana`,
    description:
      `${t} cm taşyünü levha fiyatları ${monthYear}: sıvalı dış cephe mantolamasına uygun ${n} levhanın 1 kamyon m² fiyatı`
      + (f.min != null && f.max != null ? ` ${tl(f.min)}–${tl(f.max)} ₺ (${cityLabel}, KDV hariç)` : '')
      + '. En az sipariş tutarı, TIR fiyatı ve föy değerleri tek tabloda.',
    eyebrow: `Taşyünü fiyatları · ${monthYear}`,
    h1: `${t} cm taş yünü fiyatları`,
    summary:
      `Sıvalı dış cephe mantolamasına uygun ${n} levha ${t} cm'de yan yana.`
      + (range ? ` 1 kamyon siparişinde m² fiyatı ${range} (${cityLabel} teslim, KDV hariç).` : '')
      + (cheapest && n > 1 ? ` Bu koşulda m² fiyatı en düşük olan ${cheapest.profile.displayName}.` : '')
      + ' Şehri değiştirince fiyatlar yeniden hesaplanır.',
    faq: [
      {
        q: `${t} cm taş yünü m² fiyatı ne kadar?`,
        a: range
          ? `${monthYear} itibarıyla ${cityLabel} teslim, 1 kamyon siparişinde KDV hariç ${range}.`
            + (cheapest && n > 1 ? ` m² fiyatı en düşük olan ${cheapest.profile.displayName} (${tl(cheapest.kamyon.unit)} ₺/m²).` : '')
            + ' Fiyat şehre göre değişir; tablodan şehrinizi seçin.'
          : 'Bu kalınlıkta şu an fiyatlı levha yok; başka bir kalınlık seçin.',
      },
      { q: `${t} cm taşyünü 1 kamyon kaç m²?`, a: lorryAnswer(f) },
      MINIMUM_FAQ,
      SHIPPING_FAQ,
      LEAD_TIME_FAQ,
    ],
    listName: `${t} cm taş yünü levhalar`,
  }
}

export function density150HubCopy(f: HubFacts, monthYear: string, cityLabel: string, all150: ComparisonProfile[]): HubCopy {
  const t = f.thicknessCm
  const n = f.priced.length
  const range = priceRange(f)
  const names = joinTr(f.priced.map((p) => p.profile.displayName))
  return {
    title: `${t} cm 150 Yoğunluk Taş Yünü m² Fiyatları - ${monthYear}`,
    description:
      `${t} cm 150 yoğunluk (150 kg/m³) taşyünü fiyatları ${monthYear}: ${names}`
      + (f.min != null && f.max != null ? `; 1 kamyon m² fiyatı ${tl(f.min)}–${tl(f.max)} ₺ (${cityLabel}, KDV hariç)` : '')
      + '. Föy değerleri ve en az sipariş tutarı tek tabloda.',
    eyebrow: `150 yoğunluk · ${t} cm · ${monthYear}`,
    h1: `${t} cm 150 yoğunluk taş yünü fiyatları`,
    summary:
      `Föy beyanıyla 150 kg/m³ olan ${n} levha ${t} cm'de yan yana: ${names}.`
      + (range ? ` 1 kamyon siparişinde m² fiyatı ${range} (${cityLabel} teslim, KDV hariç).` : '')
      + ' 150 yoğunluk daha iyi ısı yalıtımı iddiası değildir: aynı kalınlıkta ısı yalıtımını ısı iletkenliği gösterir (düşük olan iyi); yoğunluk, dik çekme ve basma dayanımıyla birlikte okunur.',
    faq: [
      {
        q: `${t} cm 150 yoğunluk taş yünü m² fiyatı ne kadar?`,
        a: range
          ? `${monthYear} itibarıyla ${cityLabel} teslim, 1 kamyon siparişinde KDV hariç ${range}. Fiyat şehre göre değişir; tablodan şehrinizi seçin.`
          : 'Bu kalınlıkta şu an fiyatlı 150 yoğunluk levha yok; başka bir kalınlık seçin.',
      },
      {
        q: 'Hangi taşyünü levhalar 150 yoğunlukta?',
        a: `Föy beyanıyla ${joinTr(all150.map((p) => p.displayName))}.`
          + (f.missing.length > 0 ? ` ${joinTr(f.missing.map((p) => p.displayName))} ${t} cm'de fiyat listesinde yok.` : ''),
      },
      { q: `${t} cm 150 yoğunluk taşyünü 1 kamyon kaç m²?`, a: lorryAnswer(f) },
      MINIMUM_FAQ,
      LEAD_TIME_FAQ,
    ],
    listName: `${t} cm 150 yoğunluk taş yünü levhalar`,
  }
}

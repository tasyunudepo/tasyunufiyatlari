// Hub sayfalarının sunucu verisi: fiyat fotoğrafı + metin + bağlantılar (derleme anında).

import { cache } from 'react'

import { getComparisonProfiles } from '@/lib/technical-profiles'
import { formatMonthYear } from '@/lib/seo/monthYear'
import { getComparisonSnapshots } from './snapshot.server'
import {
  COMPARISON_PATH,
  DENSITY_150_PATH,
  HUB_THICKNESSES,
  MIN_PRODUCTS_PER_DENSITY_HUB,
  density150HubPath,
  isDensity150,
  thicknessHubPath,
} from './hubs'
import { density150HubCopy, hubFacts, thicknessHubCopy, type HubCopy, type HubFacts } from './hubCopy'
import type { ComparisonSnapshot } from './vehiclePrices'

const SUB_LABELS: Record<string, string> = {
  avrupa: 'Avrupa Yakası',
  anadolu: 'Anadolu Yakası',
  gebze: 'Gebze',
  diger: 'Merkez ve diğer ilçeler',
}

/** Bir derlemede tek kez: bütün kalınlıkların fotoğrafı. */
export const getHubSnapshots = cache(async () => getComparisonSnapshots(HUB_THICKNESSES))

export async function getDensity150HubThicknesses(): Promise<number[]> {
  const snapshots = await getHubSnapshots()
  const profiles = getComparisonProfiles().filter(isDensity150)
  return HUB_THICKNESSES.filter((t) => {
    const snapshot = snapshots.get(t)
    if (!snapshot) return false
    return profiles.filter((p) => snapshot.prices[p.productKey]?.kamyon).length >= MIN_PRODUCTS_PER_DENSITY_HUB
  })
}

export interface HubLink { label: string; href: string; current?: boolean }
export interface HubPageData {
  variant: 'kalinlik' | 'yogunluk_150_kalinlik'
  path: string
  copy: HubCopy
  facts: HubFacts
  snapshot: ComparisonSnapshot
  thicknessLinks: Record<number, string>
  breadcrumbs: Array<{ name: string; path: string }>
  linkGroups: Array<{ title: string; links: HubLink[] }>
}

function cityLabel(snapshot: ComparisonSnapshot): string {
  return snapshot.subChoice ? `${snapshot.cityName} ${SUB_LABELS[snapshot.subChoice] ?? ''}`.trim() : snapshot.cityName
}

export async function getThicknessHubData(thicknessCm: number): Promise<HubPageData | null> {
  const snapshots = await getHubSnapshots()
  const snapshot = snapshots.get(thicknessCm)
  if (!snapshot) return null
  const density150 = await getDensity150HubThicknesses()
  const profiles = getComparisonProfiles()
  const facts = hubFacts(snapshot, profiles)
  const copy = thicknessHubCopy(facts, formatMonthYear(), cityLabel(snapshot))
  const path = thicknessHubPath(thicknessCm)
  const thicknessLinks = Object.fromEntries(HUB_THICKNESSES.map((t) => [t, thicknessHubPath(t)]))
  return {
    variant: 'kalinlik',
    path,
    copy,
    facts,
    snapshot,
    thicknessLinks,
    breadcrumbs: [
      { name: 'Ana sayfa', path: '/' },
      { name: 'Taşyünü karşılaştırma', path: COMPARISON_PATH },
      { name: `${thicknessCm} cm taş yünü fiyatları`, path },
    ],
    linkGroups: [
      {
        title: `${thicknessCm} cm ürün sayfaları`,
        links: facts.priced.filter((p) => p.href).map((p) => ({ label: `${p.profile.displayName} ${thicknessCm} cm fiyatı`, href: p.href! })),
      },
      {
        title: 'Öteki kalınlıklar',
        links: HUB_THICKNESSES.map((t) => ({ label: `${t} cm taş yünü fiyatları`, href: thicknessHubPath(t), current: t === thicknessCm })),
      },
      {
        title: 'Yoğunluğa göre',
        links: [
          ...(density150.includes(thicknessCm)
            ? [{ label: `${thicknessCm} cm 150 yoğunluk taş yünü fiyatları`, href: density150HubPath(thicknessCm) }]
            : []),
          { label: '150 yoğunluk taş yünü fiyatları', href: DENSITY_150_PATH },
          { label: 'Bütün kalınlıklar ve şehirler: karşılaştırma', href: COMPARISON_PATH },
        ],
      },
    ],
  }
}

export async function getDensity150HubData(thicknessCm: number): Promise<HubPageData | null> {
  const thicknesses = await getDensity150HubThicknesses()
  if (!thicknesses.includes(thicknessCm)) return null
  const snapshot = (await getHubSnapshots()).get(thicknessCm)!
  const all150 = getComparisonProfiles().filter(isDensity150)
  const facts = hubFacts(snapshot, all150)
  const copy = density150HubCopy(facts, formatMonthYear(), cityLabel(snapshot), all150)
  const path = density150HubPath(thicknessCm)
  return {
    variant: 'yogunluk_150_kalinlik',
    path,
    copy,
    facts,
    snapshot,
    thicknessLinks: Object.fromEntries(thicknesses.map((t) => [t, density150HubPath(t)])),
    breadcrumbs: [
      { name: 'Ana sayfa', path: '/' },
      { name: '150 yoğunluk taş yünü fiyatları', path: DENSITY_150_PATH },
      { name: `${thicknessCm} cm`, path },
    ],
    linkGroups: [
      {
        title: `${thicknessCm} cm 150 yoğunluk ürün sayfaları`,
        links: facts.priced.filter((p) => p.href).map((p) => ({ label: `${p.profile.displayName} ${thicknessCm} cm fiyatı`, href: p.href! })),
      },
      {
        title: '150 yoğunluk, öteki kalınlıklar',
        links: thicknesses.map((t) => ({ label: `${t} cm 150 yoğunluk taş yünü fiyatları`, href: density150HubPath(t), current: t === thicknessCm })),
      },
      {
        title: `${thicknessCm} cm bütün levhalar`,
        links: [
          { label: `${thicknessCm} cm taş yünü fiyatları (bütün markalar)`, href: thicknessHubPath(thicknessCm) },
          { label: 'Bütün kalınlıklar ve şehirler: karşılaştırma', href: COMPARISON_PATH },
        ],
      },
    ],
  }
}

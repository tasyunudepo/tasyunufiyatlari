// Merchant Center beslemesinin sunucu verisi: hub fiyat fotoğrafı + katalog görselleri (derleme anında).

import { getCatalogProducts } from '@/lib/catalog/server'
import { getComparisonProfiles } from '@/lib/technical-profiles'
import { SITE_ORIGIN } from '@/lib/seo/siteConfig'
import { getHubSnapshots } from './hubPages.server'
import { hubFacts } from './hubCopy'
import { HUB_THICKNESSES } from './hubs'
import { buildMerchantFeedXml, type MerchantFeedItem } from './merchantFeed'

export async function getMerchantFeedItems(): Promise<MerchantFeedItem[]> {
  const [snapshots, catalog] = await Promise.all([getHubSnapshots(), getCatalogProducts('tasyunu')])
  const images = new Map<string, string>()
  for (const product of catalog.products) {
    if (product.model && product.image_cover && !images.has(product.model)) images.set(product.model, product.image_cover)
  }
  const profiles = getComparisonProfiles()
  const items: MerchantFeedItem[] = []
  for (const t of HUB_THICKNESSES) {
    const snapshot = snapshots.get(t)
    if (!snapshot) continue
    for (const priced of hubFacts(snapshot, profiles).priced) {
      if (!priced.href) continue
      items.push({
        profile: priced.profile,
        thicknessCm: t,
        kamyon: priced.kamyon,
        link: `${SITE_ORIGIN}${priced.href}`,
        imageLink: images.get(priced.profile.modelShortName) ?? null,
      })
    }
  }
  return items
}

export async function getMerchantFeedXml(): Promise<string> {
  return buildMerchantFeedXml(await getMerchantFeedItems(), SITE_ORIGIN)
}

export interface BrandLogoAsset {
  src: string
  width: number
  height: number
}

export interface BrandMarkPresentation {
  displayName: string
  accessibleName: string
  logo: BrandLogoAsset | null
}

interface BrandRule {
  matches: (normalizedName: string) => boolean
  displayName: string
  accessibleName: string
  logo: BrandLogoAsset
}

const FAWORI_LOGO: BrandLogoAsset = {
  src: '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
  width: 180,
  height: 100,
}

const BRAND_RULES: readonly BrandRule[] = [
  {
    matches: name => name.includes('expert'),
    displayName: 'Expert',
    accessibleName: 'Fawori Expert',
    logo: FAWORI_LOGO,
  },
  {
    matches: name => name.includes('optimix'),
    displayName: 'Optimix',
    accessibleName: 'Fawori Optimix',
    logo: FAWORI_LOGO,
  },
  {
    matches: name => name.includes('bonus'),
    displayName: 'Bonus',
    accessibleName: 'Bonus',
    logo: {
      src: '/images/markalogolar/bonus-logo-red.svg',
      width: 307,
      height: 118,
    },
  },
  {
    matches: name => name.includes('dalmaçyalı'),
    displayName: 'Dalmaçyalı',
    accessibleName: 'Dalmaçyalı',
    logo: {
      src: '/images/markalogolar/dalmaçyalı-taşyünü- fiyatları.webp',
      width: 180,
      height: 100,
    },
  },
  {
    matches: name => name.includes('fawori'),
    displayName: 'Fawori',
    accessibleName: 'Fawori',
    logo: FAWORI_LOGO,
  },
  {
    matches: name => name.includes('tekno'),
    displayName: 'TEKNO',
    accessibleName: 'TEKNO',
    logo: {
      src: '/images/markalogolar/Tekno Taşyünü ve EPs Fiyatları.webp',
      width: 180,
      height: 100,
    },
  },
  {
    matches: name => name.includes('filli boya'),
    displayName: 'Filli Boya',
    accessibleName: 'Filli Boya',
    logo: {
      src: '/images/markalogolar/filli-boya-mantolama.webp',
      width: 180,
      height: 100,
    },
  },
  {
    matches: name => name.includes('knauf'),
    displayName: 'Knauf',
    accessibleName: 'Knauf',
    logo: {
      src: '/images/markalogolar/Knauf Mineral yünleri.webp',
      width: 180,
      height: 100,
    },
  },
]

export function resolveBrandMark(brandName: string | null | undefined): BrandMarkPresentation {
  const originalName = (brandName ?? '').trim()
  const normalizedName = originalName.toLocaleLowerCase('tr-TR')
  const matchedRule = BRAND_RULES.find(rule => rule.matches(normalizedName))

  if (matchedRule) {
    return {
      displayName: matchedRule.displayName,
      accessibleName: matchedRule.accessibleName,
      logo: matchedRule.logo,
    }
  }

  const fallbackName = originalName || 'Marka bilgisi yok'
  return {
    displayName: fallbackName,
    accessibleName: fallbackName,
    logo: null,
  }
}

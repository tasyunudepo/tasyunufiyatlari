// Sitedeki videoların yeri ve dosyaları (16 Ekim 2026). Kaynak: Animasyon/numuneler/yayin/PILOT-PLANI.md.
// S4 "Hangi kalınlık" yalnız Dalmaçyalı SW035'in 5, 8 ve 10 cm sayfalarında durur (videodaki metraj ve paket
// değerleri bu ürünün sayfalarından alındı); başka marka ya da kalınlığa koymak için listeye satır eklenir.

export type VideoKaynak = {
  variant: string
  w: number
  h: number
  poster: string
  webm?: string
  mp4: string
}

export type VideoTanim = {
  id: string
  etiket: string
  masaustu: VideoKaynak
  mobil: VideoKaynak
}

export const THICKNESS_VIDEO_PAGES: ReadonlyArray<{ slug: string; thicknesses: readonly number[] }> = [
  { slug: 'dalmacyali-sw035-tasyunu', thicknesses: [5, 8, 10] },
]

export function showsThicknessVideo(slug: string, thicknessCm: number | null | undefined): boolean {
  if (thicknessCm == null) return false
  return THICKNESS_VIDEO_PAGES.some(
    (page) => page.slug === slug && page.thicknesses.includes(thicknessCm),
  )
}

export const THICKNESS_VIDEO: VideoTanim = {
  id: 'S4',
  etiket: 'Hangi kalınlık: Dalmaçyalı SW035 5, 8 ve 10 cm araç metrajı ve paket içeriği',
  masaustu: {
    variant: '16x9',
    w: 1920,
    h: 1080,
    poster: '/video/hangi-kalinlik-16x9-poster.webp',
    webm: '/video/hangi-kalinlik-16x9.webm',
    mp4: '/video/hangi-kalinlik-16x9.mp4',
  },
  mobil: {
    variant: '9x16',
    w: 1080,
    h: 1920,
    poster: '/video/hangi-kalinlik-9x16-poster.webp',
    mp4: '/video/hangi-kalinlik-9x16.mp4',
  },
}

export const ORDER_PROCESS_VIDEO: VideoTanim = {
  id: 'S2A',
  etiket: 'Sipariş süreci: ÖzerGrup Tuzla deposu, teklif, ödeme ve teslim adımları',
  masaustu: {
    variant: '16x9',
    w: 1280,
    h: 720,
    poster: '/video/siparis-sureci-16x9-poster.webp',
    webm: '/video/siparis-sureci-16x9.webm',
    mp4: '/video/siparis-sureci-16x9.mp4',
  },
  mobil: {
    variant: '9x16',
    w: 720,
    h: 1280,
    poster: '/video/siparis-sureci-9x16-poster.webp',
    webm: '/video/siparis-sureci-9x16.webm',
    mp4: '/video/siparis-sureci-9x16.mp4',
  },
}

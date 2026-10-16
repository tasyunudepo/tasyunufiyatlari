import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ORDER_PROCESS_VIDEO, THICKNESS_VIDEO, showsThicknessVideo } from '@/lib/video/placements'

describe('S4 kalınlık videosu kapsamı', () => {
  it('yalnız Dalmaçyalı SW035 5, 8 ve 10 cm sayfalarında görünür', () => {
    for (const t of [5, 8, 10]) expect(showsThicknessVideo('dalmacyali-sw035-tasyunu', t)).toBe(true)
  })

  it('SW035 diğer kalınlıklarda ve kalınlıksız sayfada görünmez', () => {
    for (const t of [3, 4, 6, 7, 12, 15]) expect(showsThicknessVideo('dalmacyali-sw035-tasyunu', t)).toBe(false)
    expect(showsThicknessVideo('dalmacyali-sw035-tasyunu', null)).toBe(false)
    expect(showsThicknessVideo('dalmacyali-sw035-tasyunu', undefined)).toBe(false)
  })

  it('başka marka sayfalarında görünmez', () => {
    for (const slug of ['bonus-f-120-tasyunu', 'expert-ld125-tasyunu', 'fawori-tr-7-5-tasyunu']) {
      expect(showsThicknessVideo(slug, 10)).toBe(false)
    }
  })
})

describe('video dosyaları', () => {
  it('her kaynak ve poster public/ altında var', () => {
    for (const video of [THICKNESS_VIDEO, ORDER_PROCESS_VIDEO]) {
      for (const k of [video.masaustu, video.mobil]) {
        for (const yol of [k.poster, k.mp4, k.webm].filter(Boolean) as string[]) {
          expect(existsSync(join(process.cwd(), 'public', yol)), yol).toBe(true)
        }
      }
    }
  })

  it('masaüstü 16x9, mobil 9x16', () => {
    for (const video of [THICKNESS_VIDEO, ORDER_PROCESS_VIDEO]) {
      expect(video.masaustu.variant).toBe('16x9')
      expect(video.masaustu.w / video.masaustu.h).toBeCloseTo(16 / 9, 3)
      expect(video.mobil.variant).toBe('9x16')
      expect(video.mobil.w / video.mobil.h).toBeCloseTo(9 / 16, 3)
    }
  })
})

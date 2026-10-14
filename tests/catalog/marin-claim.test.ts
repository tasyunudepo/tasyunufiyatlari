import { describe, expect, it } from 'vitest'

import { TASYUNU_SECTIONS } from '@/lib/catalog/sections'

// 14 Ekim 2026 (Emrah): Bonus Marin için bu yıl marin sertifikası alınmadı; müşteri metninde sertifika iddiası yok.
describe('Gemi & Marin grubu', () => {
  it('marin sertifikası iddiası taşımaz', () => {
    const marin = TASYUNU_SECTIONS.find((s) => s.key === 'gemi-marin')!
    expect(marin.desc).not.toMatch(/sertifika/iu)
    expect(marin.desc).toContain('Tersane ve gemi uygulamaları')
  })
})

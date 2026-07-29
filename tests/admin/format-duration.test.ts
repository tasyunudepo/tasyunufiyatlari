import { describe, expect, it } from 'vitest'

import {
  formatSaat,
  saatFarki,
  sureGosterimi,
  temasSiddeti,
  bekleyisSuresi,
} from '@/lib/admin/formatDuration'

// Audit V3: "Ortalama ilk temas" kartı canlıda **1674 saat** yazıyordu.
// 70 günü saat cinsinden okumak metriği kullanılamaz kılıyordu; üstelik
// bu bir alarmdı ama nötr görünüyordu.

describe('süre biçimlendirme', () => {
  it.each([
    [0.5, 'bir saatten az'],
    [1, '1 saat'],
    [3, '3 saat'],
    [23, '23 saat'],
    [24, '1 gün'],
    [48, '2 gün'],
    [72, '3 gün'],
    [240, '10 gün'],
    [336, '2 hafta'],
    [504, '3 hafta'],
    [1674, '2 ay'], // canlıdaki gerçek değer — 69,75 gün
    [2160, '3 ay'],
  ])('%s saat → "%s"', (saat, beklenen) => {
    expect(formatSaat(saat)).toBe(beklenen)
  })

  it('geçersiz girdide çizgi döner', () => {
    expect(formatSaat(Number.NaN)).toBe('—')
    expect(formatSaat(-5)).toBe('—')
    expect(formatSaat(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('temas şiddeti', () => {
  it('ilk gün içinde temas iyidir', () => {
    expect(temasSiddeti(1)).toBe('iyi')
    expect(temasSiddeti(24)).toBe('iyi')
  })

  it('ikinci gün uyarıdır', () => {
    expect(temasSiddeti(25)).toBe('uyari')
    expect(temasSiddeti(48)).toBe('uyari')
  })

  it('iki günü aşan temas kritiktir', () => {
    expect(temasSiddeti(49)).toBe('kritik')
    expect(temasSiddeti(1674)).toBe('kritik')
  })
})

describe('süre gösterimi', () => {
  it('canlıdaki 1674 saat artık okunabilir ve alarm veriyor', () => {
    const g = sureGosterimi(1674)
    expect(g).not.toBeNull()
    expect(g!.metin).toBe('2 ay')
    expect(g!.siddet).toBe('kritik')
    // Ham değer sıralama için korunur.
    expect(g!.saat).toBe(1674)
  })

  it('veri yoksa null döner — "0 saat" gibi yanlış bir şey uydurmaz', () => {
    expect(sureGosterimi(null)).toBeNull()
    expect(sureGosterimi(undefined)).toBeNull()
    expect(sureGosterimi(Number.NaN)).toBeNull()
  })
})

describe('saat farkı', () => {
  it('iki tarih arasını saat olarak verir', () => {
    expect(saatFarki('2026-07-01T00:00:00Z', '2026-07-01T06:00:00Z')).toBe(6)
    expect(saatFarki('2026-07-01T00:00:00Z', '2026-07-03T00:00:00Z')).toBe(48)
  })

  it('eksik tarihte null döner', () => {
    expect(saatFarki(null, '2026-07-01T00:00:00Z')).toBeNull()
    expect(saatFarki('2026-07-01T00:00:00Z', null)).toBeNull()
  })

  it('negatif fark (bitiş başlangıçtan önce) null döner', () => {
    // Bozuk veri "−5 saat sonra temas edildi" diye gösterilmemeli.
    expect(saatFarki('2026-07-03T00:00:00Z', '2026-07-01T00:00:00Z')).toBeNull()
  })
})

describe('bekleyiş metni — Türkçe ek uyumu', () => {
  it.each([
    [3, '3 saattir'],
    [23, '23 saattir'],
    [24, '1 gündür'],
    [312, '13 gündür'],
    [504, '3 haftadır'],
    [1674, '2 aydır'],
  ])('%s saat → "%s"', (saat, beklenen) => {
    expect(bekleyisSuresi(saat)).toBe(beklenen)
  })

  it('düz birleştirmenin ürettiği bozuk ekler oluşmaz', () => {
    for (const saat of [3, 24, 312, 504, 1674]) {
      const m = bekleyisSuresi(saat)
      expect(m).not.toContain('güntir')
      expect(m).not.toContain('haftatir')
      expect(m).not.toContain('aytir')
    }
  })

  it('bir saatten kısa süre okunabilir kalır', () => {
    expect(bekleyisSuresi(0.5)).toBe('bir saatten kısa süredir')
  })

  it('geçersiz girdide çizgi döner', () => {
    expect(bekleyisSuresi(Number.NaN)).toBe('—')
  })
})

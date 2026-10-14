import { describe, expect, it } from 'vitest'

import { bestTechnicalValues, isBest, parseKpa, parseLambda } from '@/lib/compare/technicalValues'
import { getComparisonProfiles } from '@/lib/technical-profiles'

// Karşılaştırma tablosu (Emrah kararı, 14 Ekim 2026): hücre tek satır, notlar dipnota; en iyi değer
// temkinli uçla (λ üst, dayanım alt) seçilir.
describe('föy değerlerinin kısa gösterimi', () => {
  it('ısı iletkenliği: aralıkta üst uç, not dipnota', () => {
    expect(parseLambda('0,036–0,040 W/mK (kalınlığa göre)')).toEqual({ short: '0,036–0,040', value: 0.04, note: 'kalınlığa göre' })
    expect(parseLambda('0,035 W/mK')).toEqual({ short: '0,035', value: 0.035, note: null })
  })

  it('basma: sınıf ve föy notu dipnota, alt uç kıyasa', () => {
    expect(parseKpa('≥40 kPa — CS(10)40 (30 mm için föy notu: değer farklılaşabilir)')).toEqual({
      short: '≥40 kPa',
      value: 40,
      note: 'CS(10)40; 30 mm için föy notu: değer farklılaşabilir',
    })
    expect(parseKpa('40–70 kPa (kalınlığa göre; ince kalınlıkta NPD)')).toEqual({ short: '40–70 kPa', value: 40, note: 'kalınlığa göre; ince kalınlıkta NPD' })
    expect(parseKpa('≥25 kPa — CS(10)25')).toEqual({ short: '≥25 kPa', value: 25, note: 'CS(10)25' })
    expect(parseKpa('≥7,5 kPa')).toEqual({ short: '≥7,5 kPa', value: 7.5, note: null })
    expect(parseKpa('Aranmaz').value).toBeNull()
  })

  it('karşılaştırmadaki 8 levhanın hepsi okunur; en iyiler beklenen ürünlerde', () => {
    const rows = getComparisonProfiles().map((p) => ({
      key: p.modelShortName,
      lambda: parseLambda(p.lambdaDisplay),
      tensile: parseKpa(p.tensileDisplay),
      compressive: parseKpa(p.compressiveDisplay),
    }))
    expect(rows).toHaveLength(8)
    for (const r of rows) {
      expect(r.lambda.value, r.key).not.toBeNull()
      expect(r.tensile.value, r.key).not.toBeNull()
      expect(r.compressive.value, r.key).not.toBeNull()
      expect(r.compressive.short, r.key).not.toMatch(/föy notu|NPD|CS\(/u)
    }
    const best = bestTechnicalValues(rows)
    expect(best).toEqual({ lambda: 0.035, tensile: 15, compressive: 40 })
    const keys = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).map((r) => r.key).sort()
    expect(keys((r) => isBest(r.lambda.value, best.lambda))).toEqual(['Premium', 'SW035', 'TR7.5'])
    expect(keys((r) => isBest(r.tensile.value, best.tensile))).toEqual(['F 150', 'HD150'])
    expect(keys((r) => isBest(r.compressive.value, best.compressive))).toEqual(['F 150', 'HD150'])
  })
})

import { describe, expect, it } from 'vitest'

import { computeBonusCapacity } from '@/lib/pricing/bonus/sale'

// Golden değerler: BONUS FİYAT LİSTESİ Haziran 2026 (üretici tablosu
// "Kamyon m²" / "Tır m²" sütunları). Metraj adımının tam araç önerileri
// bu değerlerle kurulur.

describe('Bonus paket/araç kapasitesi', () => {
  it('F 150 / 5 cm → paket 2,88 m², kamyon 967,7 m², TIR 1.774,1 m²', () => {
    expect(computeBonusCapacity({ modelShortName: 'F 150', thicknessCm: 5 })).toEqual({
      ok: true,
      thicknessMm: 50,
      packageM2: 2.88,
      packagePieces: 4,
      kamyonM2: 967.7,
      tirM2: 1774.1,
    })
  })

  it('F 120 / 4 cm → paket 4,32 m², kamyon 1.140,5 m², TIR 2.090,9 m²', () => {
    expect(computeBonusCapacity({ modelShortName: 'F 120', thicknessCm: 4 })).toEqual({
      ok: true,
      thicknessMm: 40,
      packageM2: 4.32,
      packagePieces: 6,
      kamyonM2: 1140.5,
      tirM2: 2090.9,
    })
  })

  it('bilinmeyen model fail-closed döner', () => {
    expect(computeBonusCapacity({ modelShortName: 'Yok Böyle Model', thicknessCm: 5 }))
      .toEqual({ ok: false, reason: 'unknown_model' })
  })

  it('Bonus olmayan model (SW035) kapasite üretmez', () => {
    expect(computeBonusCapacity({ modelShortName: 'SW035', thicknessCm: 5 }))
      .toEqual({ ok: false, reason: 'not_bonus' })
  })

  it('listede olmayan kalınlık fail-closed döner', () => {
    expect(computeBonusCapacity({ modelShortName: 'F 150', thicknessCm: 33 }))
      .toEqual({ ok: false, reason: 'thickness_unavailable' })
  })

  it('kapasite sonucu fiyat alanı taşımaz (sızıntı sözleşmesi)', () => {
    const result = computeBonusCapacity({ modelShortName: 'F 150', thicknessCm: 5 })
    const keys = Object.keys(result).join(' ')
    expect(keys).not.toMatch(/price|list|base|discount|iskonto|marj|margin/iu)
  })
})

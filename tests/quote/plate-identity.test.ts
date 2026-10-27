import { describe, expect, it } from 'vitest'

import { formatPlateLine, plateIdentitySchema, resolvePlateIdentity } from '@/lib/quote/plateIdentity'

// Teklif PDF standardı, bölüm A (Emrah + Astra + Opus, 27 Ekim 2026):
// docs/standartlar/teklif-pdf-standardi.md

describe('levha kimliği: ad, tür, özellik', () => {
  it('Bonus Gold Plus 50: giydirme cephe, föy yoğunluğu, 60 × 120 cm, pakette 3 levha', () => {
    const identity = resolvePlateIdentity({
      brandName: 'Bonus',
      modelShortName: 'Gold Plus 50',
      materialSlug: 'tasyunu',
      thicknessCm: 12,
      packageM2: 2.16,
      packagePieces: 3,
    })
    expect(identity).not.toBeNull()
    expect(plateIdentitySchema.parse(identity)).toEqual(identity)
    expect(formatPlateLine(identity!, 1900.8, 880)).toEqual({
      title: 'Bonus Gold Plus 50 · 12 cm',
      kind: 'Taşyünü levha · Giydirme cephe',
      specs: 'Yoğunluk 50 kg/m³ (föy beyanı) · Levha 60 × 120 cm · Pakette 3 levha = 2,16 m²',
    })
  })

  it('paket karşılığı fiyatlandırılan metrajdan farklıysa yazılır, miktar değişmez', () => {
    const identity = resolvePlateIdentity({
      brandName: 'Bonus', modelShortName: 'Gold Plus 50', materialSlug: 'tasyunu', thicknessCm: 12, packageM2: 2.16, packagePieces: 3,
    })!
    expect(formatPlateLine(identity, 1900, 880).specs).toBe(
      'Yoğunluk 50 kg/m³ (föy beyanı) · Levha 60 × 120 cm · Pakette 3 levha = 2,16 m² · 880 paket = 1.900,80 m²',
    )
  })

  it('F 150: sıvalı dış cephe mantolama, toleranslı yoğunluk parantezsiz', () => {
    const identity = resolvePlateIdentity({
      brandName: 'Bonus', modelShortName: 'F 150', materialSlug: 'tasyunu', thicknessCm: 10, packageM2: 1.44, packagePieces: 2,
    })!
    const line = formatPlateLine(identity, 483.84, 336)
    expect(line.title).toBe('Bonus F 150 · 10 cm')
    expect(line.kind).toBe('Taşyünü levha · Sıvalı dış cephe mantolama')
    expect(line.specs).toBe('Yoğunluk 150 kg/m³ ±%10 (föy beyanı) · Levha 60 × 120 cm · Pakette 2 levha = 1,44 m²')
  })

  it('Filli taşyünü: levha ölçüsü ve paket adedi paket m²sinden', () => {
    const identity = resolvePlateIdentity({
      brandName: 'Optimix', modelShortName: 'TR7.5', materialSlug: 'tasyunu', thicknessCm: 15, packageM2: 2.4,
    })!
    const line = formatPlateLine(identity, 2500.8, 1042)
    expect(line.title).toBe('Fawori Optimix TR7.5 · 15 cm')
    expect(line.kind.startsWith('Taşyünü levha')).toBe(true)
    expect(line.specs).toContain('Levha 60 × 100 cm · Pakette 4 levha = 2,40 m²')
  })

  it('teknik bilgisi olmayan üründe değer uydurulmaz; tür grubu yine yazılır', () => {
    const identity = resolvePlateIdentity({
      brandName: 'Bilinmeyen', modelShortName: 'X 1', materialSlug: 'eps', thicknessCm: 5, packageM2: null,
    })!
    expect(formatPlateLine(identity, 100, null)).toEqual({ title: 'Bilinmeyen X 1 · 5 cm', kind: 'EPS levha', specs: null })
  })

  it('malzemesi bilinmeyen kayıtta tür "Levha" olur', () => {
    const identity = resolvePlateIdentity({ brandName: 'Bonus', modelShortName: null, materialSlug: null, thicknessCm: null, packageM2: null })!
    expect(identity.kind).toBe('Levha')
    expect(formatPlateLine(identity, 10, null).title).toBe('Bonus')
  })
})

import { describe, expect, it } from 'vitest'

import { formatPlateLine, plateIdentitySchema, resolvePlateIdentity } from '@/lib/quote/plateIdentity'

// Teklif PDF standardı, bölüm A (Emrah + Astra + Opus, 27 Ekim 2026):
// docs/standartlar/teklif-pdf-standardi.md
// 28 Ekim 2026 (Emrah): tablo satırında tür başlığa girer; uygulama alanı,
// yoğunluğun tolerans ve kaynak etiketi ile paket karşılığı basılmaz.

describe('levha kimliği: ad, tür, özellik', () => {
  it('Bonus Gold Plus 50: tür başlıkta, özellik tek satır', () => {
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
    expect(formatPlateLine(identity!)).toEqual({
      title: 'Bonus Gold Plus 50 · 12 cm',
      kind: 'Taşyünü levha · Giydirme cephe',
      rowTitle: 'Bonus Gold Plus 50 taşyünü levha · 12 cm',
      specs: 'Yoğunluk 50 kg/m³ · Levha 60 × 120 cm · Pakette 3 levha = 2,16 m²',
    })
  })

  it('paket karşılığı tabloya yazılmaz; paket sayısı miktar sütunundadır', () => {
    const identity = resolvePlateIdentity({
      brandName: 'Bonus', modelShortName: 'Gold Plus 50', materialSlug: 'tasyunu', thicknessCm: 12, packageM2: 2.16, packagePieces: 3,
    })!
    expect(formatPlateLine(identity).specs).not.toContain('paket =')
  })

  it('F 150: uygulama alanı türde kalır ama satıra girmez; tolerans ve kaynak etiketi düşer', () => {
    const identity = resolvePlateIdentity({
      brandName: 'Bonus', modelShortName: 'F 150', materialSlug: 'tasyunu', thicknessCm: 10, packageM2: 1.44, packagePieces: 2,
    })!
    const line = formatPlateLine(identity)
    expect(line.title).toBe('Bonus F 150 · 10 cm')
    expect(line.kind).toBe('Taşyünü levha · Sıvalı dış cephe mantolama')
    expect(line.rowTitle).toBe('Bonus F 150 taşyünü levha · 10 cm')
    expect(line.specs).toBe('Yoğunluk 150 kg/m³ · Levha 60 × 120 cm · Pakette 2 levha = 1,44 m²')
  })

  it('Filli taşyünü: levha ölçüsü ve paket adedi paket m²sinden', () => {
    const identity = resolvePlateIdentity({
      brandName: 'Optimix', modelShortName: 'TR7.5', materialSlug: 'tasyunu', thicknessCm: 15, packageM2: 2.4,
    })!
    const line = formatPlateLine(identity)
    expect(line.title).toBe('Fawori Optimix TR7.5 · 15 cm')
    expect(line.kind.startsWith('Taşyünü levha')).toBe(true)
    expect(line.specs).toContain('Levha 60 × 100 cm · Pakette 4 levha = 2,40 m²')
  })

  it('EPS kısaltması büyük harf kalır; teknik bilgisi olmayan üründe değer uydurulmaz', () => {
    const identity = resolvePlateIdentity({
      brandName: 'Bilinmeyen', modelShortName: 'X 1', materialSlug: 'eps', thicknessCm: 5, packageM2: null,
    })!
    expect(formatPlateLine(identity)).toEqual({ title: 'Bilinmeyen X 1 · 5 cm', kind: 'EPS levha', rowTitle: 'Bilinmeyen X 1 EPS levha · 5 cm', specs: null })
  })

  it('ad türü zaten söylüyorsa başlıkta tekrar edilmez', () => {
    const identity = plateIdentitySchema.parse({
      name: 'Bonus Desibel Alçı Kaplı Kompozit Taşyünü Levha', thicknessCm: 5, kind: 'Taşyünü levha', density: null,
      boardSize: null, pieceLabel: 'levha', piecesPerPackage: null, packageM2: null,
    })
    expect(formatPlateLine(identity).rowTitle).toBe('Bonus Desibel Alçı Kaplı Kompozit Taşyünü Levha · 5 cm')
  })

  it('malzemesi bilinmeyen kayıtta tür "Levha" olur ve başlığa eklenmez', () => {
    const identity = resolvePlateIdentity({ brandName: 'Bonus', modelShortName: null, materialSlug: null, thicknessCm: null, packageM2: null })!
    expect(identity.kind).toBe('Levha')
    expect(formatPlateLine(identity).title).toBe('Bonus')
    expect(formatPlateLine(identity).rowTitle).toBe('Bonus')
  })
})

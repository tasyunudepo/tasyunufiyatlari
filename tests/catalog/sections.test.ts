import { describe, expect, it } from 'vitest'

import {
  TASYUNU_SECTIONS,
  formatThicknessSummary,
  getDensityBadge,
  resolveTasyunuSection,
} from '@/lib/catalog/sections'
import { getAllProfiles } from '@/lib/technical-profiles'

// Faz 1 (21 Temmuz kararı): taşyünü katalog listesi kullanım alanına
// göre bölümlenir. Eşleme profil kapsamından türetilir; profilsiz
// teklif-üzerine modeller elle eşlidir.

describe('taşyünü bölüm eşlemesi', () => {
  it.each([
    ['F 150', 'mantolama'],
    ['Premium F', 'mantolama'],
    ['HD150', 'mantolama'],
    ['SW035', 'mantolama'],
    ['Gold Plus 50', 'giydirme-cephe'],
    ['Gold Alu 50', 'giydirme-cephe'],
    ['Premium R', 'cati'],
    ['Premium R 150', 'cati'],
    ['Platin 110', 'kat-arasi-tesisat'],
    ['Private 70', 'kat-arasi-tesisat'],
    ['Endüstriyel Levha 70', 'endustriyel'],
    ['Endüstriyel Şilte 650', 'endustriyel'],
    ['Marin', 'gemi-marin'],
    ['Desibel', 'bolme-panel'],
    ['Kapı Paneli', 'bolme-panel'],
    ['Panel', 'bolme-panel'],
  ])('%s → %s', (model, expected) => {
    expect(resolveTasyunuSection(model)).toBe(expected)
  })

  it('profilsiz/bilinmeyen model mantolamaya düşer (mevcut çekirdek)', () => {
    expect(resolveTasyunuSection('Bilinmeyen Model')).toBe('mantolama')
    expect(resolveTasyunuSection(null)).toBe('mantolama')
  })

  it('havuzdaki her profil kapsamı tanımlı bir bölüme çözülür', () => {
    const keys = new Set(TASYUNU_SECTIONS.map((s) => s.key))
    for (const p of getAllProfiles()) {
      const section = resolveTasyunuSection(p.modelShortName)
      expect(keys.has(section), `${p.modelShortName} → ${section}`).toBe(true)
    }
  })
})

describe('kart rozetleri', () => {
  it('aile kartında varyant yoğunlukları birleşir', () => {
    expect(getDensityBadge('Gold Plus 50')).toBe('50/70/90 kg/m³')
    expect(getDensityBadge('Endüstriyel Şilte 650')).toBe('80/90/100/125 kg/m³')
  })

  it('tekil üründe föy beyanı metni aynen kullanılır', () => {
    expect(getDensityBadge('F 150')).toBe('150 kg/m³ (±%10)')
    expect(getDensityBadge('HD150')).toBe('≥150 kg/m³')
  })

  it('beyansız üründe rozet çıkmaz (Premium F kuralı — değer uydurulmaz)', () => {
    expect(getDensityBadge('Premium F')).toBeNull()
    expect(getDensityBadge('Premium R')).toBeNull()
  })

  it('kalınlık özeti TR biçiminde tek satırdır', () => {
    expect(formatThicknessSummary([3, 4, 5, 6, 7, 8, 10, 12, 15, 20])).toBe('3–20 cm · 10 kalınlık')
    expect(formatThicknessSummary([2.5, 3, 4, 5])).toBe('2,5–5 cm · 4 kalınlık')
    expect(formatThicknessSummary([5])).toBe('5 cm')
    expect(formatThicknessSummary(null)).toBeNull()
    expect(formatThicknessSummary([])).toBeNull()
  })
})

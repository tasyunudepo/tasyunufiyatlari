import { describe, it, expect } from 'vitest'

import { normalizeTr, searchCatalogItems } from '@/lib/quote/searchCatalog'
import type { CatalogItem } from '@/app/api/admin/catalog-items/route'

function urun(
  key: string,
  label: string,
  brandName: string,
  kind: 'levha' | 'aksesuar' = 'aksesuar',
  isActive = true,
  fullName = label,
): CatalogItem {
  return {
    key,
    kind,
    id: 1,
    thicknessCm: null,
    label,
    fullName,
    brandName,
    unit: 'PKT',
    unitContent: 25,
    packageM2: null,
    truckM2: null,
    lorryM2: null,
    netCost: 100,
    suggestedUnitPrice: 105,
    marginPct: 5,
    marginSource: 'malzeme',
    materialSlug: null,
    isActive,
  }
}

const KATALOG: CatalogItem[] = [
  urun('l1', 'Bonus F 150 Pro 4 cm', 'Bonus', 'levha'),
  urun('l2', 'Dalmaçyalı Taşyünü 5 cm', 'Dalmaçyalı', 'levha'),
  // Katalog etiketi marka + KISA AD'dır ("TEKNO Yapıştırıcı"); operatörün
  // ve belgenin bildiği ad ticari addır ("TEKNOİZOFİX"). İkisi de bulmalı.
  urun('a1', 'TEKNO Yapıştırıcı', 'TEKNO', 'aksesuar', true, 'TEKNOİZOFİX'),
  urun('a2', 'TEKNO Sıva', 'TEKNO', 'aksesuar', true, 'TEKNOİZOSIVA'),
  urun('a3', 'CHELFIX ISI YALITIM LEVHA SIVASI', 'TEKNO'),
  urun('a4', 'Çelik Çivili Dübel 115 mm (11,5 cm)', 'TEKNO'),
  urun('a5', 'FİLE 4X4 - 160 GR', 'TEKNO'),
  urun('pasif', 'TEKNOLATEX ESKİ', 'TEKNO', 'aksesuar', false),
]

describe('normalizeTr', () => {
  it('noktasız I ile noktalı İ eşitlenir — klavye farkı aramayı bozmaz', () => {
    expect(normalizeTr('TEKNOIZOFIX')).toBe(normalizeTr('TEKNOİZOFİX'))
  })

  it('aksanlar sadeleşir', () => {
    expect(normalizeTr('Dalmaçyalı')).toBe('dalmacyali')
    expect(normalizeTr('Çelik Çivili Dübel')).toBe('celik civili dubel')
  })
})

describe('satır içi ürün arama', () => {
  it('iki harften kısa sorguda öneri vermez — her tuşta liste açılmaz', () => {
    expect(searchCatalogItems(KATALOG, 't')).toEqual([])
    expect(searchCatalogItems(KATALOG, '')).toEqual([])
  })

  it('TİCARİ adla arar — katalog etiketi kısa ad taşısa bile bulur', () => {
    // Katalogda "TEKNO Yapıştırıcı" yazar; operatör "TEKNOİZOFİX" bilir ve
    // teklifte/PDF'te o görünür. Yalnız etikete bakılsa hiç bulunamazdı.
    expect(searchCatalogItems(KATALOG, 'teknoizofix').map((s) => s.label)).toContain(
      'TEKNO Yapıştırıcı',
    )
    expect(searchCatalogItems(KATALOG, 'teknoizosiva').map((s) => s.label)).toContain(
      'TEKNO Sıva',
    )
  })

  it('kısa adla da bulur — iki isimlendirme de çalışır', () => {
    expect(searchCatalogItems(KATALOG, 'tekno yapistirici').map((s) => s.label)).toContain(
      'TEKNO Yapıştırıcı',
    )
  })

  it('boşluktan bağımsız eşleşir', () => {
    expect(searchCatalogItems(KATALOG, 'teknosiva').map((s) => s.label)).toContain(
      'TEKNO Sıva',
    )
  })

  it('aksansız yazımla aksanlı ürünü bulur', () => {
    const sonuc = searchCatalogItems(KATALOG, 'celik civili')
    expect(sonuc.map((s) => s.label)).toContain('Çelik Çivili Dübel 115 mm (11,5 cm)')
  })

  it('sorgudaki HER kelime geçmeli', () => {
    expect(searchCatalogItems(KATALOG, 'bonus 150').map((s) => s.key)).toEqual(['l1'])
    expect(searchCatalogItems(KATALOG, 'bonus dalmacyali')).toEqual([])
  })

  it('marka adıyla da bulur', () => {
    const sonuc = searchCatalogItems(KATALOG, 'tekno')
    expect(sonuc.length).toBeGreaterThan(1)
  })

  it('baştan eşleşen önce gelir', () => {
    const sonuc = searchCatalogItems(KATALOG, 'file')
    expect(sonuc[0].label).toBe('FİLE 4X4 - 160 GR')
  })

  it('levha aksesuardan önce sıralanır', () => {
    const sonuc = searchCatalogItems(KATALOG, 'cm')
    expect(sonuc[0].kind).toBe('levha')
  })

  it('pasif ürün önerilmez', () => {
    const sonuc = searchCatalogItems(KATALOG, 'teknolatex')
    expect(sonuc).toEqual([])
  })

  it('sonuç sayısı sınırlanır', () => {
    expect(searchCatalogItems(KATALOG, 'tekno', 2)).toHaveLength(2)
  })
})

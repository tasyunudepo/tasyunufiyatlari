import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isSellableFamilyVariant } from '@/lib/pricing/bonus/families'

// Emrah, 26 Ekim 2026: ürün sayfası Gold Plus'ı 50/70/90 kg/m³ seçiciyle
// satıyor; ofiste "Gold Plus 70" aranınca sonuç yok, 1.200 m² özel teklif
// yazılamıyor. Kök neden: aile varyantları ayrı ürün sayfası açmasın diye
// veritabanında pasif (20 Temmuz kararı); ofis kataloğu pasifleri yanıttan
// atıyordu (catalog-items: items.filter(i => i.isActive)).

// Canlıdaki aktif Bonus levhaları (aile başları).
const AKTIF = new Set([
  'Gold Plus 50',
  'Gold Black 50',
  'Gold Yellow 50',
  'Gold Alu 50',
  'Endüstriyel Levha 70',
  'Endüstriyel Şilte 650',
  'F 150',
])

describe('ofis kataloğunda Bonus aile varyantları', () => {
  it.each(['Gold Plus 70', 'Gold Plus 90', 'Gold Black 70', 'Gold Black 90', 'Gold Yellow 70', 'Endüstriyel Levha 110', 'Endüstriyel Şilte 700', 'Endüstriyel Şilte 750'])(
    '%s ailesinin ürün sayfası aktif olduğu için satılabilir',
    (model) => {
      expect(isSellableFamilyVariant(model, AKTIF)).toBe(true)
    },
  )

  it('ailesiz pasif ürün satılabilir sayılmaz', () => {
    expect(isSellableFamilyVariant('Yangın Bariyeri', AKTIF)).toBe(false)
    expect(isSellableFamilyVariant('Desibel', AKTIF)).toBe(false)
  })

  it('ailenin hiçbir üyesi aktif değilse varyant da satılmaz', () => {
    expect(isSellableFamilyVariant('Gold Plus 70', new Set(['F 150']))).toBe(false)
  })

  it('katalog API\'si Bonus varyantının aktifliğini aileden çözer', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/admin/catalog-items/route.ts'), 'utf8')
    expect(source).toContain('isSellableFamilyVariant(plate.short_name ?? \'\', activeBonusModels)')
  })
})

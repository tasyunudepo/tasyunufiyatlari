import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildPortfolioPdfItems, toPdfRect } from '@/lib/pdf/portfolioSection'

describe('teklif PDF\'inde alçı ve alçıpan bölümü', () => {
  const items = buildPortfolioPdfItems()

  it('AC-206: iki kanal fiyat, koşul ve yazılı adresle basılır', () => {
    expect(items.map((item) => item.title)).toEqual(['Makine alçısı', 'Alçıpan'])
    expect(items[0].priceLine).toBe('1 TIR 129.366 ₺ · 750 torba · torbası 172,49 ₺')
    expect(items[1].priceLine).toContain('₺/m²')
    for (const item of items) {
      expect(item.terms).toMatch(/KDV (dâhil|hariç)/u)
      expect(item.terms).toContain('Liste tarihi')
    }
    expect(items[0].linkLabel).toBe('alcifiyatlari.com/urun-kategori/makina-alcisi')
    expect(items[1].linkLabel).toBe('alcipanfiyatlari.net/urunler/alcipan-fiyatlari')
  })

  it('AC-205: PDF bağlantıları kaynağı PDF olarak etiketler', () => {
    for (const item of items) {
      const href = new URL(item.href)
      expect(href.searchParams.get('utm_source')).toBe('tasyunufiyatlari.com')
      expect(href.searchParams.get('utm_content')).toBe('pdf')
    }
  })

  it('AC-206: piksel kutusu milimetreye kabın köşesine göre çevrilir', () => {
    // Kap ekranın solunda (-10000 px) çizilir; A4 genişliği 794 px = 210 mm.
    const mmPerPx = 210 / 794
    const rect = toPdfRect(
      { left: -10000 + 40, top: 900, width: 300, height: 30 },
      { left: -10000, top: 0 },
      mmPerPx,
    )
    expect(rect.x).toBeCloseTo(40 * mmPerPx, 6)
    expect(rect.y).toBeCloseTo(900 * mmPerPx, 6)
    expect(rect.w).toBeCloseTo(300 * mmPerPx, 6)
    expect(rect.h).toBeCloseTo(30 * mmPerPx, 6)
  })
})

describe('PDF şablonu bağlantıları tıklanır yapar', () => {
  const pdfSource = readFileSync(resolve(process.cwd(), 'lib/pdfGenerator.ts'), 'utf8')

  it('AC-206: bölüm şablonda yer alır ve bağlantı alanları işaretlenir', () => {
    expect(pdfSource).toContain('Alçı ve alçıpan da lazım mı?')
    expect(pdfSource).toContain('data-pdf-link="')
    expect(pdfSource).toMatch(/querySelectorAll<HTMLElement>\('\[data-pdf-link\]'\)/u)
    expect(pdfSource).toContain('doc.link(')
  })

  it('bölüm fiyat kutusunun ve kalem tablosunun dışındadır', () => {
    const section = pdfSource.indexOf('Alçı ve alçıpan da lazım mı?')
    expect(section).toBeGreaterThan(pdfSource.indexOf('ÖDENECEK GENEL TOPLAM'))
    expect(section).toBeLessThan(pdfSource.indexOf('Trust Badges: Tedarikçi Logoları'))
  })
})

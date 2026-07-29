import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import priceData from '@/lib/pricing/bonus/bonus-region-prices.json'
import { SPECIAL_CITY_SUB_REGIONS } from '@/lib/pricing/bonus/subRegions'

// Ticari sınır: bayi iskontosu ve taban fiyat müşteri yüzeyine (client
// bundle) inmez. Client bileşenleri yalnız subRegions modülünü kullanabilir;
// fiyat verisi (regionPricing / JSON / sale) sunucu tarafında kalır.

const ROOT = process.cwd()

function collectSources(dir: string, acc: Array<{ file: string; content: string }>) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSources(full, acc)
    } else if (/\.(tsx|ts)$/.test(entry)) {
      acc.push({ file: full.slice(ROOT.length + 1), content: readFileSync(full, 'utf8') })
    }
  }
}

describe('Bonus fiyat verisi client bundle sızıntı koruması', () => {
  const sources: Array<{ file: string; content: string }> = []
  collectSources(resolve(ROOT, 'components'), sources)

  it.each([
    ['bonus/regionPricing', /pricing\/bonus\/regionPricing/u],
    ['bonus-region-prices.json', /bonus-region-prices\.json/u],
    ['bonus/sale', /pricing\/bonus\/sale/u],
  ])('components/** %s modülünü import edemez', (_label, pattern) => {
    const offenders = sources.filter(({ content }) => pattern.test(content)).map(({ file }) => file)
    expect(offenders).toEqual([])
  })

  // 27 Temmuz 2026: `computeBonusUnitSale` sonucuna `netCostPerM2` (net alış)
  // eklendi — /ofis panelinin kâr göstergesi Bonus levhasını da ölçebilsin
  // diye. Public rota o güne kadar `NextResponse.json(result)` ile nesnenin
  // TAMAMINI döndürüyordu; alan eklenir eklenmez maliyet müşterinin
  // tarayıcısına düşecekti. Rota açık beyaz listeye çevrildi.
  describe('public /api/bonus-price ucu net alış sızdırmaz', () => {
    const routeRaw = readFileSync(resolve(ROOT, 'app/api/bonus-price/route.ts'), 'utf8')
    // Yorumlar elenir: sınırın NEDEN var olduğunu anlatan açıklama satırları
    // alan adını geçirmek zorunda ve testi kendi belgesine takmamalı.
    const route = routeRaw.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '')

    it('sonuç nesnesi olduğu gibi yayılmaz', () => {
      expect(route).not.toMatch(/NextResponse\.json\(\s*result\s*\)/u)
      expect(route).not.toMatch(/\.\.\.result/u)
    })

    it('net alış alanı yanıtta geçmez', () => {
      expect(route).not.toMatch(/netCostPerM2/u)
    })

    it('müşterinin ihtiyacı olan alanlar hâlâ dönüyor', () => {
      for (const alan of ['salePricePerM2', 'packageM2', 'kamyonM2', 'tirM2']) {
        expect(route).toMatch(new RegExp(`${alan}:`, 'u'))
      }
    })
  })

  it('subRegions modülü iskonto/fiyat verisi içermez', () => {
    const content = readFileSync(resolve(ROOT, 'lib/pricing/bonus/subRegions.ts'), 'utf8')
    expect(content).not.toMatch(/discount|iskonto\s*[:=]|listPrice|basePrice|bonus-region-prices/iu)
  })

  it('subRegions ile JSON specialCities aynı haritayı taşır (tek doğruluk)', () => {
    const jsonSpecial = priceData.specialCities as Record<
      string,
      { question: string; options: Record<string, number> }
    >
    const tsCodes = Object.keys(SPECIAL_CITY_SUB_REGIONS).sort()
    expect(Object.keys(jsonSpecial).sort()).toEqual(tsCodes)
    for (const code of tsCodes) {
      const ts = SPECIAL_CITY_SUB_REGIONS[Number(code)]
      expect(jsonSpecial[code].question).toBe(ts.question)
      expect(jsonSpecial[code].options).toEqual(ts.options)
    }
  })
})

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { getComparisonProfiles } from '@/lib/technical-profiles'
import { density150HubCopy, hubFacts, thicknessHubCopy } from '@/lib/compare/hubCopy'
import { density150HubPath, isDensity150, thicknessHubPath } from '@/lib/compare/hubs'
import type { ComparisonSnapshot, VehiclePrices } from '@/lib/compare/vehiclePrices'

// Hub sayfaları (Emrah onayı, 14 Ekim 2026): başlık aramayla aynı başlar, yalnız kapsamdaki ürünler,
// rakamlar fiyat fotoğrafından; kâr/iskonto oranı ve alış fiyatı sayfaya girmez.

const price = (unit: number, m2: number): VehiclePrices => ({
  kamyon: { unit, m2, total: Math.round(unit * m2) },
  tir: { unit: unit - 20, m2: m2 * 2, total: Math.round((unit - 20) * m2 * 2) },
})

function snapshot(prices: Record<string, VehiclePrices | null>): ComparisonSnapshot {
  return { cityCode: 34, cityName: 'İstanbul', subChoice: 'avrupa', thicknessCm: 10, prices, slugs: { SW035: 'dalmacyali-sw035-tasyunu', HD150: 'expert-hd150-tasyunu' } }
}

describe('hub adresleri', () => {
  it('kalınlık ve 150 hub adresleri aramayla eşleşen yollardır', () => {
    expect(thicknessHubPath(10)).toBe('/tasyunu-fiyatlari/10-cm')
    expect(density150HubPath(5)).toBe('/tasyunu-yogunluk/150-kg-m3/5-cm')
    expect(density150HubPath()).toBe('/tasyunu-yogunluk/150-kg-m3')
  })

  it('150 hub kapsamı yalnız föy beyanlı üç 150\'lik', () => {
    expect(getComparisonProfiles().filter(isDensity150).map((p) => p.productKey).sort()).toEqual([
      'bonus-premium-f-150',
      'bonus-premium-f-150-pro',
      'expert-hd150',
    ])
  })
})

describe('hub metni', () => {
  const profiles = getComparisonProfiles()

  it('kalınlık hub başlığı "10 cm Taş Yünü Fiyatları" ile başlar; aralık ve en uygun fotoğraftan gelir', () => {
    const facts = hubFacts(
      snapshot({ 'dalmacyali-sw035': price(654.92, 403.2), 'expert-hd150': price(796.15, 403.2), 'bonus-premium-f-150': price(740.06, 483.84) }),
      profiles,
    )
    const copy = thicknessHubCopy(facts, 'Ekim 2026', 'İstanbul Avrupa Yakası')
    expect(copy.title).toBe('10 cm Taş Yünü Fiyatları - Ekim 2026 | 3 Levha Yan Yana')
    expect(copy.h1).toBe('10 cm taş yünü fiyatları')
    expect(copy.summary).toContain('654,92 ₺ ile 796,15 ₺ arasında')
    expect(copy.summary).toContain('m² fiyatı en düşük olan Dalmaçyalı Stonewool SW035')
    expect(facts.missing).toHaveLength(5)
    const lorry = copy.faq.find((f) => f.q.includes('1 kamyon kaç m²'))!
    expect(lorry.a).toContain('Bonus levhalarda 483,8 m²')
    expect(lorry.a).toContain('Dalmaçyalı ve Expert levhalarda 403,2 m²')
    expect(copy.faq.some((f) => f.a.includes('En az 1 tam kamyon'))).toBe(true)
  })

  it('150 hub başlığı aramayla başlar ve yoğunluk uyarısını taşır', () => {
    const all150 = profiles.filter(isDensity150)
    const facts = hubFacts(snapshot({ 'expert-hd150': price(796.15, 403.2), 'bonus-premium-f-150': price(740.06, 483.84) }), all150)
    const copy = density150HubCopy(facts, 'Ekim 2026', 'İstanbul Avrupa Yakası', all150)
    expect(copy.title).toBe('10 cm 150 Yoğunluk Taş Yünü m² Fiyatları - Ekim 2026')
    expect(copy.summary).toContain('daha iyi ısı yalıtımı iddiası değildir')
    expect(copy.faq[1].a).toContain('Bonus Premium F 150 Pro 10 cm\'de fiyat listesinde yok')
  })

  it('metinde kâr, iskonto oranı ya da yasak vaat geçmez', () => {
    const facts = hubFacts(snapshot({ 'dalmacyali-sw035': price(654.92, 403.2) }), profiles)
    const text = JSON.stringify(thicknessHubCopy(facts, 'Ekim 2026', 'İstanbul'))
    for (const forbidden of [/marj/i, /kâr/i, /iskonto/i, /ücretsiz nakliye/i, /garanti fiyat/i, /sabit fiyat/i, /kapora/i]) {
      expect(text).not.toMatch(forbidden)
    }
  })
})

describe('hub fiyat fotoğrafı sızıntı koruması', () => {
  it('fotoğraf modülü Bonus sonucunu yaymaz, alış fiyatı alanını kullanmaz', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/compare/snapshot.server.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '')
    expect(src).not.toMatch(/netCostPerM2/u)
    expect(src).not.toMatch(/\.\.\.sale/u)
  })

  it('components/** sunucu fotoğraf modüllerini içe aktarmaz', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(tsx|ts)$/.test(entry) && /compare\/(snapshot|hubPages)\.server/u.test(readFileSync(full, 'utf8'))) offenders.push(full)
      }
    }
    walk(resolve(process.cwd(), 'components'))
    expect(offenders).toEqual([])
  })
})

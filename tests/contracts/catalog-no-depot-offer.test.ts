import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { findOptimalCombination } from '@/components/catalog/SepetUI'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function source(path: string) {
  return readFileSync(`${repoRoot}${path}`, 'utf8')
}

const productPricePanel = source('components/catalog/ProductPricePanel.tsx')
const sepetUi = source('components/catalog/SepetUI.tsx')
const scenarioMessage = source('components/catalog/SepetScenarioMessage.tsx')
const tierSelector = source('components/catalog/TransportTierSelector.tsx')
const areaAssist = source('components/catalog/AreaThresholdAssist.tsx')

describe('katalog yalnız fabrika tam araç teklif sözleşmesi', () => {
  it('ürün fiyat panelinde depo fiyatı, stok kartı veya depo senaryosu üretmez', () => {
    expect(productPricePanel).not.toContain('StokAlternatifSection')
    expect(productPricePanel).not.toContain('depot_optimal')
    expect(productPricePanel).not.toContain('stokOnerisi')
    expect(productPricePanel).not.toContain('depotPrice')
    expect(productPricePanel).not.toContain('depotStock')
    expect(productPricePanel).not.toContain('stock_tuzla')
    expect(productPricePanel).not.toContain('depot_min_m2')
  })

  it('sepet ve senaryo bileşenlerinde depo/parsiyel teklif durumu bulunmaz', () => {
    expect(sepetUi).not.toContain('depot_optimal')
    expect(sepetUi).not.toContain('stokOnerisi')
    expect(sepetUi).not.toContain('depotStock')
    expect(sepetUi).not.toContain('depotPrice')
    expect(scenarioMessage).not.toMatch(/depo|stok/i)
    expect(areaAssist).not.toMatch(/parsiyel/i)
  })

  it('araç seçeneklerini yalnız Kamyon/TIR ile sınırlar', () => {
    expect(tierSelector).toContain('type TierId = "lorry" | "truck"')
    expect(tierSelector).not.toMatch(/depot|depo|stok/i)
    expect(productPricePanel).toContain(
      'const quoteVehicleType: "lorry" | "truck" | null',
    )
  })

  it('kamyon altı ihtiyacı ilk geçerli tam araç yüküne tamamlar', () => {
    expect(findOptimalCombination(120, 800, 1200, 100, 90)).toEqual({
      kamyon: 1,
      tir: 0,
      totalM2: 800,
      totalTL: 80_000,
    })
  })

  it('müşteriye fabrika ve tam araç şartını açıklar', () => {
    expect(productPricePanel).toContain(
      'Teklifler fabrikadan tam Kamyon veya tam TIR yüklemesiyle hazırlanır.',
    )
    expect(scenarioMessage).toContain(
      'Teklif için tam Kamyon veya tam TIR seçimi gerekir.',
    )
  })
})

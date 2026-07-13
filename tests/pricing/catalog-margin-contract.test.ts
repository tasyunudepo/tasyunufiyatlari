import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { computeM2Price } from '@/lib/catalog/pricing'
import type { CatalogProductView } from '@/lib/catalog/types'
import { resolveMarginPctStrict } from '@/lib/pricing/margin'

const product = {
  base_price: 100,
  thickness_prices: [
    {
      thickness: 5,
      base_price: 100,
      is_kdv_included: false,
      discount_2: 0,
      stock_tuzla: 0,
      package_m2: 1,
    },
  ],
} as CatalogProductView

const zone = {
  city_code: 34,
  discount_tir: 0,
}

const logisticsCapacity = [
  {
    thickness: 50,
    package_size_m2: 1,
  },
]

describe('katalog marj kontratı', () => {
  it('katalog fiyatını sabit %10 yerine açıkça verilen marjla hesaplar', () => {
    expect(
      computeM2Price({
        product,
        thickness: 5,
        zone,
        logisticsCapacity,
        marginPct: 5,
      }),
    ).toBe(105)
  })

  it('marj kuralı yoksa sessiz %10 varsayımına düşmez', () => {
    expect(resolveMarginPctStrict(null, 1_000)).toBeNull()
  })

  it('Wizard da eksik canlı marj kuralında sabit %10 varsayımına düşmez', () => {
    const wizardSource = readFileSync(
      fileURLToPath(
        new URL('../../components/wizard/WizardCalculator.tsx', import.meta.url),
      ),
      'utf8',
    )

    expect(wizardSource).toContain('resolveMarginPctStrict')
    expect(wizardSource).not.toMatch(/profitMarginPct:\s*number\s*=\s*10/)
    expect(wizardSource).toContain('Fiyat marjı tanımlı olmadığı için teklif oluşturulamıyor.')
  })
})

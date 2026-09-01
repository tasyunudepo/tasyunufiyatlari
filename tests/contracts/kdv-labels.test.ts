import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(file: string): string {
  return readFileSync(resolve(process.cwd(), file), 'utf8')
}

describe('Katalog fiyat yüzeylerinde KDV etiketi', () => {
  it('ürün kartının ortak fiyat bileşeni görünür fiyatı KDV hariç diye niteler', () => {
    const priceDisplay = source('components/catalog/PriceDisplay.tsx')
    const visiblePriceBranch = priceDisplay.slice(
      priceDisplay.indexOf('const isFromPrice'),
    )

    expect(visiblePriceBranch).toContain('KDV hariç')
  })

  it('mobil ürün özetinde birim fiyatın KDV durumu görünürdür', () => {
    const mobileHero = source('components/catalog/MobileProductHero.tsx')

    expect(mobileHero).toMatch(/₺\/m²[\s\S]{0,500}KDV hariç/)
  })

  it('ticari, masaüstü ve kompakt araç kartlarında fiyat KDV hariç diye nitelenir', () => {
    const vehicleCards = source('components/catalog/SepetVehicleCards.tsx')
    const priceCardSection = vehicleCards.slice(
      vehicleCards.indexOf('function AracKarti'),
      vehicleCards.indexOf('interface VehicleCardsProps'),
    )

    expect(priceCardSection.match(/KDV hariç/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  it('depo stok fiyatının yanında KDV etiketi vardır', () => {
    const depotSection = source('components/catalog/StokAlternatifSection.tsx')
    const depotPriceBlock = depotSection.slice(
      depotSection.indexOf('m² Fiyatı'),
      depotSection.indexOf('Min. Sipariş'),
    )

    expect(depotPriceBlock).toContain('KDV hariç')
  })

  it('sevkiyat baremi kartındaki fiyatın yanında KDV etiketi vardır', () => {
    const tierSelector = source('components/catalog/TransportTierSelector.tsx')
    const tierPriceBlock = tierSelector.slice(
      tierSelector.indexOf('Price block'),
      tierSelector.indexOf('tier.savings'),
    )

    expect(tierPriceBlock).toContain('KDV hariç')
  })

  it('barem ilerleme fiyatları KDV hariç diye nitelenir', () => {
    const thresholdAssist = source('components/catalog/AreaThresholdAssist.tsx')

    expect(thresholdAssist).toContain('KDV hariç')
  })

  it('ürün detay teklif özeti ile mobil sabit toplam KDV durumunu açıkça gösterir', () => {
    const pricePanel = source('components/catalog/ProductPricePanel.tsx')
    const quoteSummary = pricePanel.slice(
      pricePanel.indexOf('Teklif Özeti'),
      pricePanel.indexOf('SingleProductQuoteButton', pricePanel.indexOf('Teklif Özeti')),
    )
    const mobileSticky = pricePanel.slice(
      pricePanel.indexOf('fixed inset-x-3'),
      pricePanel.indexOf('SingleProductQuoteButton', pricePanel.indexOf('fixed inset-x-3')),
    )

    expect(quoteSummary).toContain('KDV hariç')
    expect(mobileSticky).toContain('KDV hariç')
  })

  it('Bonus Sipariş Masası fiyatı ve mobil WhatsApp özetini KDV hariç diye niteler', () => {
    const bonusPrice = source('components/catalog/BonusRegionPrice.tsx')
    const branchStart = bonusPrice.indexOf('if (variant === "purchase-desk")')
    const branchEnd = bonusPrice.indexOf(
      'className="rounded-xl border border-brand-500/25',
      branchStart,
    )
    const purchaseDesk = bonusPrice.slice(branchStart, branchEnd)

    expect(purchaseDesk).toContain('KDV hariç')
    expect(purchaseDesk).toContain('data-testid="pdp-mobile-order-sticky"')
    expect(purchaseDesk.match(/KDV hariç/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('Wizard mobil sabit kartında m² ve toplam fiyatın KDV niteliği görünürdür', () => {
    const wizard = source('components/wizard/WizardCalculator.tsx')
    const mobileSticky = wizard.slice(
      wizard.indexOf('fixed inset-x-0 bottom-0'),
      wizard.indexOf('{/* QUOTE MODAL */}'),
    )

    expect(mobileSticky.match(/KDV dahil/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})

import { expect, test, type Page } from '@playwright/test'

// Karar günlüğü Tur 4: Bonus bölge haritası gereği İstanbul'da yaka
// (Avrupa 3. Bölge / Anadolu 2. Bölge), Kocaeli'de Gebze (2. Bölge) /
// diğer ilçeler (1. Bölge) sorusu sorulur; başka ilde soru görünmez.

async function openHomepageCalculator(page: Page) {
  await page.goto('/')
  const calculator = page.locator('[data-homepage-calculator]')
  const product = calculator.getByRole('combobox', { name: 'Malzeme' })

  await expect(product).toBeEnabled({ timeout: 20_000 })
  await product.selectOption({ label: 'Bonus F 150 Pro' })
  await expect(calculator).toHaveAttribute('data-selected-material', 'tasyunu')

  return calculator
}

test.describe('şehir alt-bölge sorusu', () => {
  test('İstanbul seçilince yaka sorusu belirir ve seçilebilir', async ({ page }) => {
    const calculator = await openHomepageCalculator(page)
    const city = calculator.getByRole('combobox', { name: 'Teslim ili' })

    // Ana sayfa İstanbul'u varsayılan seçebilir; değişim olayını deterministik
    // üretmek için önce başka ile, sonra yeniden İstanbul'a geçilir.
    await city.selectOption({ label: 'Ankara' })
    await city.selectOption({ label: 'İstanbul' })
    await expect(calculator.getByText('Teslimat yakası')).toBeVisible()

    const avrupa = calculator.getByRole('button', { name: 'Avrupa Yakası' })
    const anadolu = calculator.getByRole('button', { name: 'Anadolu Yakası' })
    await expect(avrupa).toBeVisible()
    await expect(anadolu).toBeVisible()

    await anadolu.click()
    await expect(anadolu).toHaveClass(/bg-\[#f4ead0\]/)
    await expect(avrupa).not.toHaveClass(/bg-\[#f4ead0\]/)
  })

  test('Kocaeli seçilince Gebze sorusu belirir', async ({ page }) => {
    const calculator = await openHomepageCalculator(page)

    await calculator.getByRole('combobox', { name: 'Teslim ili' }).selectOption({ label: 'Kocaeli' })
    await expect(calculator.getByText('Teslimat bölgesi')).toBeVisible()
    await expect(calculator.getByRole('button', { name: 'Gebze' })).toBeVisible()
    await expect(calculator.getByRole('button', { name: 'Diğer ilçeler' })).toBeVisible()
  })

  test('başka ilde alt-bölge sorusu görünmez ve şehir değişince seçim sıfırlanır', async ({ page }) => {
    const calculator = await openHomepageCalculator(page)
    const city = calculator.getByRole('combobox', { name: 'Teslim ili' })

    await city.selectOption({ label: 'Ankara' })
    await expect(calculator.getByText('Teslimat yakası')).toHaveCount(0)
    await expect(calculator.getByText('Teslimat bölgesi')).toHaveCount(0)

    // İstanbul'a geç, yaka seç, sonra Ankara'ya dön ve tekrar İstanbul'a gel:
    // önceki yaka seçimi taşınmamalı.
    await city.selectOption({ label: 'İstanbul' })
    await calculator.getByRole('button', { name: 'Avrupa Yakası' }).click()
    await city.selectOption({ label: 'Ankara' })
    await city.selectOption({ label: 'İstanbul' })
    await expect(calculator.getByRole('button', { name: 'Avrupa Yakası' })).not.toHaveClass(/bg-\[#f4ead0\]/)
  })
})

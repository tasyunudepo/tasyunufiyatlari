import { expect, test, type Page } from '@playwright/test'

// Karar günlüğü Tur 4: Bonus bölge haritası gereği İstanbul'da yaka
// (Avrupa 3. Bölge / Anadolu 2. Bölge), Kocaeli'de Gebze (2. Bölge) /
// diğer ilçeler (1. Bölge) sorusu sorulur; başka ilde soru görünmez.

async function gotoLocationStep(page: Page) {
  await page.goto('/')
  const wizard = page.locator('#mantolama-hesaplayici')
  await wizard.getByRole('button', { name: 'Kalınlık Seçimine Geç' }).click()
  await expect(wizard.getByText('Yalıtım Kalınlığını Seçin')).toBeVisible()
  await wizard.getByRole('button', { name: 'Konum Seçimine Geç' }).click()
  await expect(wizard.getByText('Teslimat İli')).toBeVisible()
  return wizard
}

test.describe('şehir alt-bölge sorusu', () => {
  test('İstanbul seçilince yaka sorusu belirir ve seçilebilir', async ({ page }) => {
    const wizard = await gotoLocationStep(page)

    await wizard.locator('select').selectOption({ label: 'İstanbul' })
    await expect(wizard.getByText('Teslimat Yakası')).toBeVisible()

    const avrupa = wizard.getByRole('button', { name: 'Avrupa Yakası' })
    const anadolu = wizard.getByRole('button', { name: 'Anadolu Yakası' })
    await expect(avrupa).toBeVisible()
    await expect(anadolu).toBeVisible()

    await anadolu.click()
    await expect(anadolu).toHaveClass(/border-brand-500/)
    await expect(avrupa).not.toHaveClass(/border-brand-500/)
  })

  test('Kocaeli seçilince Gebze sorusu belirir', async ({ page }) => {
    const wizard = await gotoLocationStep(page)

    await wizard.locator('select').selectOption({ label: 'Kocaeli' })
    await expect(wizard.getByText('Kocaeli Teslimat Bölgesi')).toBeVisible()
    await expect(wizard.getByRole('button', { name: 'Gebze' })).toBeVisible()
    await expect(wizard.getByRole('button', { name: 'Diğer ilçeler' })).toBeVisible()
  })

  test('başka ilde alt-bölge sorusu görünmez ve şehir değişince seçim sıfırlanır', async ({ page }) => {
    const wizard = await gotoLocationStep(page)

    await wizard.locator('select').selectOption({ label: 'Ankara' })
    await expect(wizard.getByText('Teslimat Yakası')).toHaveCount(0)
    await expect(wizard.getByText('Kocaeli Teslimat Bölgesi')).toHaveCount(0)

    // İstanbul'a geç, yaka seç, sonra Ankara'ya dön ve tekrar İstanbul'a gel:
    // önceki yaka seçimi taşınmamalı.
    await wizard.locator('select').selectOption({ label: 'İstanbul' })
    await wizard.getByRole('button', { name: 'Avrupa Yakası' }).click()
    await wizard.locator('select').selectOption({ label: 'Ankara' })
    await wizard.locator('select').selectOption({ label: 'İstanbul' })
    await expect(wizard.getByRole('button', { name: 'Avrupa Yakası' })).not.toHaveClass(/border-brand-500/)
  })
})

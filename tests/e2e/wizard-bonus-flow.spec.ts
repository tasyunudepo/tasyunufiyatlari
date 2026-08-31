import { expect, test } from '@playwright/test'

// Bonus harman paket akışı (karar 13 revizyonu, 13 Temmuz 2026):
// Bonus levha + Expert/Optimix/TEKNO toz grubu üç sistem alternatifi üretir.

test.describe('Bonus harman paket teklifi', () => {
  test('Bonus akışı: kendi araç kapasitesi + 3 harman sistemi', async ({ page }) => {
    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    const productSelect = calculator.getByRole('combobox', { name: 'Malzeme' })
    await expect(productSelect).toBeEnabled({ timeout: 20_000 })

    await productSelect.selectOption({ label: 'Bonus F 150' })
    await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
    await calculator.getByRole('button', { name: 'Avrupa Yakası' }).click()

    const amountInput = calculator.getByRole('spinbutton', { name: 'Miktar' })
    await amountInput.fill('500')
    await expect(calculator.getByText(/tam araçla sevk edilir/)).toBeVisible()

    // F 150 / 5 cm kendi kapasitesini kullanır; genel 480/1200 kaydı değil.
    const lorrySuggestion = calculator.getByRole('button', { name: /1 Kamyon · 967,7/ })
    const tirSuggestion = calculator.getByRole('button', { name: /1 TIR · 1\.774,1/ })
    await expect(lorrySuggestion).toBeVisible({ timeout: 15_000 })
    await expect(tirSuggestion).toBeVisible()

    const calculateButton = calculator.getByRole('button', { name: 'Fiyatımı Hesapla' })
    await expect(calculateButton).toBeDisabled()
    await tirSuggestion.click()
    await expect(calculateButton).toBeEnabled()
    await calculateButton.click()

    const result = page.getByTestId('homepage-calculation-result')
    await expect(result).toBeVisible({ timeout: 20_000 })
    const tierSelector = result.getByTestId('homepage-tier-selector')
    await expect(tierSelector.getByRole('radio')).toHaveCount(3)
    await expect(tierSelector.locator('[data-tier-card]').filter({ hasText: 'Ekonomik' })).toContainText('TEKNO')
    await expect(tierSelector.locator('[data-tier-card]').filter({ hasText: 'Dengeli' })).toContainText('Optimix')
    await expect(tierSelector.locator('[data-tier-card]').filter({ hasText: 'Premium' })).toContainText('Expert')
    await expect(result).toContainText('Bonus F 150 5 cm Taşyünü')
    await expect(result).toContainText('Nakliye fiyata dahil')
    await expect(result).not.toContainText(/sevkiyat verisi henüz kesinleşmedi/)

    // Çifte marj kilidi: sunucu levha fiyatı, set hesabının kanonik girdisidir.
    const response = await page.request.get(
      '/api/bonus-price?model=F%20150&thicknessCm=5&cityCode=34&sub=avrupa',
    )
    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(json.salePricePerM2).toBe(370.03)
  })

  test('EPS seçeneklerine Bonus sızmaz ve ürün değişimi akışı tıkamaz', async ({ page }) => {
    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    const productSelect = calculator.getByRole('combobox', { name: 'Malzeme' })
    await expect(productSelect).toBeEnabled({ timeout: 20_000 })

    const epsOptions = await productSelect.locator('optgroup[label="EPS"] option').allTextContents()
    expect(epsOptions.length).toBeGreaterThan(0)
    expect(epsOptions.some(option => option.includes('Bonus'))).toBe(false)
    expect(epsOptions).toContain('Dalmaçyalı İdeal Carbon')

    await productSelect.selectOption({ label: 'Bonus F 150' })
    await expect(productSelect.locator('option:checked')).toHaveText('Bonus F 150')
    await productSelect.selectOption({ label: 'Dalmaçyalı İdeal Carbon' })
    await expect(productSelect.locator('option:checked')).toHaveText('Dalmaçyalı İdeal Carbon')
    await expect(calculator.getByRole('combobox', { name: 'Kalınlık' })).toBeEnabled()
  })
})

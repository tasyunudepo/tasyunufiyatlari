import { expect, test } from '@playwright/test'

// Ana sayfa 5c7eed0 ile çok adımlı wizard yerine kompakt ürün seçicisine
// geçti. Bu sözleşme Bonus alternatifini, PDP aktarımını ve karşılaştırma
// keşfini güncel kullanıcı yüzeyinden doğrular.

test.describe('Bonus ve karşılaştırma yüzeyleri', () => {
  test('ana sayfa ürün seçicisi Bonus ve Filli grubu alternatiflerini sunar', async ({ page }) => {
    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    const productSelect = calculator.getByRole('combobox', { name: 'Malzeme' })

    await expect(productSelect).toBeEnabled({ timeout: 20_000 })
    const options = await productSelect.locator('option').allTextContents()
    expect(options).toContain('Bonus F 150')
    expect(options).toContain('Bonus F 150 Pro')
    expect(options).toContain('Expert HD150')
    await expect(page.getByText(/daha ucuz/i)).toHaveCount(0)
  })

  test('Bonus hesabı İstanbul için yaka seçimi ve üç sistem sonucu ister', async ({ page }) => {
    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')

    await calculator.getByRole('combobox', { name: 'Malzeme' }).selectOption({ label: 'Bonus F 150' })
    await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
    const amountInput = calculator.getByRole('spinbutton', { name: 'Miktar' })
    await amountInput.fill('500')

    const calculateButton = calculator.getByRole('button', { name: 'Fiyatımı Hesapla' })
    await expect(calculateButton).toBeDisabled()
    await calculator.getByRole('button', { name: 'Avrupa Yakası' }).click()
    await calculator.getByRole('button', { name: /1 Kamyon ·/ }).click()
    await expect(calculateButton).toBeEnabled()
    await calculateButton.click()

    const result = page.getByTestId('homepage-calculation-result')
    await expect(result).toBeVisible({ timeout: 20_000 })
    const tierSelector = result.getByTestId('homepage-tier-selector')
    await expect(tierSelector.getByRole('radio')).toHaveCount(3)
    await expect(tierSelector).toContainText('Ekonomik')
    await expect(tierSelector).toContainText('Dengeli')
    await expect(tierSelector).toContainText('Premium')
  })

  test('Filli PDP Bonus alternatifini aynı koşulda gösterir ve hesaba taşır', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/expert-hd150-tasyunu')
    if (response?.status() === 404) {
      test.skip(true, 'Expert HD150 PDP yok.')
      return
    }
    await page.getByText('Bonus komple sistem alternatifini karşılaştır').click()
    const card = page.getByTestId('bonus-alternative-card')
    await expect(card).toBeVisible({ timeout: 20_000 })
    await expect(card.getByText('Bonus F 150').first()).toBeVisible({ timeout: 15_000 })
    await expect(card.getByText(/₺\/m²/).first()).toBeVisible()
    await expect(card.getByText(/tam araç levha fiyatı/)).toBeVisible()

    await card.getByRole('button', { name: /komple set hesapla/ }).click()
    await page.waitForURL(/#mantolama-hesaplayici/)
    const selectedProduct = page
      .locator('[data-homepage-calculator]')
      .getByRole('combobox', { name: 'Malzeme' })
      .locator('option:checked')
    await expect(selectedProduct).toHaveText('Bonus F 150', { timeout: 20_000 })
  })

  test('hesaplayıcı karşılaştırma merkezine wizard kaynağıyla geçer', async ({ page }) => {
    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    await calculator.getByRole('link', { name: /Levhaları karşılaştır/ }).click()

    await expect(page).toHaveURL(/\/tasyunu-karsilastir\?entry=wizard/)
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Taşyünü levhaları aynı koşulda karşılaştırın',
    })).toBeVisible()
  })
})

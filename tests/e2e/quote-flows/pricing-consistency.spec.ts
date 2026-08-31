import { expect, test } from '@playwright/test'

function parseTl(text: string): number {
  const normalized = text.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')
  const value = Number(normalized)
  if (!Number.isFinite(value)) throw new Error(`Sayı ayrıştırılamadı: "${text}"`)
  return value
}

test('3 sistemde kart fiyatı, KDV hariç, KDV ve toplam aynı fiyat tabanını kullanır', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const calculator = page.locator('[data-homepage-calculator]')
  const materialSelect = calculator.getByRole('combobox', { name: 'Malzeme' })
  await expect(materialSelect).toBeEnabled({ timeout: 30_000 })
  await materialSelect.selectOption('tasyunu|1|SW035')
  await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
  await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill('1497.6')
  await calculator.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()

  const result = page.getByTestId('homepage-calculation-result')
  await expect(result).toBeVisible({ timeout: 20_000 })
  const tierSelector = result.getByTestId('homepage-tier-selector')
  await expect(tierSelector).toHaveAttribute('data-tier-count', '3')

  for (const tierName of ['Ekonomik', 'Dengeli', 'Orijinal']) {
    const radio = tierSelector.getByRole('radio', { name: new RegExp(tierName) })
    await radio.check()
    await expect(radio).toBeChecked()

    const cardTotal = parseTl(
      await radio.locator('..').locator('[data-tier-price]').innerText(),
    )
    const subtotal = parseTl(await result.getByTestId('homepage-result-subtotal').innerText())
    const vat = parseTl(await result.getByTestId('homepage-result-vat').innerText())
    const total = parseTl(await result.getByTestId('homepage-result-total').innerText())

    expect(subtotal).toBeGreaterThan(0)
    expect(Math.abs(vat - subtotal * 0.2)).toBeLessThanOrEqual(1)
    expect(Math.abs(total - (subtotal + vat))).toBeLessThanOrEqual(1)
    expect(Math.abs(cardTotal - total)).toBeLessThanOrEqual(1)
  }

  await expect(result).toContainText('Nakliye fiyata dahil')
})

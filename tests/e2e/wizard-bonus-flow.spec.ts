import { expect, test } from '@playwright/test'

// Bonus levha teklifi akışı. Bonus markası canlı DB'de aktif değilse
// (migration + aktivasyon henüz uygulanmadıysa) testler atlanır;
// aktivasyondan sonra bu spec zorunlu regresyondur.

test.describe('Bonus levha teklifi', () => {
  test('Bonus seçilir, İstanbul yakası zorunludur ve levha fiyat kartı gelir', async ({ page }) => {
    await page.goto('/')
    const wizard = page.locator('#mantolama-hesaplayici')

    const bonusButton = wizard.locator('button').filter({ hasText: 'Bonus' }).first()
    if ((await bonusButton.count()) === 0) {
      test.skip(true, 'Bonus markası canlıda aktif değil (migration/aktivasyon bekliyor).')
      return
    }

    await bonusButton.click()
    await expect(wizard.getByRole('button', { name: /F 150/ }).first()).toBeVisible()
    await wizard.getByRole('button', { name: 'F 150', exact: true }).click()

    await wizard.getByRole('button', { name: 'Kalınlık Seçimine Geç' }).click()
    await wizard.getByRole('button', { name: '5cm' }).click()
    await wizard.getByRole('button', { name: 'Konum Seçimine Geç' }).click()
    await wizard.locator('select').selectOption({ label: 'İstanbul' })
    await wizard.getByRole('button', { name: 'Avrupa Yakası' }).click()
    await wizard.getByRole('button', { name: 'Metraj Gir' }).click()

    // F 150 / 50 mm tam TIR yükü — üretici listesindeki birebir değer.
    await wizard.locator('input[type="number"]').fill('1774.1')
    await wizard.getByRole('button', { name: /Teklif|Fiyat/ }).last().click()

    const resultCard = page.getByText('levha teklifi').first()
    await expect(resultCard).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('KDV hariç').first()).toBeVisible()
    await expect(page.getByText(/TL\/m²/).first()).toBeVisible()
    await expect(page.getByText('komple').first()).toBeVisible()
  })
})

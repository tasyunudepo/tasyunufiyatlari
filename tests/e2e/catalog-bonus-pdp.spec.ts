import { expect, test } from '@playwright/test'

// Bonus PDP (Faz 1, migration v21): fiyatsız katalog sayfası + wizard
// prefill köprüsü. Prefill regresyonu: WizardLinkButton store'un ölü
// alanlarına yazıyordu, geç gelen fetch varsayılan markayı eziyordu —
// köprü artık situationPreset üzerinden akar.

test.describe('Bonus katalog PDP', () => {
  test('PDP içerik doğru, fiyat yok, hesaplayıcı köprüsü Bonus + F 150 açar', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/bonus-f-150-tasyunu')
    if (response?.status() === 404) {
      test.skip(true, 'Bonus PDP kayıtları (v21) bu ortamda uygulanmamış.')
      return
    }

    await expect(page.getByRole('heading', { name: /Bonus Premium F 150/ }).first()).toBeVisible()
    // Faz 1 fiyatsız: teklif notu görünür, föy kaynaklı yoğunluk metni var.
    await expect(page.getByText('Teklif ile belirlenir').first()).toBeVisible()
    await expect(page.getByText(/150 kg\/m³/).first()).toBeVisible()
    await expect(page.getByText(/föyü beyanına göre/).first()).toBeVisible()

    // Kalınlık çipleri üretici listesiyle hizalı (15 cm var, 14 cm yok).
    expect(await page.getByText('15 cm', { exact: true }).count()).toBeGreaterThan(0)
    await expect(page.getByText('14 cm', { exact: true })).toHaveCount(0)

    // Faz 2 — canlı bölge fiyatı: İstanbul varsayılanında yaka sorusu,
    // seçim sonrası sunucudan gelen satış fiyatı (5 cm golden: 370,03).
    const priceBox = page.getByTestId('bonus-region-price')
    await expect(priceBox).toBeVisible()
    await expect(priceBox.getByText(/teslimat yakasını seçin/)).toBeVisible()
    await priceBox.getByRole('button', { name: 'Avrupa Yakası' }).click()
    await expect(priceBox.getByText('370,03')).toBeVisible({ timeout: 15_000 })
    await expect(priceBox.getByText('KDV hariç', { exact: false })).toBeVisible()

    // Bonus'ta doğrulanmamış "%10-15" iddiası görünmez.
    await expect(page.getByText('%10-15')).toHaveCount(0)

    // Wizard prefill köprüsü: hesap makinesi Bonus + F 150 ile açılır.
    await page.getByRole('button', { name: /Takım Fiyatını Gör/ }).first().click()
    await page.waitForURL(/\/$/)
    const wizard = page.locator('#mantolama-hesaplayici')
    await expect(wizard.getByRole('button', { name: 'F 150', exact: true })).toBeVisible({ timeout: 20_000 })
    // Model listesi Bonus'a özel — üç Bonus modeli görünür (marka seçiminin kanıtı).
    await expect(wizard.getByRole('button', { name: 'F 150 Pro' })).toBeVisible()
    await expect(wizard.getByRole('button', { name: 'F 120' })).toBeVisible()
  })
})

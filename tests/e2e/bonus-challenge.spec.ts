import { expect, test } from '@playwright/test'

// Sprint 1 — Bonus Meydan Okuma yüzeyleri.
// Hakem kuralları: fark yalnız aynı koşulda ve gerçek hesaptan; sabit
// "daha ucuz" iddiası hiçbir yüzeyde yok.

test.describe('Bonus meydan okuma yüzeyleri', () => {
  test('wizard: Filli sonucunun altında kart çıkar, Bonus ile hesaplar', async ({ page }) => {
    await page.goto('/')
    const wizard = page.locator('#mantolama-hesaplayici')
    await expect(
      wizard.locator('button').filter({ hasText: 'Dalmaçyalı' }).first(),
    ).toBeVisible({ timeout: 20_000 })
    if ((await wizard.locator('button').filter({ hasText: 'Bonus' }).count()) === 0) {
      test.skip(true, 'Bonus aktif değil.')
      return
    }

    await wizard.locator('button').filter({ hasText: 'Dalmaçyalı' }).first().click()
    await wizard.getByRole('button', { name: 'Kalınlık Seçimine Geç' }).click()
    await wizard.getByRole('button', { name: '5cm' }).click()
    await wizard.getByRole('button', { name: 'Konum Seçimine Geç' }).click()
    await wizard.locator('select').selectOption({ label: 'Ankara' })
    await wizard.getByRole('button', { name: 'Metraj Gir' }).click()
    await page.waitForTimeout(1200)
    await wizard.getByRole('button', { name: '3 Teklifi Karşılaştır' }).click()
    await expect(page.getByText('Dengeli Sistem').first()).toBeVisible({ timeout: 20_000 })

    const card = page.getByTestId('bonus-challenge-card')
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card.getByText(/daha düşük/)).toBeVisible()
    await expect(card.getByText(/Aynı şehir: Ankara/)).toBeVisible()
    await expect(card.getByText(/fark gerçek hesap sonucudur/)).toBeVisible()

    await card.getByRole('button', { name: /ile hesapla/ }).click()
    // Bonus harman sonuçları yüklenir (Premium Sistem yalnız Bonus akışında).
    await expect(page.getByText('Premium Sistem').first()).toBeVisible({ timeout: 20_000 })
  })

  test('wizard İstanbul: kart önce yaka sorar, seçim sonrası fark gösterir', async ({ page }) => {
    await page.goto('/')
    const wizard = page.locator('#mantolama-hesaplayici')
    await expect(
      wizard.locator('button').filter({ hasText: 'Dalmaçyalı' }).first(),
    ).toBeVisible({ timeout: 20_000 })
    if ((await wizard.locator('button').filter({ hasText: 'Bonus' }).count()) === 0) {
      test.skip(true, 'Bonus aktif değil.')
      return
    }

    await wizard.locator('button').filter({ hasText: 'Dalmaçyalı' }).first().click()
    await wizard.getByRole('button', { name: 'Kalınlık Seçimine Geç' }).click()
    await wizard.getByRole('button', { name: '5cm' }).click()
    await wizard.getByRole('button', { name: 'Konum Seçimine Geç' }).click()
    await wizard.locator('select').selectOption({ label: 'İstanbul' })
    await wizard.getByRole('button', { name: 'Metraj Gir' }).click()
    await page.waitForTimeout(1200)
    await wizard.getByRole('button', { name: '3 Teklifi Karşılaştır' }).click()
    await expect(page.getByText('Dengeli Sistem').first()).toBeVisible({ timeout: 20_000 })

    const card = page.getByTestId('bonus-challenge-card')
    await expect(card).toBeVisible({ timeout: 15_000 })
    // Fail-closed: yaka seçilmeden fark gösterilmez.
    await expect(card.getByText(/yakanızı seçin/)).toBeVisible()
    await expect(card.getByText(/daha düşük/)).toHaveCount(0)
    await card.getByRole('button', { name: 'Avrupa Yakası' }).click()
    await expect(card.getByText(/daha düşük/)).toBeVisible({ timeout: 15_000 })
  })

  test('Filli PDP: Bonus alternatif kartı iki fiyatı aynı koşulda gösterir', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/expert-hd150-tasyunu')
    if (response?.status() === 404) {
      test.skip(true, 'Expert HD150 PDP yok.')
      return
    }
    const card = page.getByTestId('bonus-alternative-card')
    await expect(card).toBeVisible({ timeout: 20_000 })
    await expect(card.getByText('Bonus F 150').first()).toBeVisible({ timeout: 15_000 })
    await expect(card.getByText(/₺\/m²/).first()).toBeVisible()
    await expect(card.getByText(/tam araç levha fiyatı/)).toBeVisible()

    await card.getByRole('button', { name: /komple set hesapla/ }).click()
    await page.waitForURL(/#mantolama-hesaplayici/)
    const wizard = page.locator('#mantolama-hesaplayici')
    await expect(wizard.getByRole('button', { name: 'F 150', exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test('ana sayfa bandı hesaplayıcıyı Bonus seçili açar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Filli grubu fiyatına mı bakıyorsunuz?')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Bonus fiyatını gör/ }).click()
    const wizard = page.locator('#mantolama-hesaplayici')
    await expect(wizard.getByRole('button', { name: 'F 150', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(wizard.getByRole('button', { name: 'F 120' })).toBeVisible()
  })
})

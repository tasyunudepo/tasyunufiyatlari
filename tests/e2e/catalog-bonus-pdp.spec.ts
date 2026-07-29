import { expect, test } from '@playwright/test'

// Bonus PDP (Faz 1, migration v21): fiyatsız katalog sayfası + wizard
// prefill köprüsü. Prefill regresyonu: WizardLinkButton store'un ölü
// alanlarına yazıyordu, geç gelen fetch varsayılan markayı eziyordu —
// köprü artık situationPreset üzerinden akar.

test.describe('Bonus katalog PDP', () => {
  test('PDP içerik doğru, bölge fiyatı görünür, hesaplayıcı köprüsü Bonus + F 150 açar', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/bonus-f-150-tasyunu')
    if (response?.status() === 404) {
      test.skip(true, 'Bonus PDP kayıtları (v21) bu ortamda uygulanmamış.')
      return
    }

    await expect(page.getByRole('heading', { name: /Bonus Premium F 150/ }).first()).toBeVisible()
    // Faz 1'de bu sayfa fiyatsızdı ve "Teklif ile belirlenir" yazıyordu.
    // Commit 277a876 ("20 fiyatlı ürün") Bonus PDP'lerini fiyatlı hâle
    // getirdi ama bu satır silinmemişti; test kendi içinde çelişiyordu
    // (aşağıda 370,03 bölge fiyatı bekleniyor). Faz 1 kalıntısı kaldırıldı.
    await expect(page.getByText('Teklif ile belirlenir')).toHaveCount(0)
    await expect(page.getByText(/150 kg\/m³/).first()).toBeVisible()
    await expect(page.getByText(/föyü beyanına göre/).first()).toBeVisible()

    // Kalınlık çipleri üretici listesiyle hizalı (15 cm var, 14 cm yok).
    expect(await page.getByText('15 cm', { exact: true }).count()).toBeGreaterThan(0)
    await expect(page.getByText('14 cm', { exact: true })).toHaveCount(0)

    // Faz 2 — canlı bölge fiyatı: İstanbul'da Avrupa Yakası varsayılan
    // seçili gelir, fiyat beklemeden görünür (5 cm golden: 370,03).
    const priceBox = page.getByTestId('bonus-region-price')
    await expect(priceBox).toBeVisible()
    await expect(priceBox.getByText('370,03')).toBeVisible({ timeout: 15_000 })
    await expect(priceBox.getByText('KDV hariç', { exact: false }).first()).toBeVisible()
    // Yaka değişince fiyat bölgeye göre güncellenir (Anadolu → 2. bölge).
    await priceBox.getByRole('button', { name: 'Anadolu Yakası' }).click()
    await expect(priceBox.getByText('359,37')).toBeVisible({ timeout: 15_000 })

    // Bonus'ta doğrulanmamış "%10-15" iddiası görünmez.
    await expect(page.getByText('%10-15')).toHaveCount(0)

    // Fiyatlı Bonus PDP'sinde "Takım Fiyatını Gör" CTA'sı RENDER EDİLMEZ.
    //
    // Commit 7e27a73 ("mantolama dışı PDP'lerde takım CTA'sı kaldırıldı, PDF
    // teklif açıldı") bu bloğu kaldırdı ama hiçbir testi güncellemedi; bu
    // spec o tarihten beri CTA'yı tıklamaya çalışıp zaman aşımına uğruyordu.
    // Yeni sözleşme: bu sayfanın dönüşüm yolu PDF teklifidir.
    await expect(page.getByRole('button', { name: /Takım Fiyatını Gör/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /PDF teklifimi hazırla/ }).first()).toBeVisible()

    // Tam araç planı seçilebilir olmalı — ara metraja teklif üretilmez.
    await expect(page.getByRole('button', { name: /1 Kamyon/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /1 TIR/ }).first()).toBeVisible()
  })
})

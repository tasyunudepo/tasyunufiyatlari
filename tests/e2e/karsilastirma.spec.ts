import { expect, test } from '@playwright/test'

// Sprint 2 — Karşılaştırma Merkezi. Kilitli kararlar: 8 ürün, föy
// etiketleri, sözlü beyan etiketi, "Pro üstünlük değil", 150 sayfası
// ana tablonun filtreli görünümü, fiyatlar gerçek hesaptan.

test.describe('Karşılaştırma Merkezi', () => {
  test('genel sayfa: teknik tablo + aynı koşulda canlı fiyatlar', async ({ page }) => {
    await page.goto('/tasyunu-karsilastir')

    // Teknik tablo: 8 satır, kaynak etiketleri.
    await expect(page.getByRole('heading', { name: 'Teknik karşılaştırma' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(8)
    expect(await page.getByText('Föy beyanı').count()).toBeGreaterThanOrEqual(5)
    expect(await page.getByText('Üretici sözlü beyanı — değişken').count()).toBeGreaterThanOrEqual(3)

    // Ticari kıyas: İstanbul + Avrupa varsayılan, 5 cm → Bonus F 150 370,03.
    const pricing = page.getByTestId('comparison-pricing')
    await expect(pricing.getByText('370,03')).toBeVisible({ timeout: 20_000 })
    // Filli tarafı aynı formülle: HD150 PDP ile birebir aynı fiyat (parite).
    await expect(pricing.getByText('378,90')).toBeVisible({ timeout: 20_000 })
    await expect(pricing.getByText(/tam araç levha fiyatı · KDV hariç/)).toBeVisible()

    // Kalınlık değişince fiyatlar yeniden hesaplanır (5 cm fiyatı kaybolur).
    await pricing.getByRole('button', { name: '8 cm', exact: true }).click()
    await expect(pricing.getByText('370,03')).toHaveCount(0, { timeout: 20_000 })
  })

  test('150 sayfası: föy-150 ürünler önce, nötr yoğunluk uyarısı', async ({ page }) => {
    await page.goto('/tasyunu-yogunluk/150-kg-m3')
    await expect(page.getByText(/daha iyi ısı yalıtımı iddiası değildir/)).toBeVisible()
    const firstThree = await page.locator('tbody tr td:first-child').allTextContents()
    expect(firstThree[0]).toContain('Bonus Premium F 150')
    expect(firstThree[1]).toContain('F 150 Pro')
    expect(firstThree[2]).toContain('HD150')
  })

  test('PDP çapraz linki karşılaştırma merkezine gider', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/expert-hd150-tasyunu')
    if (response?.status() === 404) {
      test.skip(true, 'HD150 PDP yok.')
      return
    }
    await page.getByRole('link', { name: /aynı koşulda karşılaştır/ }).click()
    await page.waitForURL(/tasyunu-karsilastir/)
    await expect(page.getByRole('heading', { name: 'Teknik karşılaştırma' })).toBeVisible({ timeout: 20_000 })
  })
})

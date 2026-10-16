import { expect, test } from '@playwright/test'

// GCR işi #05e174 (16 Ekim 2026): SW035 10 cm sayfasından kategoriye "taşyünü levha" metniyle metin içi bağlantı.
// Yalnız bu sayfada (önce/sonra gözlem için tek değişiklik).

test('SW035 10 cm: "taşyünü levha" kategori sayfasına bağlanır', async ({ page }) => {
  await page.goto('/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu/10-cm')
  const link = page.getByTestId('pdp-category-link').getByRole('link', { name: 'taşyünü levha' })
  await expect(link).toHaveAttribute('href', '/urunler/tasyunu-levha')
})

test('SW035 8 cm ve başka ürünlerde metin içi kategori bağlantısı yok', async ({ page }) => {
  for (const path of ['/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu/8-cm', '/urunler/tasyunu-levha/expert-hd150-tasyunu']) {
    await page.goto(path)
    await expect(page.getByTestId('pdp-category-link'), path).toHaveCount(0)
  }
})

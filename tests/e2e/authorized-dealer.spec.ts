import { expect, test } from '@playwright/test'

// Yetkili bayilik beyanı (Emrah, 16 Ekim 2026): "Bonus yetkili bayisiyiz. Filli Boya yetkili bayisiyiz."
// Görünür yerler: ana sayfa ilk ekranı, Filli grubu ve Bonus ürün sayfalarının marka alanı, altbilgi, Hakkımızda.

test('ana sayfa ilk ekranı ve altbilgi bayiliği yazar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('home-authorized-dealer')).toHaveText('Bonus ve Filli Boya yetkili bayisi')
  await expect(page.getByTestId('home-authorized-dealer')).toBeInViewport()
  await expect(page.getByTestId('footer-authorized-dealer')).toHaveText('ÖzerGrup, Bonus ve Filli Boya yetkili bayisidir.')
})

test('Filli grubu ürün sayfası: Filli Boya ürün grubundadır + yetkili bayi', async ({ page }) => {
  await page.goto('/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu')
  const mark = page.getByTestId('pdp-filli-group-mark')
  await expect(mark).toContainText('Filli Boya ürün grubundadır')
  await expect(mark.getByTestId('pdp-authorized-dealer')).toHaveText('Yetkili bayisiyiz')
})

test('Bonus ürün sayfası: logo yanında yetkili bayi', async ({ page }) => {
  await page.goto('/urunler/tasyunu-levha/bonus-f-150-tasyunu')
  const identity = page.getByTestId('pdp-product-identity')
  await expect(identity.getByTestId('pdp-authorized-dealer')).toHaveText('Yetkili bayisiyiz')
  await expect(identity.getByTestId('pdp-authorized-dealer')).toBeInViewport()
})

test('Hakkımızda ilk ekranı bayiliği yazar', async ({ page }) => {
  await page.goto('/hakkimizda')
  await expect(page.getByTestId('about-authorized-dealer')).toContainText('Bonus ve Filli Boya yetkili bayisiyiz.')
})

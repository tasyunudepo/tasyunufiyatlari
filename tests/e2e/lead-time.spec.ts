import { expect, test } from '@playwright/test'

// Termin süresi (Emrah, 16 Ekim 2026): taşyünü ürün sayfasında fiyatın altında ve sipariş/teklif düğmesinin
// yanında görünür; EPS'te süre söylenmediği için görünmez.

test('standart taşyünü: fiyat kutusunda ve teklif düğmesinin altında termin', async ({ page }) => {
  await page.goto('/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu')
  const header = page.getByTestId('pdp-lead-time')
  await expect(header).toContainText('Termin süresi: 7–21 gün')
  await expect(header).toContainText('Sipariş onayından teslime kadar. Çoğunlukla 1 hafta içinde teslim edilir.')
  await expect(page.getByTestId('pdp-standard-primary-quote').getByTestId('pdp-cta-lead-time')).toContainText('Termin süresi: 7–21 gün')
})

test('Bonus: WhatsApp sipariş düğmesinin altında termin', async ({ page }) => {
  await page.goto('/urunler/tasyunu-levha/bonus-f-150-tasyunu')
  const line = page.getByTestId('pdp-cta-lead-time')
  await expect(line).toContainText('Termin süresi: 7–21 gün.')
  await expect(line).toContainText('Çoğunlukla 1 hafta içinde teslim edilir.')
})

test('EPS ürün sayfasında termin yok', async ({ page }) => {
  await page.goto('/urunler/eps-levha/expert-eps-beyaz-eps')
  await expect(page.getByTestId('pdp-commercial-header')).toBeVisible()
  await expect(page.getByTestId('pdp-lead-time')).toHaveCount(0)
  await expect(page.getByTestId('pdp-cta-lead-time')).toHaveCount(0)
})

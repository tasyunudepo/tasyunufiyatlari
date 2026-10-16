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

test('ana sayfa soru-cevap: taşyünü teslim süresi sorusu ve FAQPage verisi', async ({ page, request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toContain('Taşyünü siparişi kaç günde teslim edilir?')
  await page.goto('/')
  await expect(page.locator('.faq-question', { hasText: 'Taşyünü siparişi kaç günde teslim edilir?' })).toBeVisible()
})

test('kalınlık ve 150 yoğunluk sayfaları soru-cevapta termini yazar', async ({ request }) => {
  for (const path of ['/tasyunu-fiyatlari/10-cm', '/tasyunu-yogunluk/150-kg-m3/5-cm']) {
    const html = await (await request.get(path)).text()
    expect(html, path).toContain('Termin süresi sipariş onayından teslime 7–21 gündür.')
  }
})

test('Bonus güvence şeridinde termin kutusu', async ({ page }) => {
  await page.goto('/urunler/tasyunu-levha/bonus-f-150-tasyunu')
  await expect(page.getByLabel('Sipariş ve satış güvenceleri')).toContainText('Termin 7–21 gün')
  await expect(page.getByLabel('Sipariş ve satış güvenceleri')).toContainText('Sipariş onayından teslime kadar. Çoğunlukla 1 hafta içinde teslim edilir.')
})

test('ana sayfa hesaplayıcı sonucu: taşyünü seçiminde termin', async ({ page }) => {
  await page.goto('/')
  const calculator = page.locator('[data-homepage-calculator]')
  await calculator.getByRole('combobox', { name: 'Malzeme' }).selectOption('tasyunu|1|SW035')
  await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
  await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill('1497.6')
  await calculator.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()
  const line = page.getByTestId('homepage-result-lead-time')
  await expect(line).toBeVisible({ timeout: 20_000 })
  await expect(line).toContainText('Termin süresi: 7–21 gün')
  await expect(line).toContainText('Sipariş onayından teslime kadar. Çoğunlukla 1 hafta içinde teslim edilir.')
})

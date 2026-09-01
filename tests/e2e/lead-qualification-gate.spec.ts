import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('katalogdaki ilk ziyarette proje ölçeği uyarısını ve iki net yol gösterir', async ({ page }) => {
  await page.goto('/urunler')

  const dialog = page.getByRole('dialog', { name: /Proje ölçekli satış/i })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Satışlarımız proje ölçeğinde, tam kamyon veya TIR bazında yapılır.')
  await expect(dialog).toContainText('Paket, adet ve düşük metrajlı taleplere destek veremiyoruz.')
  await expect(dialog.getByRole('button', { name: 'Proje fiyatımı hesapla' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Ürünleri inceleyeceğim' })).toBeVisible()
})

test('seçimi kaydeder ve aynı ziyaretçiye uyarıyı yeniden açmaz', async ({ page }) => {
  await page.goto('/urunler')
  await page.getByRole('button', { name: 'Ürünleri inceleyeceğim' }).click()

  await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toBeHidden()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tasyunu_sales_intent_v1')))
    .toBe('research_only')

  await page.reload()
  await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toHaveCount(0)
})

test('proje ölçeği seçimi ana hesaplayıcıya yönlendirir', async ({ page }) => {
  await page.goto('/urunler')
  await page.getByRole('button', { name: 'Proje fiyatımı hesapla' }).click()

  await page.waitForURL(/\/#mantolama-hesaplayici$/)
  await expect(page.locator('[data-homepage-calculator]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tasyunu_sales_intent_v1')))
    .toBe('project_scale')
})

test('ana sayfa kendi tek dönüşüm yolunu korur ve gate açmaz', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(250)

  await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toHaveCount(0)
  await expect(page.locator('[data-homepage-calculator]')).toBeVisible()
})

test('taşyünü levha karar akışında gate açılmaz', async ({ page }) => {
  await page.goto('/urunler/tasyunu-levha')
  await page.waitForTimeout(250)

  await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: /Doğru levhayı bulun/i })).toBeVisible()
})

test('EPS ve aksesuar ürün detayları kendi teklif akışını kesmeden açılır', async ({ page }) => {
  for (const path of [
    '/urunler/eps-levha/expert-eps-beyaz-eps',
    '/urunler/yapistirici/dalmacyali-yapistirici',
  ]) {
    await page.goto(path)
    await page.waitForTimeout(250)
    await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toHaveCount(0)
  }
})

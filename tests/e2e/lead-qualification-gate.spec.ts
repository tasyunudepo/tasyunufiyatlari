import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('ilk ziyarette proje ölçeği uyarısını ve iki net yol gösterir', async ({ page }) => {
  await page.goto('/')

  const dialog = page.getByRole('dialog', { name: /Proje ölçekli satış/i })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Satışlarımız proje ölçeğinde, tam kamyon veya TIR bazında yapılır.')
  await expect(dialog).toContainText('Paket, adet ve düşük metrajlı taleplere destek veremiyoruz.')
  await expect(dialog.getByRole('button', { name: '1 TIR istiyorum' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Ürünleri inceleyeceğim' })).toBeVisible()
})

test('seçimi kaydeder ve aynı ziyaretçiye uyarıyı yeniden açmaz', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ürünleri inceleyeceğim' }).click()

  await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toBeHidden()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tasyunu_sales_intent_v1')))
    .toBe('research_only')

  await page.reload()
  await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toHaveCount(0)
})

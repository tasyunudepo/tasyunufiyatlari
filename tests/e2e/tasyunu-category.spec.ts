import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Taşyünü Levha Karar Masası', () => {
  test('mobilde taşmaz, semantik karar akışını ve inline satış koşulunu korur', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/urunler/tasyunu-levha')
    await page.waitForTimeout(250)

    await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toHaveCount(0)
    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: /Doğru levhayı bulun/i })).toBeVisible()
    await expect(page.getByText('Tam araç koşulunda nakliye fiyata dahildir.')).toBeVisible()
    await expect(page.getByTestId('category-usage-nav')).toBeVisible()

    for (const width of [320, 375, 390, 430, 767]) {
      await page.setViewportSize({ width, height: 844 })
      await expect.poll(() => page.evaluate(() => (
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      ))).toBe(true)
      await expect.poll(() => page.getByTestId('category-usage-nav').evaluate((node) => (
        node.scrollWidth <= node.clientWidth + 1
      ))).toBe(true)
    }
  })

  test('kullanım alanı ve filtreleri URL ile korunur, boş durumdan dönülür', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha')

    await page.getByRole('button', { name: /Çatı/ }).click()
    await expect(page).toHaveURL(/uygulama=cati/)
    await expect(page.getByRole('heading', { level: 2, name: 'Çatı Levhaları' })).toBeVisible()

    await page.getByLabel('Marka filtresi').selectOption({ index: 1 })
    await expect(page).toHaveURL(/marka=/)
    await page.reload()
    await expect(page.getByLabel('Marka filtresi')).not.toHaveValue('all')

    await page.getByLabel('Yoğunluk filtresi').selectOption('declared')
    const productGrid = page.getByTestId('category-product-grid')
    await expect(productGrid.getByRole('heading', { name: 'Bu filtrelerle eşleşen levha yok.' })).toBeVisible()
    await productGrid.getByRole('button', { name: 'Filtreleri temizle' }).click()
    await expect(productGrid.locator('a')).not.toHaveCount(0)
  })

  test('mantolama şehir ve metrajını ana hesaplayıcıya kayıpsız taşır', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha')

    const form = page.getByTestId('category-decision-form')
    await form.getByLabel('Uygulama').selectOption('mantolama')
    await form.getByLabel('Teslim ili').selectOption('6')
    await form.getByLabel('Yaklaşık metraj').fill('1200')
    await form.getByRole('button', { name: 'Fiyatımı hesapla' }).click()

    await page.waitForURL(/\/#mantolama-hesaplayici$/)
    const calculator = page.locator('[data-homepage-calculator]')
    await expect(calculator.getByLabel('Teslim ili')).toHaveValue('6')
    await expect(calculator.getByRole('spinbutton', { name: 'Miktar' })).toHaveValue('1200')
  })

  test('mantolama dışı seçim hesaplayıcı yerine doğru ürün grubuna gider', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha')

    const form = page.getByTestId('category-decision-form')
    await form.getByLabel('Uygulama').selectOption('gemi-marin')
    await form.getByRole('button', { name: 'Uygun ürünleri göster' }).click()

    await expect(page).toHaveURL(/uygulama=gemi-marin/)
    await expect(page.getByRole('heading', { level: 2, name: 'Gemi & Marin' })).toBeVisible()
    await expect(page).not.toHaveURL(/#mantolama-hesaplayici/)
  })

  test('ürün ve karşılaştırma yolları kategori bağlamını taşır', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha')

    await expect(page.getByRole('link', { name: '8 mantolama levhasını karşılaştır' })).toHaveAttribute(
      'href',
      '/tasyunu-karsilastir?entry=category',
    )
    const productGrid = page.getByTestId('category-product-grid')
    const firstProduct = productGrid.locator('[data-category-product-link]').first()
    await expect(firstProduct).toHaveAttribute('href', /entry=category&uygulama=mantolama/)

    const firstCompare = productGrid.locator('[data-category-compare-link]').first()
    await expect(firstCompare).toHaveAttribute('href', /entry=category&focus=/)
    await firstCompare.click()
    await expect(page).toHaveURL(/\/tasyunu-karsilastir\?entry=category&focus=/)
    await expect(page.getByRole('status')).toContainText('karşılaştırmada işaretlendi')
  })

  test('ürün detayı ayrı bağlam bandı oluşturmadan aynı ürün grubuna döndürür', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha/bonus-premium-r-tasyunu?entry=category&uygulama=cati')

    const context = page.getByTestId('product-category-context')
    await expect(context).toHaveText('Çatı Levhaları listesine dön')
    await expect(context).toHaveAttribute(
      'href',
      '/urunler/tasyunu-levha?uygulama=cati#urunler',
    )
    await expect(page.getByText('Karar Masası bağlamı')).toHaveCount(0)
    await expect(page.getByText(/Bu ürünü .* listesinden açtınız/)).toHaveCount(0)

    await context.click()
    await expect(page).toHaveURL(/\/urunler\/tasyunu-levha\?uygulama=cati#urunler$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Çatı Levhaları' })).toBeVisible()
  })

  test('eski section parametreli ürün bağlantısını geriye uyumlu açar', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha/bonus-premium-r-tasyunu?entry=category&section=cati')

    await expect(page.getByTestId('product-category-context')).toContainText('Çatı Levhaları')
  })
})

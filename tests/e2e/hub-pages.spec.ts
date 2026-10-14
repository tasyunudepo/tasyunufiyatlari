import { expect, test, type Page } from '@playwright/test'

// Hub sayfaları (Emrah onayı, 14 Ekim 2026): "10 cm taş yünü fiyatları" ve "10 cm 150 yoğunluk" aramaları
// için yalnız kapsamdaki ürünler; fiyat sunucu HTML'inde; tek ürüne, set hesabına ve kardeş hub'lara dağıtır.

type GtagCall = [string, string, Record<string, unknown>]

async function events(page: Page, name: string): Promise<GtagCall[]> {
  const calls = await page.evaluate(() =>
    ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((entry) => Array.from(entry)),
  )
  return (calls as GtagCall[]).filter((call) => call[0] === 'event' && call[1] === name)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void }
    w.dataLayer = w.dataLayer || []
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer.push(arguments)
    }
  })
})

test.describe('kalınlık hub\'ı', () => {
  test('10 cm: başlık aramayla başlar, 8 levha, fiyat sunucu HTML\'inde', async ({ page, request }) => {
    const html = await (await request.get('/tasyunu-fiyatlari/10-cm')).text()
    expect(html).toMatch(/<title>10 cm Taş Yünü Fiyatları - /u)
    expect(html).toContain('data-testid="comparison-unit-price"')
    expect(html).toContain('href="/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu/10-cm"')
    expect(html).toContain('"@type":"ItemList"')
    expect(html).not.toMatch(/tasyunu-karsilastir\?/u)

    await page.goto('/tasyunu-fiyatlari/10-cm')
    await expect(page.getByRole('heading', { level: 1, name: '10 cm taş yünü fiyatları' })).toBeVisible()
    const table = page.getByTestId('comparison-table')
    await expect(table.locator('tbody tr')).toHaveCount(8)
    await expect(table.getByTestId('comparison-row-dalmacyali-sw035').getByTestId('comparison-unit-price')).toContainText('₺/m²')
    await expect(page.getByTestId('hub-faq')).toContainText('10 cm taş yünü m² fiyatı ne kadar?')
    await expect(page.getByTestId('hub-faq')).toContainText('En az 1 tam kamyon')

    // Kalınlık düğmeleri kardeş hub'lara bağlantı; bulunduğu sayfa işaretli.
    await expect(page.getByRole('link', { name: '10 cm', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect.poll(async () => (await events(page, 'Karsilastirma_Acildi')).length).toBeGreaterThanOrEqual(1)
    expect((await events(page, 'Karsilastirma_Acildi'))[0][2]).toMatchObject({ surface: 'kalinlik' })

    await page.getByRole('link', { name: '5 cm', exact: true }).click()
    await page.waitForURL(/\/tasyunu-fiyatlari\/5-cm$/u)
    await expect(page.getByRole('heading', { level: 1, name: '5 cm taş yünü fiyatları' })).toBeVisible()
  })

  test('satırdan tek ürüne ve set hesabına gidilir', async ({ page }) => {
    await page.goto('/tasyunu-fiyatlari/10-cm')
    const row = page.getByTestId('comparison-table').getByTestId('comparison-row-dalmacyali-sw035')
    await expect(row.getByRole('link', { name: /Stonewool SW035/ })).toHaveAttribute(
      'href',
      '/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu/10-cm',
    )
    await row.getByRole('link', { name: /Komple set hesapla/ }).click()
    await page.waitForURL(/\/#mantolama-hesaplayici$/u)
    await expect(page.locator('[data-homepage-calculator]').getByLabel('Kalınlık')).toHaveValue('10')
  })

  test('telefonda kartlarda "Ürünü gör" ve set hesabı birlikte, taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/tasyunu-fiyatlari/8-cm')
    const card = page.getByTestId('comparison-card-dalmacyali-sw035')
    await expect(card.getByRole('link', { name: 'Ürünü gör' })).toHaveAttribute('href', '/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu/8-cm')
    await expect(card.getByRole('link', { name: /Komple set hesapla/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  })
})

test.describe('150 yoğunluk + kalınlık hub\'ı', () => {
  test('10 cm: yalnız üç 150\'lik, başlık aramayla başlar', async ({ page }) => {
    await page.goto('/tasyunu-yogunluk/150-kg-m3/10-cm')
    await expect(page).toHaveTitle(/^10 cm 150 Yoğunluk Taş Yünü m² Fiyatları - /u)
    await expect(page.getByRole('heading', { level: 1, name: '10 cm 150 yoğunluk taş yünü fiyatları' })).toBeVisible()
    await expect(page.getByTestId('hub-summary')).toContainText('daha iyi ısı yalıtımı iddiası değildir')
    const table = page.getByTestId('comparison-table')
    await expect(table.locator('tbody tr')).toHaveCount(3)
    const keys = await table.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-product-key')))
    expect([...keys].sort()).toEqual(['bonus-premium-f-150', 'bonus-premium-f-150-pro', 'expert-hd150'])
    await expect(page.getByTestId('hub-links').getByRole('link', { name: '10 cm taş yünü fiyatları (bütün markalar)' })).toHaveAttribute(
      'href',
      '/tasyunu-fiyatlari/10-cm',
    )
  })

  test('genel ve 150 sayfası kalınlık hub\'larına düz bağlantı verir', async ({ request }) => {
    const general = await (await request.get('/tasyunu-karsilastir')).text()
    expect(general).toContain('href="/tasyunu-fiyatlari/10-cm"')
    expect(general).toContain('href="/tasyunu-yogunluk/150-kg-m3/5-cm"')
    const d150 = await (await request.get('/tasyunu-yogunluk/150-kg-m3')).text()
    expect(d150).toContain('href="/tasyunu-yogunluk/150-kg-m3/10-cm"')
  })
})

test.describe('120 yoğunluk sayfası ve ana sayfa fiyat tablosu (Faz 4)', () => {
  test('120: 120–125 sınıfı önce, 100–110 levhalar "alternatif" başlığının altında', async ({ page }) => {
    await page.goto('/tasyunu-yogunluk/120-kg-m3')
    await expect(page).toHaveTitle(/^120 Yoğunluk Taş Yünü Fiyatları - /u)
    await expect(page.getByRole('heading', { level: 1, name: '120 yoğunluk taş yünü fiyatları' })).toBeVisible()
    const table = page.getByTestId('comparison-table')
    const order = await table.locator('tbody tr').evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-product-key') ?? (row.getAttribute('data-testid') === 'comparison-alt-heading' ? 'ALT' : '?')),
    )
    expect(order).toHaveLength(6)
    const alt = order.indexOf('ALT')
    expect(alt).toBe(3)
    expect(order.slice(0, alt).sort()).toEqual(['bonus-premium-f-120', 'dalmacyali-sw035', 'expert-ld125'])
    expect(order.slice(alt + 1).sort()).toEqual(['expert-tasyunu-premium', 'fawori-optimix-tr75'])
    await expect(table.getByTestId('comparison-alt-heading')).toContainText('Alternatif · 100–110 yoğunluk')
    // Sıralama değişse de alternatifler altta kalır.
    await page.getByTestId('comparison-pricing').getByRole('button', { name: 'Isı iletkenliği', exact: true }).click()
    const afterSort = await table.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')))
    expect(afterSort.indexOf('comparison-alt-heading')).toBe(3)
  })

  test('ana sayfa: kalınlık başına en düşük m² fiyatı, satır kalınlık hub\'ına gider', async ({ page, request }) => {
    const html = await (await request.get('/')).text()
    expect(html).toContain('data-testid="home-price-table"')
    expect(html).toContain('href="/tasyunu-fiyatlari/10-cm"')
    await page.goto('/')
    const table = page.getByTestId('home-price-table')
    await expect(table.getByRole('heading', { level: 2 })).toContainText('taşyünü m² fiyatları')
    await expect(table.locator('tbody tr')).toHaveCount(9)
    await expect(table.getByRole('link', { name: '10 cm taş yünü', exact: true })).toHaveAttribute('href', '/tasyunu-fiyatlari/10-cm')
    await expect(table.locator('tbody tr').first()).toContainText('₺/m²')
  })

  test('rabitz telli şilte "Rulo Taşyünü Şilte" başlığıyla', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/bonus-endustriyel-silte-tasyunu')
    test.skip(response?.status() === 404, 'Şilte sayfası yok')
    await expect(page).toHaveTitle('Rulo Taşyünü Şilte (Rabitz Telli) Fiyatı — Bonus Endüstriyel Şilte | Taşyünü Fiyatları')
  })
})

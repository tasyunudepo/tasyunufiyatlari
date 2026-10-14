import { expect, test, type Page } from '@playwright/test'

// GCR #26e6c0 (Emrah onayı, 14 Ekim 2026): "taş yünü fiyatları" araması SW035 10 cm sayfasına geliyor; aynı
// kalınlıktaki bütün taşyünü levhalar Karşılaştırma Merkezi'nde yan yana. Ürün sayfasının üstündeki kutu
// kalınlığı ve gelinen ürünü adresle taşır; karşılaştırma sayfası o kalınlıkla açılır ve girişi ayrı sayar.

type GtagCall = [string, string, Record<string, unknown>]

async function events(page: Page, name: string): Promise<GtagCall[]> {
  const calls = await page.evaluate(() =>
    ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((entry) => Array.from(entry)),
  )
  return (calls as GtagCall[]).filter((call) => call[0] === 'event' && call[1] === name)
}

test.beforeEach(async ({ page }) => {
  // GA etiketi yalnız üretimde yüklenir; geliştirme sunucusunda aynı biçimli gtag kurulur.
  await page.addInitScript(() => {
    const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void }
    w.dataLayer = w.dataLayer || []
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer.push(arguments)
    }
  })
})

test.describe('ürün sayfasından aynı kalınlıkta karşılaştırma', () => {
  test('SW035 10 cm sayfası kutuyu gösterir; 10 cm hub\'ı açılır, SW035 işaretli, giriş ayrı sayılır', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu/10-cm')
    const shortcut = page.getByTestId('comparison-thickness-shortcut')
    await expect(shortcut).toBeVisible()
    // 14 Ekim 2026 (hub planı Faz 3): kutu o kalınlığın hub'ına gider; adres temiz, giriş tıklamada taşınır.
    await expect(shortcut).toContainText('Dilerseniz diğer 10 cm taşyünü levhalarla kıyaslayın')
    await expect(shortcut).toContainText('10 cm taş yünü fiyatları')
    await expect(shortcut).toHaveAttribute('href', '/tasyunu-fiyatlari/10-cm')
    // SW035 150'lik değil: 150 yoğunluk bağlantısı çıkmaz.
    await expect(page.getByTestId('density-150-shortcut')).toHaveCount(0)

    await shortcut.click()
    await page.waitForURL(/\/tasyunu-fiyatlari\/10-cm$/u)
    await expect(page.getByRole('link', { name: '10 cm', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('comparison-table').getByTestId('comparison-row-dalmacyali-sw035')).toHaveAttribute('data-focused', 'true')
    // Geliştirme sunucusunda React açılış etkisini iki kez çalıştırır (StrictMode); üretimde tek olay gider.
    await expect.poll(async () => (await events(page, 'Karsilastirma_Acildi')).length).toBeGreaterThanOrEqual(1)
    for (const opened of await events(page, 'Karsilastirma_Acildi')) {
      expect(opened[2]).toMatchObject({ entry_placement: 'pdp_kalinlik', surface: 'kalinlik' })
    }
  })

  test('150\'lik ürün sayfası 150 yoğunluk hub\'ına da bağlanır', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/expert-hd150-tasyunu/10-cm')
    test.skip(response?.status() === 404, 'HD150 10 cm sayfası yok')
    await expect(page.getByTestId('density-150-shortcut')).toHaveAttribute('href', '/tasyunu-yogunluk/150-kg-m3/10-cm')
    await expect(page).toHaveTitle(/^Expert HD150 10 cm 150 Yoğunluk Taş Yünü Fiyatı - /u)
  })

  test('her sayfanın altbilgisi kalınlık hub\'larına bağlanır', async ({ page }) => {
    await page.goto('/iletisim')
    const footer = page.getByTestId('footer-hub-links')
    await expect(footer.getByRole('link', { name: '10 cm taş yünü', exact: true })).toHaveAttribute('href', '/tasyunu-fiyatlari/10-cm')
    await expect(footer.getByRole('link', { name: '150 yoğunluk taş yünü', exact: true })).toHaveAttribute('href', '/tasyunu-yogunluk/150-kg-m3')
  })

  test('geçersiz kalınlık varsayılan 5 cm ile açılır', async ({ page }) => {
    await page.goto('/tasyunu-karsilastir?kalinlik=99&entry=pdp_kalinlik')
    await expect(page.getByRole('button', { name: '5 cm', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('EPS ürün sayfasında taşyünü karşılaştırma kutusu yoktur', async ({ page }) => {
    const response = await page.goto('/urunler/eps-levha/dalmacyali-ideal-carbon-eps/10-cm')
    test.skip(response?.status() === 404, 'EPS sayfası yok')
    await expect(page.getByTestId('comparison-thickness-shortcut')).toHaveCount(0)
  })
})

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
  test('SW035 10 cm sayfası kutuyu gösterir; karşılaştırma 10 cm ile açılır ve girişi ayrı sayar', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu/10-cm')
    const shortcut = page.getByTestId('comparison-thickness-shortcut')
    await expect(shortcut).toBeVisible()
    await expect(shortcut).toContainText('10 cm mantolama taşyünleri yan yana')
    await expect(shortcut).toContainText('Sıvalı dış cephe mantolamasına uygun')
    // 14 Ekim 2026: adres temiz (Google sayfayı tek adresle tanısın); giriş, kalınlık ve ürün tıklamada taşınır.
    await expect(shortcut).toHaveAttribute('href', '/tasyunu-karsilastir')

    await shortcut.click()
    await page.waitForURL(/\/tasyunu-karsilastir$/u)
    await expect(page.getByRole('button', { name: '10 cm', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('comparison-table').getByTestId('comparison-row-dalmacyali-sw035')).toHaveAttribute('data-focused', 'true')
    await expect(page.getByRole('button', { name: '5 cm', exact: true })).toHaveAttribute('aria-pressed', 'false')
    // Geliştirme sunucusunda React açılış etkisini iki kez çalıştırır (StrictMode); üretimde tek olay gider.
    await expect.poll(async () => (await events(page, 'Karsilastirma_Acildi')).length).toBeGreaterThanOrEqual(1)
    for (const opened of await events(page, 'Karsilastirma_Acildi')) {
      expect(opened[2]).toMatchObject({ entry_placement: 'pdp_kalinlik' })
    }
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

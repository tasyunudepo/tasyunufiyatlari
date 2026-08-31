import { expect, test, type Locator, type Page } from '@playwright/test'

// FR-002 / FR-007 / AC-002 koruması (docs/verification PRD):
// mantolama wizard'ı yalnız uygun modelleri gösterir. Uygunluk kaynağı
// lib/wizard/eligibility (taşyünü: teknik profil; EPS: mantolama listesi).
// RF150, PW50, VF80 gibi katalog ürünleri hiçbir marka/malzeme
// kombinasyonunda wizard model listesine düşmez.

const YASAKLI_MODELLER = ['RF150', 'PW50', 'VF80']
const TASYUNU_BEKLENEN: Record<string, string> = {
  'Dalmaçyalı': 'SW035',
  Expert: 'HD150',
  Optimix: 'TR7.5',
}

function wizardLocator(page: Page): Locator {
  return page.locator('[data-homepage-calculator]')
}

async function productSelect(page: Page): Promise<Locator> {
  const product = wizardLocator(page).getByRole('combobox', { name: 'Malzeme' })
  await expect(product).toBeEnabled({ timeout: 20_000 })
  return product
}

test.describe('wizard-katalog ayrımı', () => {
  test('taşyünü markalarında yalnız mantolama modelleri listelenir', async ({ page }) => {
    await page.goto('/')
    const product = await productSelect(page)
    const options = product.locator('optgroup[label="Taşyünü"] option')

    for (const [brand, beklenenModel] of Object.entries(TASYUNU_BEKLENEN)) {
      await expect(options.filter({ hasText: `${brand} ${beklenenModel}` })).toHaveCount(1)

      for (const yasakli of YASAKLI_MODELLER) {
        await expect(options.filter({ hasText: yasakli })).toHaveCount(0)
      }
    }
  })

  test('EPS seçiminde taşyünü modelleri sızmaz, EPS mantolama modelleri gelir', async ({ page }) => {
    await page.goto('/')
    const product = await productSelect(page)
    const options = product.locator('optgroup[label="EPS"] option')

    await expect(options.filter({ hasText: 'Carbon' }).first()).toBeAttached()
    await expect(options.filter({ hasText: 'SW035' })).toHaveCount(0)

    for (const yasakli of YASAKLI_MODELLER) {
      await expect(options.filter({ hasText: yasakli })).toHaveCount(0)
    }
  })

  test('taşyünü akışı kalınlık adımına ilerleyebiliyor', async ({ page }) => {
    // Filtre regresyonu wizard'ı boş bırakırsa bu akış kırılır.
    await page.goto('/')
    const calculator = wizardLocator(page)
    const product = await productSelect(page)
    const thickness = calculator.getByRole('combobox', { name: 'Kalınlık' })

    await product.selectOption({ label: 'Expert HD150' })
    await expect(thickness).toBeEnabled()
    await thickness.selectOption('5')
    await expect(thickness).toHaveValue('5')
  })
})

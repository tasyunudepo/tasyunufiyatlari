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
  return page.locator('#mantolama-hesaplayici')
}

async function selectBrand(page: Page, brand: string) {
  const wizard = wizardLocator(page)
  await wizard
    .locator('button')
    .filter({ has: page.locator(`img[alt="${brand}"]`) })
    .first()
    .click()
}

test.describe('wizard-katalog ayrımı', () => {
  test('taşyünü markalarında yalnız mantolama modelleri listelenir', async ({ page }) => {
    await page.goto('/')
    const wizard = wizardLocator(page)
    await expect(wizard.getByText('Levha Markası')).toBeVisible()

    for (const [brand, beklenenModel] of Object.entries(TASYUNU_BEKLENEN)) {
      await selectBrand(page, brand)
      await expect(wizard.getByRole('button', { name: new RegExp(beklenenModel) })).toBeVisible()

      for (const yasakli of YASAKLI_MODELLER) {
        await expect(wizard.getByText(yasakli, { exact: true })).toHaveCount(0)
      }
    }
  })

  test('EPS seçiminde taşyünü modelleri sızmaz, EPS mantolama modelleri gelir', async ({ page }) => {
    await page.goto('/')
    const wizard = wizardLocator(page)

    await wizard.getByRole('button', { name: /EPS/ }).first().click()
    await selectBrand(page, 'Dalmaçyalı')

    await expect(wizard.getByRole('button', { name: /Carbon/ }).first()).toBeVisible()
    await expect(wizard.getByText('SW035', { exact: true })).toHaveCount(0)

    for (const yasakli of YASAKLI_MODELLER) {
      await expect(wizard.getByText(yasakli, { exact: true })).toHaveCount(0)
    }
  })

  test('taşyünü akışı kalınlık adımına ilerleyebiliyor', async ({ page }) => {
    // Filtre regresyonu wizard'ı boş bırakırsa bu akış kırılır.
    await page.goto('/')
    const wizard = wizardLocator(page)

    await selectBrand(page, 'Expert')
    await expect(wizard.getByRole('button', { name: /HD150|LD125|Premium/ }).first()).toBeVisible()
    await wizard.getByRole('button', { name: 'Kalınlık Seçimine Geç' }).click()
    await expect(wizard.getByText('Yalıtım Kalınlığını Seçin')).toBeVisible()
  })
})

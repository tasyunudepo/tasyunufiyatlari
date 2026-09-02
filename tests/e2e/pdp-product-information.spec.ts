import { expect, test } from '@playwright/test'

const OPTIMIX_PATH = '/urunler/tasyunu-levha/optimix-tr7-5-tasyunu'

test.describe('Levha PDP ürün ve paket bilgileri', () => {
  test('teknik özet tekrarsızdır ve seçili kalınlığın paket karşılığını açıklar', async ({ page }) => {
    await page.goto(OPTIMIX_PATH)

    const quickFacts = page.getByTestId('pdp-product-quick-facts')
    const packageDetails = page.getByTestId('pdp-package-details')

    await expect(quickFacts).toContainText('Yoğunluk')
    await expect(quickFacts).toContainText('100–120 kg/m³')
    await expect(packageDetails).toBeVisible()
    await expect(packageDetails).toContainText('5 cm paket bilgisi')
    await expect(packageDetails).toContainText('60 × 100 cm')
    await expect(packageDetails).toContainText('6 levha')
    await expect(packageDetails).toContainText('3,60 m²')
    await expect(packageDetails).toContainText('224 paket')
    await expect(packageDetails).toContainText('1.344 levha')

    await expect(page.getByText('0,035 W/mK', { exact: true })).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Optimix TR7.5 hakkında' })).toBeVisible()
  })

  test('kalınlık değişince paket içeriği aynı sayfada güncellenir', async ({ page }) => {
    await page.goto(OPTIMIX_PATH)

    const packageDetails = page.getByTestId('pdp-package-details')
    await page.getByRole('combobox', { name: 'Kalınlık', exact: true }).selectOption('6')

    await expect(packageDetails).toContainText('6 cm paket bilgisi')
    await expect(packageDetails).toContainText('5 levha')
    await expect(packageDetails).toContainText('3,00 m²')
    await expect(packageDetails).toContainText('1.120 levha')
  })

  test('temel girdileri aynı satırda sunar ve fiyatı seçili araç planıyla açıklar', async ({ page }) => {
    await page.goto(OPTIMIX_PATH)

    const planner = page.getByRole('region', { name: 'Fiyat ve teklif işlemleri' })
    await expect(planner.getByRole('combobox', { name: 'Teslimat Şehri' })).toBeVisible()
    await expect(planner.getByRole('combobox', { name: 'Kalınlık', exact: true })).toBeVisible()
    await expect(planner.getByRole('textbox', { name: 'İhtiyaç Metrajı' })).toHaveValue(/,\d$/)
    await expect(page.getByTestId('pdp-commercial-price-context')).toContainText('planında m² fiyatı')
    await expect(page.getByRole('heading', { name: 'Kalınlığı seçin' })).toBeHidden()
  })

  test('metrajda nokta ve virgülü kabul eder, alandan çıkınca Türkçe gösterir', async ({ page }) => {
    await page.goto(OPTIMIX_PATH)

    const area = page.getByRole('textbox', { name: 'İhtiyaç Metrajı' })
    await area.fill('806.4')
    await area.blur()
    await expect(area).toHaveValue('806,4')
  })

  test('karşılaştırma yollarını farklı işleri anlatan adlarla ayırır', async ({ page }) => {
    await page.goto(OPTIMIX_PATH)

    await expect(page.getByText('Bonus komple mantolama setini hesapla')).toBeVisible()
    await expect(page.getByRole('link', { name: /Diğer taşyünü levhalarla karşılaştır/ })).toBeVisible()
  })

  test('tüm kalınlıklar tablosu uzun bilgiyi isteğe bağlı açar', async ({ page }) => {
    await page.goto(OPTIMIX_PATH)

    const disclosure = page.getByTestId('pdp-package-table')
    await expect(disclosure).not.toHaveAttribute('open', '')
    await disclosure.getByText('Tüm kalınlıkların paket bilgisini göster').click()
    await expect(disclosure).toHaveAttribute('open', '')
    await expect(disclosure.getByRole('columnheader', { name: 'Kalınlık' })).toBeVisible()
    await expect(disclosure.getByRole('cell', { name: '10 cm' })).toBeVisible()
  })

  test('satıcı, ödeme ve teklif sonrası süreci görünür güven katmanında açıklar', async ({ page }) => {
    await page.goto(OPTIMIX_PATH)

    const assurance = page.getByTestId('pdp-purchase-assurance')
    await expect(assurance).toContainText('ÖzerGrup Yalıtım ve İzolasyon A.Ş.')
    await expect(assurance).toContainText('Kredi kartı veya banka havalesi')
    await expect(assurance).toContainText('sipariş onayında tek seferde')
    await expect(assurance).toContainText('Referanslı PDF')
  })
})

import { expect, test, type Page } from '@playwright/test'

const BONUS_PATH = '/urunler/tasyunu-levha/bonus-f-150-pro-tasyunu'
const BONUS_F120_PATH = '/urunler/tasyunu-levha/bonus-f-120-tasyunu'
const NON_BONUS_PATH = '/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu'

const BONUS_PRICE = {
  ok: true,
  salePricePerM2: 348.77,
  packageM2: 2.88,
  kamyonM2: 967.68,
  tirM2: 1774.08,
}

async function openDeterministicBonusPdp(page: Page) {
  await page.route('**/api/bonus-price**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(BONUS_PRICE),
    })
  })
  const response = await page.goto(BONUS_PATH)
  expect(response?.status()).not.toBe(404)
  await expect(page.getByTestId('bonus-region-price').getByText('348,77')).toBeVisible()
}

async function openDeterministicF120Pdp(page: Page) {
  await page.route('**/api/bonus-price**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...BONUS_PRICE,
        salePricePerM2: 302.54,
        packageM2: 3.6,
        kamyonM2: 950.4,
        tirM2: 1742.4,
      }),
    })
  })
  const response = await page.goto(BONUS_F120_PATH)
  expect(response?.status()).not.toBe(404)
  await expect(page.getByTestId('bonus-region-price').getByText('302,54')).toBeVisible()
}

test.describe('A2 hibrit Bonus Sipariş Masası', () => {
  test('ürün kimliği, canlı fiyat, WhatsApp birincil ve PDF ikincil aynı karar yüzeyindedir', async ({ page }) => {
    await openDeterministicBonusPdp(page)

    await expect(page.getByTestId('pdp-purchase-summary')).toBeVisible()
    await expect(page.getByTestId('pdp-product-identity')).toBeVisible()
    await expect(page.getByTestId('pdp-product-visual')).toBeVisible()
    await expect(page.getByTestId('pdp-order-panel')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'İstanbul için satın alma özeti' })).toBeVisible()

    const kamyon = page.getByRole('button', { name: /1 Kamyon.*967,68 m².*337\.497,75 ₺/ })
    const tir = page.getByRole('button', { name: /1 TIR.*1\.774,08 m².*618\.745,88 ₺/ })
    await expect(kamyon).toBeVisible()
    await expect(tir).toBeVisible()

    const whatsapp = page.getByTestId('pdp-whatsapp-primary')
    await expect(whatsapp).toBeVisible()
    await expect(page.getByTestId('pdp-pdf-secondary').getByRole('button')).toBeVisible()
    await expect(page.getByTestId('pdp-payment-methods')).toContainText(
      'Kredi kartı veya banka havalesi. Ödeme sipariş onayında tek seferde alınır.',
    )

    const href = await whatsapp.getAttribute('href')
    expect(href).toContain('https://wa.me/')
    const decoded = decodeURIComponent(href || '')
    expect(decoded).toContain('Bonus Premium F 150 Pro')
    expect(decoded).toContain('(5 cm)')
    expect(decoded).toContain('967,7 m² · 1 Kamyon')
    expect(decoded).toContain('348,77 ₺/m² (KDV hariç)')
    expect(decoded).toContain('Nakliye: tam araç planında fiyata dahil')
    expect(decoded).toMatch(/Ref: TYW[A-Z0-9]{8,16}/)
  })

  test('WhatsApp tıklaması anonim fiyat bağlamını intent API’ye taşır', async ({ page }) => {
    await openDeterministicBonusPdp(page)

    const whatsapp = page.getByTestId('pdp-whatsapp-primary')
    await whatsapp.evaluate((element) => {
      element.addEventListener('click', (event) => event.preventDefault(), { once: true })
    })
    const requestPromise = page.waitForRequest((request) =>
      request.url().includes('/api/whatsapp-intent') && request.method() === 'POST',
    )
    await whatsapp.click()
    const request = await requestPromise
    const payload = request.postDataJSON()

    expect(payload).toMatchObject({
      source: 'product_detail_summary',
      ctaLocation: 'product_detail_summary',
      experienceVariant: 'a_whatsapp_first',
      pricedContext: {
        modelName: 'F 150 Pro',
        thicknessCm: 5,
        cityCode: 34,
        cityName: 'İstanbul',
        subRegionName: 'Avrupa Yakası',
        areaM2: 967.68,
        packageCount: 336,
        vehicleType: 'lorry',
        vehicleLabel: '1 Kamyon',
        pricePerM2: 348.77,
        totalExVat: 337_497.75,
        shippingMode: 'included_in_sale_price',
      },
    })
    expect(payload.pricedContext.refCode).toMatch(/^TYW[A-Z0-9]{8,16}$/)
    expect(JSON.stringify(payload)).not.toMatch(/phone|email|customerName/i)
  })

  test('mobil yapışkan WhatsApp CTA görünür ve yatay taşma oluşturmaz', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openDeterministicBonusPdp(page)

    const sticky = page.getByTestId('pdp-mobile-order-sticky')
    const primary = page.getByTestId('pdp-whatsapp-primary')
    await expect(sticky).toBeVisible()
    await expect(sticky).toContainText('KDV hariç')
    await expect(primary).toBeHidden()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const footerIsClear = await page.evaluate(() => {
      const footer = document.querySelector('footer')
      const stickyBar = document.querySelector('[data-testid="pdp-mobile-order-sticky"]')
      if (!footer || !stickyBar) return false
      return footer.getBoundingClientRect().bottom <= stickyBar.getBoundingClientRect().top + 1
    })
    expect(footerIsClear).toBe(true)

    await page.setViewportSize({ width: 1024, height: 900 })
    await expect(sticky).toBeVisible()
    await expect(primary).toBeHidden()

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(sticky).toBeHidden()
    await expect(primary).toBeVisible()
  })

  test('geçersiz metraj plan veya CTA üretmez; düzeltildiğinde güvenli akış geri gelir', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openDeterministicBonusPdp(page)

    const metraj = page.getByLabel('İhtiyaç metrajı')
    const invalidValues = [
      { value: 'abc', error: 'Sıfırdan büyük geçerli bir metraj girin.' },
      { value: '', error: 'İhtiyaç metrajını girin.' },
      { value: '0', error: 'Sıfırdan büyük geçerli bir metraj girin.' },
      { value: '-25', error: 'Sıfırdan büyük geçerli bir metraj girin.' },
      { value: '10001', error: 'En fazla 10.000 m² girilebilir.' },
    ]

    for (const invalid of invalidValues) {
      await metraj.fill(invalid.value)
      await expect(metraj).toHaveAttribute('aria-invalid', 'true')
      await expect(metraj).toHaveAttribute('aria-describedby', 'bonus-purchase-metraj-error')
      await expect(page.getByTestId('pdp-metraj-error')).toHaveText(invalid.error)
      await expect(page.getByTestId('pdp-vehicle-plans')).toHaveCount(0)
      await expect(page.getByTestId('pdp-whatsapp-primary')).toHaveCount(0)
      await expect(page.getByTestId('pdp-mobile-order-sticky')).toHaveCount(0)
      await expect(page.getByTestId('pdp-pdf-secondary')).toHaveCount(0)
    }

    await metraj.fill('2000')
    await expect(metraj).toHaveAttribute('aria-invalid', 'false')
    await expect(page.getByTestId('pdp-metraj-error')).toHaveCount(0)
    await expect(page.getByTestId('pdp-vehicle-plans')).toBeVisible()
    await expect(page.getByRole('button', { name: /2 TIR/ })).toBeVisible()
    await expect(page.getByTestId('pdp-whatsapp-primary')).toBeVisible()
    await expect(page.getByTestId('pdp-pdf-secondary')).toBeVisible()
  })

  test('kamyonu az aşan ihtiyaçta geçerli TIR planı ile yakın alt kamyon seçeneğini ayırır', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await openDeterministicF120Pdp(page)

    const metraj = page.getByLabel('İhtiyaç metrajı')
    await metraj.fill('1050')

    const validPlans = page.getByTestId('pdp-vehicle-plans')
    await expect(page.getByTestId('pdp-single-valid-plan')).toContainText('1 TIR')
    await expect(page.getByTestId('pdp-single-valid-plan')).toContainText('Tek geçerli plan')
    await expect(validPlans.getByRole('button', { name: /1 TIR/ })).toHaveCount(0)
    await expect(page.getByTestId('pdp-lower-vehicle-option')).toContainText('1 Kamyon')
    await expect(page.getByTestId('pdp-lower-vehicle-option')).toContainText('99,60 m² eksik')
    await expect(page.getByTestId('pdp-order-amount')).toContainText('1.742,40 m²')
    await expect(metraj).toHaveValue('1050')

    await page.getByRole('button', { name: 'Metrajı 950,40 m² yap ve 1 Kamyon seç' }).click()

    await expect(metraj).toHaveValue('950,4')
    await expect(validPlans.getByRole('button', { name: /1 Kamyon.*950,40 m²/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByTestId('pdp-order-amount')).toContainText('950,40 m²')
  })

  test('1366×768 kısa masaüstünde yalnız birincil CTA görünür ve ekran içinde kalır', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await openDeterministicBonusPdp(page)

    const primary = page.getByTestId('pdp-whatsapp-primary')
    const sticky = page.getByTestId('pdp-mobile-order-sticky')
    await expect(primary).toBeVisible()
    await expect(sticky).toBeHidden()

    const box = await primary.boundingBox()
    expect(box).not.toBeNull()
    expect((box?.y ?? 9999) + (box?.height ?? 9999)).toBeLessThanOrEqual(768)
  })

  test('fiyat hatasında seçimleri koruyarak aynı sorguyu yeniden hesaplar', async ({ page }) => {
    let anadoluAttempts = 0
    await page.route('**/api/bonus-price**', async (route) => {
      const subRegion = new URL(route.request().url()).searchParams.get('sub')
      if (subRegion === 'anadolu') {
        anadoluAttempts += 1
        if (anadoluAttempts === 1) {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, reason: 'temporary_failure' }),
          })
          return
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BONUS_PRICE),
      })
    })

    await page.goto(BONUS_PATH)
    await expect(page.getByTestId('bonus-region-price').getByText('348,77')).toBeVisible()

    const metraj = page.getByLabel('İhtiyaç metrajı')
    await metraj.fill('2000')
    const mixedPlan = page.getByRole('button', { name: /1 TIR \+ 1 Kamyon/ })
    await mixedPlan.click()
    await page.getByRole('button', { name: 'Anadolu Yakası' }).click()

    const alert = page.getByTestId('bonus-region-price').getByRole('alert')
    await expect(alert).toContainText('seçimlerinizi değiştirmeden yeniden deneyebilirsiniz')
    await expect(page.getByRole('button', { name: 'Anadolu Yakası' })).toHaveAttribute('aria-pressed', 'true')

    await alert.getByRole('button', { name: 'Fiyatı yeniden hesapla' }).click()
    await expect(page.getByTestId('bonus-region-price').getByText('348,77')).toBeVisible()
    await expect(metraj).toHaveValue('2000')
    await expect(page.getByRole('button', { name: /1 TIR \+ 1 Kamyon/ })).toHaveAttribute('aria-pressed', 'true')
    expect(anadoluAttempts).toBe(2)
  })

  test('Filli Boya grubu levha ortak açık/koyu kabukta güvenli PDF akışını korur', async ({ page }) => {
    await page.goto(NON_BONUS_PATH)

    await expect(page.getByTestId('pdp-purchase-summary')).toHaveCount(0)
    await expect(page.getByTestId('pdp-standard-plate-summary')).toBeVisible()
    await expect(page.getByTestId('pdp-standard-plate-brand')).toContainText('Dalmaçyalı')
    await expect(page.getByTestId('pdp-filli-group-mark')).toContainText('Filli Boya ürün grubu')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dalmaçyalı')
    await expect(page.getByTestId('pdp-whatsapp-primary')).toHaveCount(0)
    await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'PDF teklifimi hazırla' })).toBeVisible()
  })

  test('Expert ve Optimix PDP’leri aynı Filli Boya grup kabuğunu kullanır', async ({ page }) => {
    for (const productCase of [
      { path: '/urunler/tasyunu-levha/expert-hd150-tasyunu', brand: 'Expert' },
      { path: '/urunler/tasyunu-levha/optimix-tr7-5-tasyunu', brand: 'Optimix' },
    ]) {
      const response = await page.goto(productCase.path)
      expect(response?.status()).not.toBe(404)
      await expect(page.getByTestId('pdp-standard-plate-summary')).toBeVisible()
      await expect(page.getByTestId('pdp-standard-plate-brand')).toContainText(productCase.brand)
      await expect(page.getByTestId('pdp-filli-group-mark')).toContainText('Filli Boya ürün grubu')
    }
  })

  test('EPS levha aynı açık/koyu levha kabuğunu kullanır', async ({ page }) => {
    const response = await page.goto('/urunler/eps-levha/expert-eps-beyaz-eps')

    expect(response?.status()).not.toBe(404)
    await expect(page.getByTestId('pdp-standard-plate-summary')).toBeVisible()
    await expect(page.getByTestId('pdp-standard-plate-brand')).toContainText('Expert')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('EPS')
  })

  test('aksesuar PDP yeni açık/koyu ürün ve sistem teklif kabuğunu kullanır', async ({ page }) => {
    const response = await page.goto('/urunler/yapistirici/dalmacyali-yapistirici')

    expect(response?.status()).not.toBe(404)
    await expect(page.getByRole('dialog', { name: 'Proje ölçekli satış' })).toHaveCount(0)
    await expect(page.getByTestId('pdp-accessory-summary')).toBeVisible()
    await expect(page.getByTestId('pdp-accessory-brand')).toContainText('Dalmaçyalı')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dalmaçyalı')
    await expect(page.getByRole('button', { name: /Takım Fiyatını Gör/ })).toBeVisible()
  })
})

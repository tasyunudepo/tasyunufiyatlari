import { expect, test } from '@playwright/test'

const PRODUCT_VALUE = 'tasyunu|1|SW035'
const VALID_AREA_M2 = '1497.6'

test.describe('Ana sayfa tek dönüşüm yolu', () => {
  test('başlangıçta yalnız hesaplama CTA görünür; sonuçtan sonra WhatsApp baskınlaşır', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Taşyünü ve EPS teslim fiyatını hesaplayın.',
    })).toBeVisible()
    await expect(page.getByText('Teslim ili, ürün, kalınlık ve miktarı seçin; fiyatınızı anında görün.')).toBeVisible()
    await expect(page.locator('header img[alt="Taşyünü Fiyatları"]')).toBeVisible()
    await expect(page.getByText('Satış ve sevkiyat:')).toBeVisible()

    const video = page.locator('video').first()
    await expect(video).toHaveAttribute('poster', '/video/ozer-grup-depo-hero-poster.webp')
    await expect(video).toHaveAttribute('loop', '')
    await expect(video).toHaveAttribute('playsinline', '')
    await expect(page.getByText('İstanbul / Tuzla Depo')).toBeVisible()
    await expect(page.getByText('Gerçek depo ve sevkiyat görüntüsü')).toHaveCount(0)

    const calculator = page.locator('[data-homepage-calculator]')
    await expect(calculator).toHaveAttribute('data-state', 'initial')
    await expect(calculator.getByRole('button', { name: 'Fiyatımı Hesapla' })).toBeVisible()
    await expect(page.getByRole('button', { name: "WhatsApp'ta Siparişi Başlat" })).toHaveCount(0)

    await calculator.getByRole('combobox', { name: 'Malzeme' }).selectOption(PRODUCT_VALUE)
    await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
    await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill(VALID_AREA_M2)

    const calculateButton = calculator.getByRole('button', { name: 'Fiyatımı Hesapla' })
    await expect(calculateButton).toBeEnabled()
    await calculateButton.click()

    const result = page.getByTestId('homepage-calculation-result')
    await expect(result).toBeVisible({ timeout: 20_000 })
    await expect(result.getByRole('heading', { name: '8 Kalem Komple Mantolama Seti' })).toBeVisible()
    await expect(result).toContainText('Dalmaçyalı SW035 5 cm Taşyünü')
    await expect(result).toContainText('Levha · Yapıştırıcı · Sıva · Dübel · File · Fileli Köşe · Astar · Mineral Kaplama')
    await expect(result).toContainText('Nakliye fiyata dahil')
    await expect(result).toContainText('KDV hariç')
    await expect(result).toContainText('KDV dahil')
    const tierSelector = result.getByTestId('homepage-tier-selector')
    await expect(tierSelector).toHaveAttribute('data-tier-count', '3')
    const tierGroup = tierSelector.getByRole('radiogroup', { name: 'Sisteminizi seçin' })
    await expect(tierSelector.getByText('Sisteminizi seçin')).toBeVisible()
    await expect(tierSelector.getByText('Seçiminiz ürün reçetesini ve toplam fiyatı anında günceller.')).toBeVisible()
    await expect(tierGroup.getByRole('radio')).toHaveCount(3)
    const economicRadio = tierGroup.getByRole('radio', { name: /Ekonomik/ })
    const balancedRadio = tierGroup.getByRole('radio', { name: /Dengeli/ })
    const originalRadio = tierGroup.getByRole('radio', { name: /Orijinal/ })
    await expect(economicRadio).not.toBeChecked()
    await expect(balancedRadio).toBeChecked()
    await expect(originalRadio).not.toBeChecked()
    await expect(tierSelector.getByText('SEÇİLİ', { exact: true })).toHaveCount(1)
    await expect(tierSelector.getByText('ÖNERİLEN', { exact: true })).toHaveCount(1)
    await expect(tierSelector.getByText('KDV dahil')).toHaveCount(3)
    await expect(tierSelector.getByText('Fiyat / performans kombinasyonu')).toBeVisible()
    await expect(tierSelector.getByText('Aynı marka sistem bütünlüğü')).toBeVisible()
    await expect(tierSelector.getByText('En düşük toplam maliyet')).toBeVisible()

    const selectedTierPrice = await tierSelector
      .getByRole('radio', { name: /Dengeli/ })
      .locator('..')
      .locator('[data-tier-price]')
      .textContent()
    await expect(result.getByTestId('homepage-result-total')).toHaveText(selectedTierPrice?.trim() || '')

    const desktopColumns = await tierSelector.locator('[data-tier-grid]').evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.split(' ').length
    ))
    expect(desktopColumns).toBe(3)

    const balancedSubtotal = await result.getByTestId('homepage-result-subtotal').textContent()
    const balancedVat = await result.getByTestId('homepage-result-vat').textContent()
    const balancedTotal = await result.getByTestId('homepage-result-total').textContent()

    await balancedRadio.focus()
    await page.keyboard.press('ArrowRight')
    await expect(originalRadio).toBeChecked()
    await expect(result).toContainText('Orijinal Sistem')

    await tierSelector.locator('[data-tier-card]').filter({ hasText: 'Ekonomik' }).click()
    await expect(economicRadio).toBeChecked()
    await expect(balancedRadio).not.toBeChecked()
    await expect(result).toContainText('Ekonomik Sistem')
    await expect(result.getByTestId('homepage-result-subtotal')).not.toHaveText(balancedSubtotal || '')
    await expect(result.getByTestId('homepage-result-vat')).not.toHaveText(balancedVat || '')
    await expect(result.getByTestId('homepage-result-total')).not.toHaveText(balancedTotal || '')

    const detailsToggle = result.getByRole('button', { name: /Set içeriğini ve miktarları gör/ })
    await expect(detailsToggle).toHaveAttribute('aria-expanded', 'false')
    await detailsToggle.click()
    await expect(result.getByRole('button', { name: /Set içeriğini ve miktarları gizle/ })).toHaveAttribute('aria-expanded', 'true')
    const detailRows = result.getByTestId('homepage-set-details').locator('tbody tr')
    await expect(detailRows).toHaveCount(8)
    await expect(calculator).toHaveAttribute('data-state', 'calculated')
    await expect(calculator.getByRole('button', { name: 'Hesabı Güncelle' })).toBeVisible()
    await expect(result.getByRole('button', { name: "WhatsApp'ta Siparişi Başlat" })).toBeVisible()
  })

  test('iki mevcut sistem alternatifi masaüstünde iki dengeli kolona yayılır', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    await calculator.getByRole('combobox', { name: 'Malzeme' }).selectOption({ label: 'Optimix TR7.5' })
    await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
    await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill(VALID_AREA_M2)
    await calculator.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()

    const tierSelector = page.getByTestId('homepage-tier-selector')
    await expect(tierSelector).toHaveAttribute('data-tier-count', '2')
    await expect(tierSelector.getByRole('radio')).toHaveCount(2)
    const columns = await tierSelector.locator('[data-tier-grid]').evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.split(' ').length
    ))
    expect(columns).toBe(2)
  })

  test('mobil sıra H1, video ve hesaplayıcı olarak korunur', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const h1 = page.getByRole('heading', { level: 1 })
    const video = page.locator('figure video').first()
    const calculator = page.locator('[data-homepage-calculator]')

    const h1Box = await h1.boundingBox()
    const videoBox = await video.boundingBox()
    const calculatorBox = await calculator.boundingBox()
    expect(h1Box).not.toBeNull()
    expect(videoBox).not.toBeNull()
    expect(calculatorBox).not.toBeNull()
    expect(h1Box!.y).toBeLessThan(videoBox!.y)
    expect(videoBox!.y).toBeLessThan(calculatorBox!.y)
    await expect(page.getByRole('button', { name: "WhatsApp'ta Siparişi Başlat" })).toHaveCount(0)
  })

  test('hareket azaltma tercihinde hero videosu otomatik başlamaz', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForTimeout(1_000)

    const isPaused = await page.locator('figure video').first().evaluate((element) => (
      element as HTMLVideoElement
    ).paused)
    expect(isPaused).toBe(true)
  })

  test('WhatsApp siparişi mevcut teklif kaydı ve KVKK hattından geçer', async ({ page }) => {
    let quotePayload: Record<string, unknown> | null = null
    await page.addInitScript(() => {
      // LAN üzerindeki http://192.168… bağlantısında bazı mobil tarayıcılar
      // Web Crypto sunsa da secure-context API'si randomUUID'yi sunmaz.
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: true,
        value: undefined,
      })
      const target = window as typeof window & { __openedWhatsappUrl?: string }
      window.open = ((url?: string | URL) => {
        target.__openedWhatsappUrl = String(url || '')
        return null
      }) as typeof window.open
    })
    await page.route('**/api/quotes', async (route) => {
      quotePayload = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, quoteId: 991, outcome: 'created' }),
      })
    })

    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    // Gerçek regresyon: Bonus F 150 / 8 cm için 587,5 m² ihtiyaç,
    // paket hesabında 587,52 m² siparişe dönüşür. API'ye ham 587,5
    // gönderilirse tam kamyon doğrulaması siparişi yanlış reddeder.
    await calculator.getByRole('combobox', { name: 'Malzeme' }).selectOption({ label: 'Bonus F 150' })
    await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('8')
    await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill('587.5')
    await calculator.getByRole('button', { name: 'Avrupa Yakası' }).click()
    await calculator.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()

    const result = page.getByTestId('homepage-calculation-result')
    await result.getByRole('button', { name: "WhatsApp'ta Siparişi Başlat" }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: "Siparişi WhatsApp'ta Başlatın" })).toBeVisible()
    await dialog.locator('input[type="text"]').fill('E2E Sipariş')
    await dialog.locator('input[type="tel"]').fill('05321234567')
    await dialog.locator('#quoteWaKvkkConsent').check()
    await dialog.getByRole('button', { name: "WhatsApp'ta Siparişi Başlat" }).click()

    await expect(dialog).toBeHidden()
    expect(quotePayload).toMatchObject({
      submissionType: 'whatsapp_order',
      sourceChannel: 'wizard',
      kvkkConsent: true,
      materialType: 'tasyunu',
      modelName: 'F 150',
    })
    const submittedPayload = quotePayload as unknown as Record<string, unknown>
    const packageCount = Number(submittedPayload.packageCount)
    const packageSizeM2 = Number(submittedPayload.packageSizeM2)
    expect(Number(submittedPayload.areaM2)).toBeCloseTo(packageCount * packageSizeM2, 2)
    expect(Number(submittedPayload.areaM2)).toBeCloseTo(587.52, 2)
    const openedUrl = await page.evaluate(
      () => (window as typeof window & { __openedWhatsappUrl?: string }).__openedWhatsappUrl,
    )
    expect(openedUrl).toContain('https://wa.me/')
    const whatsappMessage = decodeURIComponent(String(openedUrl).split('text=')[1] || '')
    expect(whatsappMessage).toContain('8 kalem komple mantolama seti')
    expect(whatsappMessage).toContain('Bonus F 150 8 cm Taşyünü')
    expect(whatsappMessage).toContain('Dengeli Sistem')
    expect(whatsappMessage).toContain('İstanbul / Avrupa Yakası')
  })

  test('PDF teklifi güncel ana sayfa akışında kaydolur ve çift console hatası üretmez', async ({ page }) => {
    test.setTimeout(60_000)
    const pdfConsoleErrors: string[] = []
    let quotePayload: Record<string, unknown> | null = null
    let uploadCalls = 0

    page.on('console', (message) => {
      if (
        message.type() === 'error'
        && /PDF quote save|PDF teklif akışı|Katalog PDF teklif/u.test(message.text())
      ) {
        pdfConsoleErrors.push(message.text())
      }
    })
    await page.route('**/api/quotes', async (route) => {
      quotePayload = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          quoteId: 992,
          outcome: 'created',
          pdfUploadCapability: 'e2e-test-capability',
        }),
      })
    })
    await page.route('**/api/upload-pdf', async (route) => {
      uploadCalls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          signedUrl: 'https://example.test/private-signed-homepage-pdf',
          storagePath: '992/random.pdf',
          expiresInSeconds: 900,
        }),
      })
    })

    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    await calculator.getByRole('combobox', { name: 'Malzeme' }).selectOption(PRODUCT_VALUE)
    await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
    await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill(VALID_AREA_M2)
    await calculator.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()

    const result = page.getByTestId('homepage-calculation-result')
    await expect(result).toBeVisible({ timeout: 20_000 })
    await result.getByRole('button', { name: 'Teklif detayını indir' }).click()

    const modal = page.getByRole('dialog', { name: 'Teklif Bilgileri' })
    await modal.locator('input[name="relatedPerson"]').fill('Emrah Test')
    await modal.locator('input[name="phone"]').fill('05321234567')
    await modal.locator('#kvkkConsent').check()
    await modal.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' }).click()

    await expect(page.getByRole('dialog', { name: 'PDF teklifiniz hazır' })).toBeVisible({
      timeout: 30_000,
    })
    expect(quotePayload).toMatchObject({
      submissionType: 'pdf_quote',
      sourceChannel: 'wizard',
      kvkkConsent: true,
    })
    expect(uploadCalls).toBe(1)
    expect(pdfConsoleErrors).toEqual([])
  })

  test('düşük metraj gerçek tam kamyon değerine tek seçimle dönüşür', async ({ page }) => {
    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    await calculator.getByRole('combobox', { name: 'Malzeme' }).selectOption({ label: 'Bonus F 150 Pro' })
    await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
    await calculator.getByRole('button', { name: 'Anadolu Yakası' }).click()

    const amountInput = calculator.getByRole('spinbutton', { name: 'Miktar' })
    await amountInput.fill('500')
    const lorrySuggestion = calculator.getByRole('button', { name: '1 Kamyon · 967,68 m²' })
    await expect(lorrySuggestion).toBeVisible({ timeout: 15_000 })
    await expect(calculator.getByRole('button', { name: '1 TIR · 1.774,08 m²' })).toBeVisible()

    await lorrySuggestion.click()
    await expect(amountInput).toHaveValue('967.68')
    expect(await amountInput.evaluate(input => (input as HTMLInputElement).validity.valid)).toBe(true)

    const calculateButton = calculator.getByRole('button', { name: 'Fiyatımı Hesapla' })
    await expect(calculateButton).toBeEnabled()
    await calculateButton.click()
    const result = page.getByTestId('homepage-calculation-result')
    await expect(result).toBeVisible({ timeout: 20_000 })

    const tierSelector = result.getByTestId('homepage-tier-selector')
    const brandPairs = tierSelector.locator('[data-tier-brand-pair]')
    await expect(brandPairs).toHaveCount(3)
    await expect(brandPairs.locator('img')).toHaveCount(6)
    await expect(tierSelector.locator('[data-tier-card]').filter({ hasText: 'Ekonomik' })).toContainText('Bonus')
    await expect(tierSelector.locator('[data-tier-card]').filter({ hasText: 'Ekonomik' })).toContainText('TEKNO')
    await expect(tierSelector.locator('[data-tier-card]').filter({ hasText: 'Dengeli' })).toContainText('Optimix')
    await expect(tierSelector.locator('[data-tier-card]').filter({ hasText: 'Premium' })).toContainText('Expert')
  })

  test('EPS sonucu toz grubu koşulunu ve gerçek sekiz kalemi açıklar', async ({ page }) => {
    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    await calculator.getByRole('combobox', { name: 'Malzeme' }).selectOption({ label: 'Dalmaçyalı İdeal Carbon' })
    await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
    await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill('806.4')
    // İdeal Carbon 5 cm gerçek paket kapasitesi: 1 Kamyon = 1.120 m².
    // Eski 806,4 değeri genel kalınlık kaydından geliyor ve bu ürün için yanlıştı.
    await calculator.getByRole('button', { name: '1 Kamyon · 1.120 m²' }).click()
    await calculator.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()

    const result = page.getByTestId('homepage-calculation-result')
    await expect(result).toContainText('EPS Levha + Toz Grubu + Aksesuarlar')
    await expect(result).toContainText('Levha + toz grubu set koşulu sağlandı')
    await expect(result).toContainText('Nakliye fiyata dahil')
    await result.getByRole('button', { name: /Set içeriğini ve miktarları gör/ }).click()

    const details = result.getByTestId('homepage-set-details')
    await expect(details.locator('tbody tr')).toHaveCount(8)
    await expect(details).toContainText('Yapıştırıcı')
    await expect(details).toContainText('Sıva')
    await expect(details).toContainText('Mineral Kaplama')
  })

  test('kaldırılan eski ana sayfa katmanları render edilmez', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Önce ürünleri inceleyeyim')).toHaveCount(0)
    await expect(page.getByText('3 adımda doğru karar')).toHaveCount(0)
    await expect(page.getByText('Tek levha değil, komple mantolama sistemi.')).toHaveCount(0)
    await expect(page.getByText('1 TIR istiyorum')).toHaveCount(0)
    await expect(page.getByText('Proje ölçekli satış')).toHaveCount(0)
  })
})

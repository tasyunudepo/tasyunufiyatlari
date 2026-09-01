import { expect, test, type Page, type Request } from '@playwright/test'

const PRODUCT_PATH = '/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu'
const HOMEPAGE_PRODUCT_VALUE = 'tasyunu|1|SW035'
const HOMEPAGE_AREA_M2 = '1497.6'

async function completeWizard(page: Page) {
  await page.goto('/')
  const calculator = page.locator('[data-homepage-calculator]')
  const materialSelect = calculator.getByRole('combobox', { name: 'Malzeme' })

  // Güncel ana sayfa tek formdur. Dalmaçyalı SW035 ve tam TIR metrajı
  // açıkça seçilerek atomik teklif/idempotency/capability niyeti korunur.
  await expect(materialSelect).toBeEnabled({ timeout: 30_000 })
  await calculator.getByRole('combobox', { name: 'Teslim ili' }).selectOption({ label: 'İstanbul' })
  await materialSelect.selectOption(HOMEPAGE_PRODUCT_VALUE)
  await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
  await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill(HOMEPAGE_AREA_M2)
  await calculator.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()

  const result = page.getByTestId('homepage-calculation-result')
  await expect(result).toBeVisible({ timeout: 20_000 })
  await expect(result.getByRole('heading', { name: '8 Kalem Komple Mantolama Seti' })).toBeVisible()
  return result
}

async function fillPdfModal(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Teklif Bilgileri' })
  await dialog.locator('input[name="relatedPerson"]').fill('Emrah Test')
  await dialog.locator('input[name="phone"]').fill('05321234567')
  await dialog.locator('#kvkkConsent').check()
  return dialog
}

function successQuoteBody(quoteId: number) {
  return JSON.stringify({
    ok: true,
    quoteId,
    createdAt: '2026-07-13T00:00:00.000Z',
    outcome: 'created',
    pdfUploadCapability: 'e2e-test-capability',
  })
}

test.describe('kritik teklif akışları', () => {
  test('Wizard PDF: onay + idempotency + capability sonrası sade teslim kartı', async ({ page }) => {
    test.setTimeout(60_000)
    let quoteRequest: Request | null = null
    let uploadCalls = 0

    await page.route('**/api/quotes', async (route) => {
      quoteRequest = route.request()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: successQuoteBody(42),
      })
    })
    await page.route('**/api/upload-pdf', async (route) => {
      uploadCalls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          signedUrl: 'https://example.test/private-signed-pdf',
          storagePath: '42/random.pdf',
          expiresInSeconds: 900,
        }),
      })
    })

    const result = await completeWizard(page)
    await result.getByRole('button', { name: 'Teklif detayını indir' }).click()
    const modal = await fillPdfModal(page)
    await modal.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' }).click()

    const delivery = page.getByRole('dialog', { name: 'PDF teklifiniz hazır' })
    await expect(delivery).toBeVisible({ timeout: 30_000 })
    await expect(delivery.getByRole('link', { name: 'WhatsApp’ta aç' })).toBeVisible()
    await expect(delivery.getByRole('link', { name: 'E-postada aç' })).toBeVisible()
    await expect(delivery.getByRole('link', { name: 'PDF indir' })).toBeVisible()

    expect(uploadCalls).toBe(1)
    expect(quoteRequest).not.toBeNull()
    expect(quoteRequest!.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(await quoteRequest!.postDataJSON()).toMatchObject({
      kvkkConsent: true,
      submissionType: 'pdf_quote',
      sourceChannel: 'wizard',
    })
  })

  test('Wizard WhatsApp: kayıt başarılı olmadan WhatsApp’ı açmaz', async ({ page }) => {
    let quoteRequest: Request | null = null
    await page.addInitScript(() => {
      const target = window as typeof window & { __openedWhatsappUrl?: string }
      window.open = ((url?: string | URL) => {
        target.__openedWhatsappUrl = String(url || '')
        return null
      }) as typeof window.open
    })
    await page.route('**/api/quotes', async (route) => {
      quoteRequest = route.request()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: successQuoteBody(43),
      })
    })

    const result = await completeWizard(page)
    await result.getByRole('button', { name: "WhatsApp'ta Siparişi Başlat" }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: "Siparişi WhatsApp'ta Başlatın" })).toBeVisible()
    await dialog.locator('input[type="text"]').fill('Emrah Test')
    await dialog.locator('input[type="tel"]').fill('05321234567')
    await dialog.locator('#quoteWaKvkkConsent').check()
    await dialog.getByRole('button', { name: "WhatsApp'ta Siparişi Başlat" }).click()

    await expect(dialog).toBeHidden()
    expect(quoteRequest).not.toBeNull()
    expect(quoteRequest!.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(await quoteRequest!.postDataJSON()).toMatchObject({
      kvkkConsent: true,
      submissionType: 'whatsapp_order',
    })
    const openedUrl = await page.evaluate(
      () => (window as typeof window & { __openedWhatsappUrl?: string }).__openedWhatsappUrl,
    )
    expect(openedUrl).toContain('https://wa.me/')
    expect(decodeURIComponent(openedUrl || '')).toContain('Nakliye: fiyata dahil')
  })

  test('PDP PDF: API hatasında başarı kartı ve storage yan etkisi oluşmaz', async ({ page }) => {
    test.setTimeout(60_000)
    let uploadCalls = 0
    await page.route('**/api/quotes', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Teklif hizmeti geçici olarak kullanılamıyor.' }),
      })
    })
    await page.route('**/api/upload-pdf', async (route) => {
      uploadCalls += 1
      await route.abort()
    })

    await page.goto(PRODUCT_PATH)
    await page.getByRole('button', { name: 'Teklifimi hazırla →' }).click()
    const modal = await fillPdfModal(page)
    await modal.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' }).click()

    await expect(page.getByText('Teklif kaydı oluşturulamadı. Bilgilerinizi kontrol edip tekrar deneyin.')).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('dialog', { name: 'PDF teklifiniz hazır' })).toHaveCount(0)
    expect(uploadCalls).toBe(0)
  })

  test('PDP PDF: kayıt ve capability sonrası aynı teslim sözleşmesini gösterir', async ({ page }) => {
    test.setTimeout(60_000)
    let quoteRequest: Request | null = null
    let uploadCalls = 0

    await page.route('**/api/quotes', async (route) => {
      quoteRequest = route.request()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: successQuoteBody(44),
      })
    })
    await page.route('**/api/upload-pdf', async (route) => {
      uploadCalls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          signedUrl: 'https://example.test/private-signed-pdp-pdf',
          storagePath: '44/random.pdf',
          expiresInSeconds: 900,
        }),
      })
    })

    await page.goto(PRODUCT_PATH)
    await page.getByRole('button', { name: 'Teklifimi hazırla →' }).click()
    const modal = await fillPdfModal(page)
    await modal.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' }).click()

    const delivery = page.getByRole('dialog', { name: 'PDF teklifiniz hazır' })
    await expect(delivery).toBeVisible({ timeout: 30_000 })
    await expect(delivery.getByRole('link', { name: 'WhatsApp’ta aç' })).toBeVisible()
    await expect(delivery.getByRole('link', { name: 'E-postada aç' })).toBeVisible()
    await expect(delivery.getByRole('link', { name: 'PDF indir' })).toBeVisible()

    expect(uploadCalls).toBe(1)
    expect(quoteRequest).not.toBeNull()
    expect(quoteRequest!.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(await quoteRequest!.postDataJSON()).toMatchObject({
      kvkkConsent: true,
      submissionType: 'pdf_quote',
      sourceChannel: 'catalog',
    })
  })

  test('Bonus olmayan PDP iletişim kapısı: teklif öncesi WhatsApp ve telefon yayınlamaz', async ({ page }) => {
    await page.goto(PRODUCT_PATH)

    await expect(page.getByRole('button', { name: 'Teklifimi hazırla →' })).toBeVisible()
    await expect(page.getByRole('link', { name: /WhatsApp'tan teyit iste/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Telefonla konuş/i })).toHaveCount(0)
    expect(await page.locator('a[href^="https://wa.me/"]').count()).toBe(0)
    expect(await page.locator('a[href^="tel:"]').count()).toBe(0)
  })
})

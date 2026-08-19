import { expect, test, type Page, type Request } from '@playwright/test'

const PRODUCT_PATH = '/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu'

async function completeWizard(page: Page) {
  await page.goto('/')
  const wizard = page.locator('#mantolama-hesaplayici')

  // Bu akış Dalmaçyalı SW035 sayılarıyla kurgulandı; varsayılan marka
  // değişimlerinden (14 Temmuz 2026: Bonus varsayılan oldu) bağımsız
  // kalmak için marka açıkça seçilir. Test niyeti değişmedi: atomik
  // teklif kaydı + idempotency + capability akışı.
  await wizard.locator('button').filter({ hasText: 'Dalmaçyalı' }).first().click()

  await wizard.getByRole('button', { name: 'Kalınlık Seçimine Geç' }).click()
  await expect(wizard.getByText('Yalıtım Kalınlığını Seçin')).toBeVisible()
  await wizard.getByRole('button', { name: 'Konum Seçimine Geç' }).click()
  await expect(wizard.getByText('Teslimat İli')).toBeVisible()
  await wizard.locator('select').selectOption({ label: 'İstanbul' })
  await wizard.getByRole('button', { name: 'Metraj Gir' }).click()
  await expect(wizard.getByText('Sipariş metrajı')).toBeVisible()
  await wizard.getByRole('button', { name: '3 Teklifi Karşılaştır' }).click()
  await expect(
    page.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' }).first(),
  ).toBeVisible({ timeout: 15_000 })
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

    await completeWizard(page)
    await page.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' }).first().click()
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

    await completeWizard(page)
    await page.getByRole('button', { name: /WhatsApp'tan Teyit İste/i }).first().click()
    const form = page.locator('form:visible').filter({ hasText: "Mesajı WhatsApp'ta Aç" })
    await form.locator('input[type="text"]').fill('Emrah Test')
    await form.locator('input[type="tel"]').fill('05321234567')
    await form.locator('#quoteWaKvkkConsent').check()
    await form.getByRole('button', { name: "Mesajı WhatsApp'ta Aç" }).click()

    await expect(form).toBeHidden()
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
    await page.getByRole('button', { name: 'PDF teklifimi hazırla' }).click()
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
    await page.getByRole('button', { name: 'PDF teklifimi hazırla' }).click()
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

  test('PDP iletişim kapısı: teklif öncesi WhatsApp ve telefon yayınlamaz', async ({ page }) => {
    await page.goto(PRODUCT_PATH)

    await expect(page.getByRole('button', { name: 'PDF teklifimi hazırla' })).toBeVisible()
    await expect(page.getByRole('link', { name: /WhatsApp'tan teyit iste/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Telefonla konuş/i })).toHaveCount(0)
    expect(await page.locator('a[href^="https://wa.me/"]').count()).toBe(0)
    expect(await page.locator('a[href^="tel:"]').count()).toBe(0)
  })
})

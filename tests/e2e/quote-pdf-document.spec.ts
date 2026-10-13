import { readFile } from 'node:fs/promises'
import { inflateSync } from 'node:zlib'

import { expect, test, type Page } from '@playwright/test'

// Teklif PDF'i gerçek tarayıcıda zengin şablonla üretilir (13 Ekim 2026).
//
// Şablon resme çevrilemezse üretici sessizce düz yazılı yedek PDF'e düşer
// ve teslim kartı yine görünür; mevcut akış testleri bunu yakalamaz.
// Bu test indirilen dosyanın kendisine bakar: sayfa görüntüsü, ayrı basılan
// karekod ve tıklanır bağlantı alanları yedek PDF'te yoktur.
//
// Sayfa resim olduğu için yazı seçilemez; görünmez metin katmanı IBAN'ı
// kopyalanır, belgeyi aranır yapar. Katmanın varlığı da burada korunur.

const PRODUCT_PATH = '/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu'

async function mockQuoteApis(page: Page, quoteId: number) {
  await page.route('**/api/quotes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        quoteId,
        createdAt: '2026-10-13T00:00:00.000Z',
        outcome: 'created',
        pdfUploadCapability: 'e2e-test-capability',
      }),
    }),
  )
  await page.route('**/api/upload-pdf', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        signedUrl: 'https://example.test/private-signed-pdf',
        storagePath: `${quoteId}/random.pdf`,
        expiresInSeconds: 900,
      }),
    }),
  )
}

async function fillPdfModal(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Teklif Bilgileri' })
  const name = dialog.locator('input[name="relatedPerson"]')
  const phone = dialog.locator('input[name="phone"]')
  // Form açılırken alanlarını bir kez sıfırlar; değer yerinde kalana kadar yazılır.
  await expect(async () => {
    await name.fill('Emrah Test')
    await phone.fill('05321234567')
    await page.waitForTimeout(250)
    await expect(name).toHaveValue('Emrah Test')
  }).toPass({ timeout: 15_000 })
  await dialog.locator('#kvkkConsent').check()
  return dialog
}

async function downloadQuotePdf(page: Page, trigger: () => Promise<void>): Promise<string> {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 45_000 }), trigger()])
  const path = await download.path()
  return (await readFile(path)).toString('latin1')
}

/** Sıkıştırılmış sayfa içeriklerini açıp görünmez yazılan kelimeleri sayar. */
function textLayer(pdf: string) {
  let words = 0
  let invisible = false
  let compressedContent = false
  for (const match of pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string
    try {
      content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1')
    } catch {
      continue // görüntü akışı ya da sıkıştırılmamış içerik
    }
    compressedContent = true
    words += (content.match(/ Tj/g) ?? []).length
    if (/\b3 Tr\b/.test(content)) invisible = true
  }
  return { words, invisible, compressedContent, embeddedFont: pdf.includes('/FontFile2') }
}

function inspect(pdf: string) {
  const uris = [...pdf.matchAll(/\/URI \(([^)]*)\)/g)].map((m) => m[1])
  return {
    pages: (pdf.match(/\/Type \/Page[^s]/g) ?? []).length,
    images: (pdf.match(/\/Subtype \/Image/g) ?? []).length,
    uris,
    text: textLayer(pdf),
  }
}

test.describe('teklif PDF\'i zengin şablonla üretilir', () => {
  test('sihirbaz: sayfa görüntüleri, karekod ve bağlantı alanları PDF\'tedir', async ({ page }) => {
    test.setTimeout(90_000)
    const renderErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Rich PDF render failed')) renderErrors.push(message.text())
    })
    await mockQuoteApis(page, 42)

    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    const material = calculator.getByRole('combobox', { name: 'Malzeme' })
    await expect(material).toBeEnabled({ timeout: 30_000 })
    await calculator.getByRole('combobox', { name: 'Teslim ili' }).selectOption({ label: 'İstanbul' })
    await material.selectOption('tasyunu|1|SW035')
    await calculator.getByRole('combobox', { name: 'Kalınlık' }).selectOption('5')
    await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill('1497.6')
    await calculator.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()

    const result = page.getByTestId('homepage-calculation-result')
    await expect(result).toBeVisible({ timeout: 20_000 })
    await result.getByRole('button', { name: 'Teklif detayını indir' }).click()
    const modal = await fillPdfModal(page)

    const pdf = inspect(
      await downloadQuotePdf(page, () => modal.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' }).click()),
    )

    expect(renderErrors).toEqual([])
    // Her sayfa bir görüntü; karekod ayrıca keskin basılır.
    expect(pdf.pages).toBeGreaterThanOrEqual(1)
    expect(pdf.pages).toBeLessThanOrEqual(3)
    expect(pdf.images).toBe(pdf.pages + 1)
    // Görünmez metin katmanı: sekiz kalemli teklifte birkaç yüz kelime.
    expect(pdf.text.embeddedFont).toBe(true)
    // İndirilen kopyada sayfa içerikleri sıkıştırılmış olmalı (jsPDF ikinci yazımda filtreyi düşürüyordu).
    expect(pdf.text.compressedContent).toBe(true)
    expect(pdf.text.invisible).toBe(true)
    expect(pdf.text.words).toBeGreaterThan(250)
    // Sipariş düğmesi, karekod kutusu ve son satırdaki bağlantı WhatsApp'a gider.
    expect(pdf.uris.filter((uri) => uri.startsWith('https://wa.me/905435186988')).length).toBeGreaterThanOrEqual(3)
    expect(pdf.uris.some((uri) => uri.startsWith('tel:+905435186988'))).toBe(true)
    expect(pdf.uris.some((uri) => uri.startsWith('https://www.tasyunufiyatlari.com'))).toBe(true)
    expect(pdf.uris.some((uri) => uri.startsWith('https://www.ozeryapiinsaat.com'))).toBe(true)
    // Alçı ve alçıpan bağlantıları kaynağı PDF olarak etiketler.
    const offers = pdf.uris.filter((uri) => uri.includes('utm_content=pdf'))
    expect(offers.some((uri) => uri.startsWith('https://alcifiyatlari.com/'))).toBe(true)
    expect(offers.some((uri) => uri.startsWith('https://alcipanfiyatlari.net/'))).toBe(true)
  })

  test('ürün sayfası: tek kalemli teklif tek sayfadır', async ({ page }) => {
    test.setTimeout(90_000)
    const renderErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Rich PDF render failed')) renderErrors.push(message.text())
    })
    await mockQuoteApis(page, 44)

    await page.goto(PRODUCT_PATH)
    await page.getByRole('button', { name: 'Teklifimi hazırla →' }).click()
    const modal = await fillPdfModal(page)

    const pdf = inspect(
      await downloadQuotePdf(page, () => modal.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' }).click()),
    )

    expect(renderErrors).toEqual([])
    expect(pdf.pages).toBe(1)
    expect(pdf.images).toBe(2)
    expect(pdf.text.invisible).toBe(true)
    expect(pdf.text.words).toBeGreaterThan(120)
    expect(pdf.uris.filter((uri) => uri.startsWith('https://wa.me/905435186988')).length).toBeGreaterThanOrEqual(2)
    expect(pdf.uris.filter((uri) => uri.includes('utm_content=pdf')).length).toBe(2)
  })
})

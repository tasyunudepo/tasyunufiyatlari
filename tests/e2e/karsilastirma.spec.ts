import { expect, test } from '@playwright/test'

// Sprint 2 — Karşılaştırma Merkezi. Kilitli kararlar: 8 ürün, föy
// etiketleri, sözlü beyan etiketi, "Pro üstünlük değil", 150 sayfası
// ana tablonun filtreli görünümü, fiyatlar gerçek hesaptan.

test.describe('Karşılaştırma Merkezi', () => {
  test('karşılaştırma sayfasında proje ölçeği modalı karar akışını kesmez', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('tasyunu_sales_intent_v1')
    })

    await page.goto('/tasyunu-karsilastir')

    // Gate açılışı setTimeout(0) ile ertelendiği için yokluk iddiasını ilk
    // paint'te değil, client effect'leri çalıştıktan sonra doğrula.
    await page.waitForTimeout(250)
    await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Teknik karşılaştırma' })).toBeVisible()
  })

  test('genel sayfa: teknik tablo + aynı koşulda canlı fiyatlar', async ({ page }) => {
    await page.goto('/tasyunu-karsilastir')

    // Teknik tablo: 8 satır, kaynak etiketleri.
    await expect(page.getByRole('heading', { name: 'Teknik karşılaştırma' })).toBeVisible()
    const technicalTable = page.getByTestId('comparison-technical-table')
    await expect(technicalTable.locator('tbody tr')).toHaveCount(8)
    expect(await page.getByText('Föy beyanı').count()).toBeGreaterThanOrEqual(5)
    expect(await page.getByText('Üretici sözlü beyanı — değişken').count()).toBeGreaterThanOrEqual(3)

    // Ticari kıyas: İstanbul + Avrupa varsayılan, 5 cm; fiyat matematiğinin
    // kuruş sabitleri unit testte korunur, bu E2E değişebilir canlı veriyi
    // değil fiyat yüzeyinin durumunu ve reaktivitesini doğrular.
    const pricing = page.getByTestId('comparison-pricing')
    const f150 = pricing.getByTestId('comparison-price-bonus-premium-f-150')
    const hd150 = pricing.getByTestId('comparison-price-expert-hd150')
    await expect(f150.getByTestId('comparison-unit-price')).toContainText('₺/m²', { timeout: 20_000 })
    await expect(hd150.getByTestId('comparison-unit-price')).toContainText('₺/m²', { timeout: 20_000 })
    await expect(pricing.getByText(/Tam araç levha fiyatı/)).toBeVisible()
    await expect(f150.getByText('KDV hariç · Tam araçta nakliye fiyata dahildir')).toBeVisible()

    // Kalınlık değişince fiyatlar yeniden hesaplanır (5 cm fiyatı kaybolur).
    const initialF150Price = await f150.getByTestId('comparison-unit-price').textContent()
    await pricing.getByRole('button', { name: '8 cm', exact: true }).click()
    await expect(f150.getByTestId('comparison-unit-price')).not.toHaveText(initialF150Price ?? '', { timeout: 20_000 })
  })

  test('mobil teknik kıyas karar kartları taşmadan bütün temel verileri gösterir', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/tasyunu-karsilastir')

    const cards = page.getByTestId('comparison-technical-cards')
    const table = page.getByTestId('comparison-technical-table')
    await expect(cards).toBeVisible()
    await expect(table).toBeHidden()
    await expect(cards.locator('[data-product-key]')).toHaveCount(8)

    const f150 = page.getByTestId('comparison-technical-card-bonus-premium-f-150')
    await expect(f150).toBeVisible()
    for (const label of [
      'Yoğunluk',
      'Isı iletkenliği',
      'Yüzeye dik çekme',
      'Kalınlık aralığı',
      'Basma dayanımı',
    ]) {
      await expect(f150.getByText(label, { exact: true })).toBeVisible()
    }
    await expect(
      f150.locator('span').filter({ hasText: /^Föy beyanı$/ }),
    ).toBeVisible()
    const factValues = f150.locator('dl').first().locator('dd')
    await expect(factValues).toHaveCount(5)
    const expectedFactValues = [
      '150 kg/m³ (±%10)',
      '0,036–0,040 W/mK (kalınlığa göre)',
      '15 kPa',
      '2–13 cm',
      '40–70 kPa (kalınlığa göre; ince kalınlıkta NPD)',
    ]
    for (const [index, value] of expectedFactValues.entries()) {
      await expect(factValues.nth(index)).toContainText(value)
    }
    await expect(
      page
        .getByTestId('comparison-technical-card-fawori-optimix-tr75')
        .locator('span')
        .filter({ hasText: /^Üretici sözlü beyanı — değişken$/ }),
    ).toBeVisible()

    const summary = f150.locator('summary')
    await summary.focus()
    await summary.press('Enter')
    await expect(f150.locator('details')).toHaveAttribute('open', '')
    await expect(f150.getByText('Yangın sınıfı', { exact: true })).toBeVisible()
    await expect(f150.getByText('Kaynak tarihi', { exact: true })).toBeVisible()

    for (const width of [320, 375, 430, 767]) {
      await page.setViewportSize({ width, height: 844 })
      await expect.poll(() => page.evaluate(() => (
        document.documentElement.scrollWidth
        <= document.documentElement.clientWidth + 1
      ))).toBe(true)
    }

    await page.setViewportSize({ width: 768, height: 844 })
    await expect(table).toBeVisible()
    await expect(cards).toBeHidden()
  })

  test('fiyat servisi hatasında sorun ile yeniden deneme yolunu ayırır', async ({ page }) => {
    await page.route('**/api/bonus-price?*', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Geçici servis hatası' }),
      })
    })

    await page.goto('/tasyunu-karsilastir')

    const pricing = page.getByTestId('comparison-pricing')
    await expect(pricing.getByRole('alert')).toContainText('Fiyat verilerinin bir bölümü alınamadı')
    await expect(pricing.getByRole('button', { name: 'Fiyatları yeniden dene' })).toBeVisible()
    await expect(
      pricing.getByTestId('comparison-price-bonus-premium-f-150').getByText('fiyat alınamadı'),
    ).toBeVisible()
  })

  test('150 sayfası: föy-150 ürünler önce, nötr yoğunluk uyarısı', async ({ page }) => {
    await page.goto('/tasyunu-yogunluk/150-kg-m3')
    await expect(page.getByText(/daha iyi ısı yalıtımı iddiası değildir/)).toBeVisible()
    const firstThree = await page
      .getByTestId('comparison-technical-table')
      .locator('tbody tr td:first-child')
      .allTextContents()
    expect(firstThree[0]).toContain('Bonus Premium F 150')
    expect(firstThree[1]).toContain('F 150 Pro')
    expect(firstThree[2]).toContain('HD150')
  })

  test('PDP çapraz linki karşılaştırma merkezine gider', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/expert-hd150-tasyunu')
    if (response?.status() === 404) {
      test.skip(true, 'HD150 PDP yok.')
      return
    }
    await page.getByRole('link', { name: /mantolama alternatiflerini karşılaştır/ }).click()
    await page.waitForURL(/tasyunu-karsilastir/)
    await expect(page.getByRole('heading', { name: 'Teknik karşılaştırma' })).toBeVisible({ timeout: 20_000 })
  })

  test('kategori ve ana hesaplayıcı karşılaştırmayı bağlamsal olarak görünür kılar', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha')
    await expect(page.getByRole('link', { name: '8 mantolama levhasını karşılaştır' })).toHaveAttribute(
      'href',
      '/tasyunu-karsilastir?entry=category',
    )

    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    await expect(calculator.getByRole('link', { name: 'Levhaları karşılaştır' })).toHaveAttribute(
      'href',
      '/tasyunu-karsilastir?entry=wizard',
    )
  })

  test('satır CTA’sı şehir, yaka, kalınlık ve tam ürün modelini hesaplayıcıya taşır', async ({ page }) => {
    let quotePayload: Record<string, unknown> | null = null
    await page.addInitScript(() => {
      window.open = (() => null) as typeof window.open
    })
    await page.route('**/api/quotes', async (route) => {
      quotePayload = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, quoteId: 993, outcome: 'created' }),
      })
    })

    await page.goto('/tasyunu-karsilastir?entry=category')

    const pricing = page.getByTestId('comparison-pricing')
    await pricing.getByLabel('Teslimat şehri').selectOption({ label: 'Ankara' })
    await pricing.getByRole('button', { name: '8 cm', exact: true }).click()

    const productRow = pricing.getByTestId('comparison-price-bonus-premium-f-150')
    await productRow.getByRole('link', { name: /Komple set hesapla/ }).click()

    await page.waitForURL(/\/#mantolama-hesaplayici$/)
    const calculator = page.locator('[data-homepage-calculator]')
    await expect(calculator.getByLabel('Teslim ili')).toHaveValue('6')
    await expect(calculator.getByLabel('Malzeme').locator('option:checked')).toHaveText('Bonus F 150')
    await expect(calculator.getByLabel('Kalınlık')).toHaveValue('8')

    await calculator.getByRole('spinbutton', { name: 'Miktar' }).fill('587.5')
    await calculator.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()
    const result = page.getByTestId('homepage-calculation-result')
    await expect(result).toBeVisible({ timeout: 20_000 })
    await result.getByRole('button', { name: "WhatsApp'ta Siparişi Başlat" }).click()

    const dialog = page.getByRole('dialog')
    await dialog.locator('input[type="text"]').fill('Kıyaslama E2E')
    await dialog.locator('input[type="tel"]').fill('05321234567')
    await dialog.locator('#quoteWaKvkkConsent').check()
    await dialog.getByRole('button', { name: "WhatsApp'ta Siparişi Başlat" }).click()
    await expect(dialog).toBeHidden()

    expect(quotePayload).not.toBeNull()
    const submitted = quotePayload as unknown as Record<string, unknown>
    expect(submitted).toMatchObject({
      sourceChannel: 'comparison',
      submissionType: 'whatsapp_order',
      modelName: 'F 150',
      cityCode: '6',
      thicknessCm: 8,
    })
    expect(submitted.comparisonSessionId).toMatch(/^cmp_[A-Za-z0-9]+_[A-Za-z0-9]+$/)
    const packageItems = submitted.packageItems as Record<string, unknown>
    const attribution = packageItems.attribution as Record<string, unknown>
    expect(attribution).toMatchObject({
      entry_surface: 'comparison',
      comparison_session_id: submitted.comparisonSessionId,
    })
  })
})

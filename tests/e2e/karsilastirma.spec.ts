import { expect, test, type Locator, type Page } from '@playwright/test'

// Sprint 2 — Karşılaştırma Merkezi. Kilitli kararlar: 8 ürün, föy
// etiketleri, sözlü beyan etiketi, "Pro üstünlük değil", 150 sayfası
// ana tablonun filtreli görünümü, fiyatlar gerçek hesaptan.
//
// 14 Ekim 2026 (Emrah onayı, "A düzeni"): teknik tablo ile fiyat listesi tek
// tabloda birleşti; ana fiyat 1 kamyon m² fiyatı (ürün sayfasıyla aynı hesap),
// yanında en az sipariş (1 kamyon m² ve tutarı); yeşil = sütunda en iyi değer;
// sıralama düğmeleri; açık zemin. Davranış kabulleri korunur: canlı fiyat,
// kalınlıkla yeniden hesap, hata/yeniden deneme, 150 sırası, hesaplayıcıya taşıma.

type GtagCall = [string, string, Record<string, unknown>]

async function events(page: Page, name: string): Promise<GtagCall[]> {
  const calls = await page.evaluate(() =>
    ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((entry) => Array.from(entry)),
  )
  return (calls as GtagCall[]).filter((call) => call[0] === 'event' && call[1] === name)
}

const parseTl = (text: string | null) => {
  const match = (text ?? '').match(/(\d{1,3}(?:\.\d{3})*,\d{2})/)
  return match ? Number(match[1].replace(/\./g, '').replace(',', '.')) : null
}

async function waitForPrices(table: Locator) {
  await expect(table.getByText('hesaplanıyor…')).toHaveCount(0, { timeout: 20_000 })
}

test.describe('Karşılaştırma Merkezi', () => {
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

  test('karşılaştırma sayfasında proje ölçeği modalı karar akışını kesmez', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('tasyunu_sales_intent_v1')
    })

    await page.goto('/tasyunu-karsilastir')

    // Gate açılışı setTimeout(0) ile ertelendiği için yokluk iddiasını ilk
    // paint'te değil, client effect'leri çalıştıktan sonra doğrula.
    await page.waitForTimeout(250)
    await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Aynı koşulda fiyat ve teknik değerler' })).toBeVisible()
  })

  test('genel sayfa: tek tabloda föy değerleri, 1 kamyon fiyatı ve en az sipariş', async ({ page }) => {
    await page.goto('/tasyunu-karsilastir')

    await expect(page.getByRole('heading', { name: 'Aynı koşulda fiyat ve teknik değerler' })).toBeVisible()
    await expect(page.getByTestId('minimum-order-banner')).toContainText('En az sipariş: 1 tam kamyon')

    const pricing = page.getByTestId('comparison-pricing')
    const table = pricing.getByTestId('comparison-table')
    await expect(table).toBeVisible()
    await expect(table.locator('tbody tr')).toHaveCount(8)
    // Yangın ve kalınlık aralığı sütunu yok; yerine tek satır bilgi.
    await expect(table.locator('thead th')).toHaveCount(8)
    await expect(table.locator('thead')).not.toContainText('Yangın')
    await expect(pricing.getByText(/hepsi A1 \(yanmaz\) sınıfındadır/)).toBeVisible()
    // Sözlü beyan etiketi kaybolmaz: hücrede yıldız + ekran okuyucu metni, dipnotta açık metin.
    expect(await table.getByText('(üretici sözlü beyanı — değişken)').count()).toBeGreaterThanOrEqual(3)
    await expect(pricing.getByText(/föyde yoktur: Üretici sözlü beyanı — değişken/)).toBeVisible()

    // İstanbul + Avrupa varsayılan, 5 cm; kuruş sabitleri unit testte korunur,
    // bu E2E fiyat yüzeyinin durumunu ve reaktivitesini doğrular.
    const f150 = table.getByTestId('comparison-row-bonus-premium-f-150')
    const hd150 = table.getByTestId('comparison-row-expert-hd150')
    await expect(f150.getByTestId('comparison-unit-price')).toContainText('₺/m²', { timeout: 20_000 })
    await expect(hd150.getByTestId('comparison-unit-price')).toContainText('₺/m²', { timeout: 20_000 })
    await expect(pricing.getByText(/m² fiyatı 1 kamyon siparişinde · KDV hariç · Tam araçta nakliye fiyata dahildir/)).toBeVisible()
    // En az sipariş sütunu: 1 kamyonun tutarı ve metrajı.
    await expect(hd150.getByText(/^\d{1,3}(\.\d{3})* ₺$/)).toBeVisible()
    await expect(hd150.getByText(/^\d+(,\d)? m²$/)).toBeVisible()
    await expect(hd150).toContainText('TIR:')

    // En iyi değer işareti (yoğunluk hariç): F 150 dik çekme 15 ve basma 40, SW035 ısı iletkenliği 0,035.
    expect(await f150.getByText('(en iyi değer)').count()).toBeGreaterThanOrEqual(2)
    await expect(table.getByTestId('comparison-row-dalmacyali-sw035').getByText('(en iyi değer)').first()).toBeAttached()

    // Varsayılan sıra fiyat: m² fiyatları yukarıdan aşağı artar, fiyatı olmayan en altta.
    await waitForPrices(table)
    await expect(pricing.getByRole('button', { name: 'Fiyat', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const prices = (await table.locator('tbody tr').evaluateAll((rows) =>
      rows.map((row) => row.querySelector('[data-testid="comparison-unit-price"]')?.textContent ?? null),
    )).map(parseTl)
    const known = prices.filter((value): value is number => value !== null)
    expect(known.length).toBeGreaterThanOrEqual(6)
    expect(known).toEqual([...known].sort((a, b) => a - b))
    expect(prices.slice(0, known.length).every((value) => value !== null)).toBe(true)

    // Kalınlık değişince fiyatlar yeniden hesaplanır (5 cm fiyatı kaybolur).
    const initialF150Price = await f150.getByTestId('comparison-unit-price').textContent()
    await pricing.getByRole('button', { name: '8 cm', exact: true }).click()
    await expect(f150.getByTestId('comparison-unit-price')).not.toHaveText(initialF150Price ?? '', { timeout: 20_000 })

    // Föyün 30 mm notu 3 cm seçilince hücrede görünür (editör bulgusu, 14 Ekim); başka kalınlıkta görünmez.
    await expect(table.getByText("3 cm'de değer farklılaşabilir (föy)")).toHaveCount(0)
    await pricing.getByRole('button', { name: '3 cm', exact: true }).click()
    await expect(table.getByTestId('comparison-row-dalmacyali-sw035')).toContainText("3 cm'de değer farklılaşabilir (föy)")
    await expect(f150).not.toContainText("3 cm'de değer farklılaşabilir")
  })

  test('sıralama düğmesi tabloyu yeniden dizer ve olayı sayar', async ({ page }) => {
    await page.goto('/tasyunu-karsilastir?entry=direct')
    const pricing = page.getByTestId('comparison-pricing')
    const table = pricing.getByTestId('comparison-table')
    await waitForPrices(table)

    await pricing.getByRole('button', { name: 'Isı iletkenliği', exact: true }).click()
    await expect(pricing.getByRole('button', { name: 'Isı iletkenliği', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(table.locator('tbody tr').first().locator('td').nth(1)).toContainText('0,035')

    await pricing.getByRole('button', { name: 'Basma dayanımı', exact: true }).click()
    await expect(table.locator('tbody tr').first().locator('td').nth(3)).toContainText('40')

    await expect.poll(async () => (await events(page, 'Karsilastirma_Siralandi')).length).toBe(2)
    const [first, second] = await events(page, 'Karsilastirma_Siralandi')
    expect(first[2]).toMatchObject({ sort_key: 'isi_iletkenligi', thickness_cm: 5, surface: 'genel', entry_placement: 'direct' })
    expect(second[2]).toMatchObject({ sort_key: 'basma' })
  })

  test('kamyon fiyatı ürün sayfasındaki 1 Kamyon fiyatıyla aynıdır', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu/10-cm')
    test.skip(response?.status() === 404, 'SW035 10 cm sayfası yok')
    const lorryCard = page.getByTestId('pdp-commercial-vehicle-card').filter({ hasText: '1 Kamyon' }).first()
    await expect(lorryCard).toContainText('₺/m²', { timeout: 20_000 })
    const pdpPrice = parseTl(await lorryCard.getByText(/₺\/m²/).textContent())
    expect(pdpPrice).not.toBeNull()

    await page.goto('/tasyunu-karsilastir?entry=pdp_kalinlik&kalinlik=10&focus=SW035')
    const row = page.getByTestId('comparison-table').getByTestId('comparison-row-dalmacyali-sw035')
    await expect(row).toHaveAttribute('data-focused', 'true')
    await expect(row.getByTestId('comparison-unit-price')).toContainText('₺/m²', { timeout: 20_000 })
    expect(parseTl(await row.getByTestId('comparison-unit-price').textContent())).toBe(pdpPrice)
  })

  test('mobil kartlar taşmadan fiyatı, en az siparişi ve föy değerlerini gösterir', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/tasyunu-karsilastir')

    const cards = page.getByTestId('comparison-cards')
    const table = page.getByTestId('comparison-table')
    await expect(cards).toBeVisible()
    await expect(table).toBeHidden()
    await expect(cards.locator('[data-product-key]')).toHaveCount(8)

    const f150 = page.getByTestId('comparison-card-bonus-premium-f-150')
    await expect(f150).toBeVisible()
    for (const label of ['Yoğunluk', 'Isı iletkenliği', 'Dik çekme', 'Basma']) {
      await expect(f150.locator('dt').filter({ hasText: label })).toBeVisible()
    }
    const factValues = f150.locator('dl').first().locator('dd')
    await expect(factValues).toHaveCount(4)
    for (const [index, value] of ['150 kg/m³ (±%10)', '0,036–0,040', '15 kPa', '40–70 kPa'].entries()) {
      await expect(factValues.nth(index)).toContainText(value)
    }
    await expect(f150.getByTestId('comparison-unit-price')).toContainText('₺/m²', { timeout: 20_000 })
    await expect(f150).toContainText('En az sipariş 1 kamyon:')
    await expect(
      page.getByTestId('comparison-card-fawori-optimix-tr75').getByText('(üretici sözlü beyanı — değişken)'),
    ).toBeAttached()

    const notes = page.locator('details').filter({ hasText: 'Föy notları ve kaynak tarihleri' })
    const summary = notes.locator('summary')
    await summary.focus()
    await summary.press('Enter')
    await expect(notes).toHaveAttribute('open', '')
    await expect(notes.getByText(/Kaynak tarihi/).first()).toBeVisible()
    await expect(notes).toContainText('Basma: kalınlığa göre; ince kalınlıkta NPD')

    for (const width of [320, 375, 430, 767, 820, 1023]) {
      await page.setViewportSize({ width, height: 844 })
      await expect.poll(() => page.evaluate(() => (
        document.documentElement.scrollWidth
        <= document.documentElement.clientWidth + 1
      ))).toBe(true)
    }

    await page.setViewportSize({ width: 1024, height: 844 })
    await expect(table).toBeVisible()
    await expect(cards).toBeHidden()
    await expect.poll(() => table.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
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
      pricing.getByTestId('comparison-row-bonus-premium-f-150').getByText('fiyat alınamadı'),
    ).toBeVisible()
  })

  test('150 sayfası: yalnız föy beyanlı 150\'likler, nötr yoğunluk uyarısı', async ({ page }) => {
    // 14 Ekim 2026 (Emrah): 150 sayfasında öteki yoğunluklar yer almaz (önce bağlam olarak alttaydı).
    await page.goto('/tasyunu-yogunluk/150-kg-m3')
    await expect(page.getByRole('heading', { level: 1, name: '150 yoğunluk taş yünü fiyatları' })).toBeVisible()
    await expect(page.getByText(/daha iyi ısı yalıtımı iddiası değildir/)).toBeVisible()
    const table = page.getByTestId('comparison-table')
    await expect(table.locator('tbody tr')).toHaveCount(3)
    const keys = await table.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-product-key')))
    expect([...keys].sort()).toEqual(['bonus-premium-f-150', 'bonus-premium-f-150-pro', 'expert-hd150'])
    await expect(page.getByTestId('comparison-cards').locator('[data-product-key]')).toHaveCount(3)
  })

  test('PDP çapraz linki karşılaştırma merkezine gider', async ({ page }) => {
    const response = await page.goto('/urunler/tasyunu-levha/expert-hd150-tasyunu')
    if (response?.status() === 404) {
      test.skip(true, 'HD150 PDP yok.')
      return
    }
    await page.getByRole('link', { name: /Diğer taşyünü levhalarla karşılaştır/ }).click()
    await page.waitForURL(/tasyunu-karsilastir/)
    await expect(page.getByRole('heading', { name: 'Aynı koşulda fiyat ve teknik değerler' })).toBeVisible({ timeout: 20_000 })
  })

  test('kategori ve ana hesaplayıcı karşılaştırmayı bağlamsal olarak görünür kılar', async ({ page }) => {
    await page.goto('/urunler/tasyunu-levha')
    // 14 Ekim 2026: bağlantı adresleri temiz; giriş yeri olayda yine ayrı sayılır.
    await expect(page.getByRole('link', { name: '8 mantolama levhasını karşılaştır' })).toHaveAttribute(
      'href',
      '/tasyunu-karsilastir',
    )

    await page.goto('/')
    const calculator = page.locator('[data-homepage-calculator]')
    const wizardLink = calculator.getByRole('link', { name: 'Levhaları karşılaştır' })
    await expect(wizardLink).toHaveAttribute('href', '/tasyunu-karsilastir')
    await wizardLink.click()
    await page.waitForURL(/\/tasyunu-karsilastir$/)
    await expect.poll(async () => (await events(page, 'Karsilastirma_Acildi')).length).toBeGreaterThanOrEqual(1)
    for (const opened of await events(page, 'Karsilastirma_Acildi')) {
      expect(opened[2]).toMatchObject({ entry_placement: 'wizard' })
    }
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

    const productRow = pricing.getByTestId('comparison-row-bonus-premium-f-150')
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
      comparison_route: 'all_products',
    })
  })
})

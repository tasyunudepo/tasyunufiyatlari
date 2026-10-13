import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

// Kardeş satış kanalları ve Kiralık Jeneratör bağlantıları.
// Karar: reports/capraz-satis-seo-geo-2026-10-09/yuvarlak-masa.md (13 Ekim 2026)
// Plan: docs/verification/PLAN-capraz-satis-paketi-2026-10-13.md

const SW035 = '/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu'
const ALCI = 'https://alcifiyatlari.com/urun-kategori/makina-alcisi/'
const ALCIPAN = 'https://alcipanfiyatlari.net/urunler/alcipan-fiyatlari/'
const GAZBETON = 'https://gazbetonfiyatlari.com/'
const GENERATOR_HOME = 'https://www.xn--kiralkjeneratr-7pb94g.com/'
const GENERATOR_SITE_USE = 'https://www.xn--kiralkjeneratr-7pb94g.com/kullanim-alanlari/santiye'

type GtagCall = [string, string, Record<string, unknown>]

/**
 * Sitenin gtag'i çağrıları `dataLayer`'a `arguments` nesnesi olarak yazar
 * (components/analytics/GoogleAnalytics.tsx); olaylar oradan okunur.
 */
async function portfolioEvents(page: Page): Promise<GtagCall[]> {
  const calls = await page.evaluate(() =>
    ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((entry) =>
      Array.from(entry),
    ),
  )
  return (calls as GtagCall[]).filter(
    (call) => call[0] === 'event' && String(call[1]).startsWith('portfolio_offer_'),
  )
}

test.describe('ürün sayfasında alçı ve alçıpan bloğu', () => {
  for (const thickness of ['5-cm', '8-cm', '10-cm']) {
    test(`AC-201: SW035 ${thickness} sunucu HTML'i düz bağlantıları taşır`, async ({ request }) => {
      const response = await request.get(`${SW035}/${thickness}`)
      expect(response.ok()).toBe(true)
      const html = await response.text()

      expect(html).toContain('Alçı ve alçıpan da lazım mı?')
      for (const href of [ALCI, ALCIPAN]) {
        const anchor = html.match(new RegExp(`<a[^>]*href="${href.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"[^>]*>`))
        expect(anchor, href).not.toBeNull()
        expect(anchor?.[0]).not.toMatch(/nofollow|noreferrer/)
        expect(anchor?.[0]).not.toContain('utm_')
      }
      expect(html).not.toContain('jeneratr-7pb94g.com')
    })
  }

  test('AC-202: listede olmayan ürün sayfasında blok yoktur', async ({ request }) => {
    for (const path of [`${SW035}/3-cm`, SW035, '/urunler/tasyunu-levha/expert-hd150-tasyunu/10-cm']) {
      const html = await (await request.get(path)).text()
      expect(html, path).not.toContain('Alçı ve alçıpan da lazım mı?')
      expect(html, path).not.toContain('alcifiyatlari.com')
    }
  })

  test('AC-203/204: kartlar fiyat taşır ve ana teklif eyleminden sonra gelir', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${SW035}/10-cm`)

    const block = page.getByTestId('material-offers-pdp')
    await expect(block).toBeVisible()
    await expect(block).toContainText('1 TIR 129.366 ₺')
    await expect(block).toContainText('750 torba · torbası 172,49 ₺')
    await expect(block).toContainText('(35 kg)')
    await expect(block).toContainText('59,77 ₺/m²')
    await expect(block).toContainText('KDV hariç')
    await expect(block).toContainText('nakliye ve KDV dahil')
    await expect(block).toContainText('Liste tarihi')

    const cta = page.getByRole('button', { name: /PDF teklifimi hazırla|Teklifimi hazırla/ }).first()
    await expect(cta).toBeVisible()
    const ctaBox = await cta.boundingBox()
    const blockBox = await block.boundingBox()
    expect(ctaBox && blockBox && ctaBox.y + ctaBox.height <= blockBox.y).toBe(true)

    // Blok sayfanın son içerik bölümüdür: altında yalnız footer vardır.
    const footerBox = await page.locator('footer').boundingBox()
    expect(blockBox && footerBox && blockBox.y < footerBox.y).toBe(true)

    // 390 px'te yatay taşma yok.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('AC-208: görünüm bir kez, tıklama hedefiyle birlikte ölçülür; gezinme engellenmez', async ({ page, context }) => {
    await page.goto(`${SW035}/10-cm`)

    expect(await portfolioEvents(page)).toEqual([])

    const block = page.getByTestId('material-offers-pdp')
    await block.scrollIntoViewIfNeeded()
    await expect.poll(async () => (await portfolioEvents(page)).length).toBe(1)
    const [view] = await portfolioEvents(page)
    expect(view[1]).toBe('portfolio_offer_view')
    expect(view[2]).toMatchObject({ placement: 'pdp' })

    // Hedef siteye gerçekten gitmeden yeni sekmenin açıldığını doğrula.
    await context.route(/alcifiyatlari\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>hedef</title>' }))
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      block.getByRole('link', { name: 'Alçı fiyatlarını gör' }).click(),
    ])
    expect(popup.url()).toBe(ALCI)
    await popup.close()

    const events = await portfolioEvents(page)
    expect(events.map((event) => event[1])).toEqual(['portfolio_offer_view', 'portfolio_offer_click'])
    expect(events[1][2]).toMatchObject({ offer: 'alci', placement: 'pdp', target_host: 'alcifiyatlari.com' })
    // Kişisel veri yok: yalnız kategorik alanlar.
    expect(Object.keys(events[1][2]).sort()).toEqual(['offer', 'page_path', 'placement', 'send_to', 'target_host'])
  })
})

test.describe('satış kanalları ve Kiralık Jeneratör', () => {
  test('AC-207: ana sayfa ve hakkımızda üç kanalı düz bağlantıyla verir, jeneratörü vermez', async ({ request }) => {
    for (const path of ['/', '/hakkimizda']) {
      const html = await (await request.get(path)).text()
      const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'))
      for (const href of [ALCI, ALCIPAN, GAZBETON]) {
        expect(main, `${path} ${href}`).toContain(`href="${href}"`)
      }
      expect(main, path).not.toContain('jenerat')
      expect(main, path).not.toMatch(/grup siteleri|web projeleri/i)
    }
    const about = await (await request.get('/hakkimizda')).text()
    expect(about).toContain('id="kanallar"')
  })

  test('AC-105: footer Kiralık Jeneratör bağlantısı site içi sayfaya gider', async ({ page }) => {
    await page.goto(`${SW035}/10-cm`)
    const link = page.locator('footer').getByRole('link', { name: 'Kiralık Jeneratör' })
    await expect(link).toHaveAttribute('href', '/kiralik-jenerator')
    await expect(page.locator('footer').getByRole('link', { name: 'Satış Kanalları' })).toHaveAttribute('href', '/hakkimizda#kanallar')
    // Jeneratör sitesine doğrudan bağlantı yalnız kendi sayfasındadır.
    expect(await page.locator('a[href*="jeneratr-7pb94g.com"]').count()).toBe(0)
  })

  test('AC-106/107: jeneratör sayfası indekslenebilir ve iki düz bağlantı taşır', async ({ page, request }) => {
    const response = await request.get('/kiralik-jenerator')
    expect(response.ok()).toBe(true)
    const html = await response.text()

    expect(html).not.toMatch(/<meta[^>]*name="robots"[^>]*noindex/i)
    expect(html).toMatch(/<link[^>]*rel="canonical"[^>]*href="https:\/\/www\.tasyunufiyatlari\.com\/kiralik-jenerator"/)
    expect(html).not.toMatch(/grup siteleri|web projeleri/i)

    await page.goto('/kiralik-jenerator')
    const home = page.getByRole('link', { name: 'kiralık jeneratör', exact: true })
    const siteUse = page.getByRole('link', { name: 'şantiye için jeneratör kiralama', exact: true })
    await expect(home).toHaveAttribute('href', GENERATOR_HOME)
    await expect(siteUse).toHaveAttribute('href', GENERATOR_SITE_USE)
    for (const link of [home, siteUse]) {
      expect(await link.getAttribute('rel')).toBeNull()
    }
    await expect(page.getByTestId('generator-links')).toContainText('ayrı bir işletmedir')

    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain('<loc>https://www.tasyunufiyatlari.com/kiralik-jenerator</loc>')
  })

  test('jeneratör sayfası ilk kez gelen ziyaretçiye taşyünü niyet sorusunu açmaz', async ({ browser }) => {
    // Ortak ayar niyeti önceden kaydeder; burada temiz bir ziyaretçi gerekir.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()
    await page.goto('/kiralik-jenerator')
    await expect(page.getByRole('heading', { level: 1, name: 'Mantolama şantiyesi için kiralık jeneratör' })).toBeVisible()
    await page.waitForTimeout(500)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await context.close()
  })
})

test.describe('teklif sonrası yüzeyler ve PDF', () => {
  test('AC-205/206: hesap sonucu, teslim kartı ve PDF kaynağı etiketli bağlantı taşır', async ({ page }) => {
    test.setTimeout(90_000)

    await page.route('**/api/quotes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          quoteId: 77,
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
        body: JSON.stringify({ ok: true, signedUrl: 'https://example.test/pdf', storagePath: '77/x.pdf', expiresInSeconds: 900 }),
      }),
    )

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

    // Hesap sonucu: fiyatı gören müşteri.
    const afterResult = page.getByTestId('material-offers-hesap_sonucu')
    await expect(afterResult).toBeVisible()
    const resultHref = new URL((await afterResult.getByRole('link', { name: 'Alçı fiyatlarını gör' }).getAttribute('href'))!)
    expect(`${resultHref.origin}${resultHref.pathname}`).toBe(ALCI)
    expect(resultHref.searchParams.get('utm_source')).toBe('tasyunufiyatlari.com')
    expect(resultHref.searchParams.get('utm_content')).toBe('hesap-sonucu')

    // Teklif teslimi: teklifini alan müşteri.
    const downloadPromise = page.waitForEvent('download')
    await result.getByRole('button', { name: 'Teklif detayını indir' }).click()
    const modal = page.getByRole('dialog', { name: 'Teklif Bilgileri' })
    await modal.locator('input[name="relatedPerson"]').fill('Emrah Test')
    await modal.locator('input[name="phone"]').fill('05321234567')
    await modal.locator('#kvkkConsent').check()
    await modal.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' }).click()

    const delivery = page.getByRole('dialog', { name: 'PDF teklifiniz hazır' })
    await expect(delivery).toBeVisible({ timeout: 30_000 })
    const inDelivery = delivery.getByTestId('material-offers-teklif_teslim')
    await expect(inDelivery).toBeVisible()
    const deliveryHref = new URL((await inDelivery.getByRole('link', { name: 'Alçıpan fiyatlarını gör' }).getAttribute('href'))!)
    expect(`${deliveryHref.origin}${deliveryHref.pathname}`).toBe(ALCIPAN)
    expect(deliveryHref.searchParams.get('utm_content')).toBe('teklif-teslim')
    // Ana eylemler kartın içinde bloktan önce durur.
    const pdfLink = await delivery.getByRole('link', { name: 'PDF indir' }).boundingBox()
    const blockBox = await inDelivery.boundingBox()
    expect(pdfLink && blockBox && pdfLink.y < blockBox.y).toBe(true)

    // PDF: sayfa resim olarak basılır, bağlantılar ayrıca işaretlenir.
    const download = await downloadPromise
    const pdfPath = await download.path()
    const pdf = (await readFile(pdfPath)).toString('latin1')
    expect(pdf).toContain('/URI (https://alcifiyatlari.com/urun-kategori/makina-alcisi/?utm_source=tasyunufiyatlari.com')
    expect(pdf).toContain('/URI (https://alcipanfiyatlari.net/urunler/alcipan-fiyatlari/?utm_source=tasyunufiyatlari.com')
    expect(pdf.match(/utm_content=pdf/g)?.length).toBe(2)

    if (process.env.PORTFOLIO_PDF_OUT) await download.saveAs(process.env.PORTFOLIO_PDF_OUT)
  })
})

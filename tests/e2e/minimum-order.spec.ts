import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// Emrah kararı (14 Ekim 2026 öğle): en az sipariş = seçilen ürün ve kalınlıkta 1 tam kamyon.
// - İletişim sayfası: numara yazılı; telefon ve WhatsApp düğmesi önce "siparişiniz en az 1 tam kamyon mu?"
//   diye sorar. "Hayır" → arama/ölçüm/bildirim yok. "Evet" → Telefon_Aramalari / Whatsapp_Yazanlar
//   ve WhatsApp niyet bildirimi gider.
// - Ana sayfa: "En az sipariş: 1 tam kamyon" şeridi kaydırınca ekranda kalır; kamyondan az metrajla
//   "Fiyatımı Hesapla" pencere açar ve "kamyonla hesapla" metrajı 1 kamyona çeker.

type GtagCall = [string, string, Record<string, unknown>]

async function events(page: Page, names: string[]): Promise<GtagCall[]> {
  const calls = await page.evaluate(() =>
    ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((entry) => Array.from(entry)),
  )
  return (calls as GtagCall[]).filter((call) => call[0] === 'event' && names.includes(call[1]))
}

async function stubOutbound(page: Page, context: BrowserContext): Promise<Record<string, unknown>[]> {
  const intents: Record<string, unknown>[] = []
  // GA etiketi yalnız üretimde yüklenir; geliştirme sunucusunda aynı biçimli gtag burada kurulur.
  await page.addInitScript(() => {
    const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void }
    w.dataLayer = w.dataLayer || []
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer.push(arguments)
    }
  })
  await page.route('**/api/whatsapp-intent', async (route) => {
    intents.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
  await context.route(/^https:\/\/wa\.me\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'kuru' }))
  return intents
}

const CONTACT_EVENTS = ['Telefon_Aramalari', 'Whatsapp_Yazanlar']

test.describe('en az sipariş: 1 tam kamyon', () => {
  test('iletişim sayfası en az siparişi büyük gösterir, numara yazılıdır ama bağlantı değildir', async ({ page, context }) => {
    await stubOutbound(page, context)
    await page.goto('/iletisim')
    const panel = page.getByTestId('minimum-order-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('1 tam kamyon')
    await expect(page.getByText('0 543 518 69 88', { exact: true })).toBeVisible()
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(1) // yalnız "Hemen Ara"
    await expect(page.getByRole('dialog')).toHaveCount(0) // giriş penceresi bu sayfada açılmaz
  })

  test('"Hayır, daha az" denince arama ve ölçüm olmaz', async ({ page, context }) => {
    const intents = await stubOutbound(page, context)
    await page.goto('/iletisim')
    await page.getByRole('link', { name: 'Hemen Ara' }).click()

    const dialog = page.getByTestId('minimum-order-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Lütfen vaktimizi almayalım')
    await expect(dialog).toContainText('Siparişiniz en az 1 tam kamyon mu?')
    await dialog.getByRole('button', { name: 'Hayır, daha az' }).click()
    await expect(dialog).toContainText('Bu ölçekteki taleplere destek veremiyoruz')
    await dialog.getByRole('button', { name: 'Kapat' }).click()
    await expect(dialog).toHaveCount(0)

    await page.getByRole('link', { name: 'Yazışmayı Başlat' }).click()
    await page.getByTestId('minimum-order-dialog').getByRole('button', { name: 'Hayır, daha az' }).click()

    expect(await events(page, CONTACT_EVENTS)).toHaveLength(0)
    expect(intents).toHaveLength(0)
    const answers = (await events(page, ['Minimum_Kamyon_Cevap'])).map((c) => c[2])
    expect(answers).toEqual([
      expect.objectContaining({ surface: 'iletisim_telefon', answer: 'az' }),
      expect.objectContaining({ surface: 'iletisim_whatsapp', answer: 'az' }),
    ])
  })

  test('"Evet" denince telefon ve WhatsApp ölçümü ve bildirimi gider', async ({ page, context }) => {
    const intents = await stubOutbound(page, context)
    await page.goto('/iletisim')

    await page.getByRole('link', { name: 'Hemen Ara' }).click()
    await page.getByTestId('minimum-order-dialog').getByRole('button', { name: 'Evet, en az 1 kamyon — Ara' }).click()
    await expect.poll(async () => (await events(page, ['Telefon_Aramalari'])).length).toBe(1)

    await page.getByRole('link', { name: 'Yazışmayı Başlat' }).click()
    const popupPromise = page.waitForEvent('popup')
    await page.getByTestId('minimum-order-dialog').getByRole('button', { name: 'Evet, en az 1 kamyon — Yaz' }).click()
    await (await popupPromise).close()
    await expect.poll(() => intents.length).toBe(1)
    expect(intents[0]).toMatchObject({ source: 'iletisim_card' })
    expect((await events(page, ['Whatsapp_Yazanlar'])).length).toBe(1)
  })

  test('ana sayfa şeridi kaydırınca ekranda kalır; kamyondan az metraj pencere açar', async ({ page, context }) => {
    await stubOutbound(page, context)
    await page.goto('/')
    const banner = page.getByTestId('minimum-order-banner')
    await expect(banner).toContainText('En az sipariş: 1 tam kamyon')
    // Hesaplayıcı varsayılan ürünü seçince şerit o seçimin kamyon metrajını yazar.
    await expect(page.getByTestId('minimum-order-banner-detail')).toContainText(/cm: en az [\d.]+ m²/u)

    await page.mouse.wheel(0, 2200)
    await page.waitForTimeout(400)
    const box = await banner.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeLessThan(120)

    await page.evaluate(() => window.scrollTo(0, 0))
    const amount = page.getByLabel('Miktar')
    await amount.fill('25')
    await page.getByRole('button', { name: 'Fiyatımı Hesapla' }).click()
    const dialog = page.getByTestId('minimum-order-dialog')
    await expect(dialog).toContainText('en az sipariş 1 tam kamyondur')
    const useMinimum = dialog.getByRole('button', { name: /m² ile hesapla$/u })
    const label = (await useMinimum.textContent()) ?? ''
    await useMinimum.click()
    await expect(dialog).toHaveCount(0)
    const minimum = Number(label.replace(/[^\d]/gu, ''))
    expect(minimum).toBeGreaterThan(25)
    expect(Number((await amount.inputValue()).replace(/[^\d.,]/gu, '').replace(',', '.'))).toBeGreaterThanOrEqual(minimum - 1)
  })

  test('ana sayfadan iletişim sayfasına gelen ziyaretçiye seçtiği ürünün metrajı söylenir', async ({ page, context }) => {
    await stubOutbound(page, context)
    await page.goto('/')
    await expect(page.getByTestId('minimum-order-banner-detail')).toContainText(/en az [\d.]+ m²/u)
    await page.goto('/iletisim')
    await page.getByRole('link', { name: 'Hemen Ara' }).click()
    await expect(page.getByTestId('minimum-order-dialog')).toContainText('Baktığınız ürün:')
  })
})

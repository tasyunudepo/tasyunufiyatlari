import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// Emrah kararı (13 Ekim 2026): ana sayfa ve iletişim sayfasında telefon ve WhatsApp tıklanabilir.
// Sözleşme: görünür bağlantı + doğru adres + tıklamada ölçüm (Telefon_Aramalari / Whatsapp_Yazanlar) ve
// WhatsApp niyet bildirimi (/api/whatsapp-intent) doğru kaynakla gider. Bildirim ucu ve wa.me testte sahte yanıtlanır.
const TEL = 'tel:+905435186988'
const WA = 'https://wa.me/905435186988'

type GtagCall = [string, string, Record<string, unknown>]

/** Sitenin gtag'i çağrıları `dataLayer`'a `arguments` nesnesi olarak yazar (components/analytics/GoogleAnalytics.tsx). */
async function contactEvents(page: Page): Promise<GtagCall[]> {
  const calls = await page.evaluate(() =>
    ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((entry) => Array.from(entry)),
  )
  return (calls as GtagCall[]).filter(
    (call) => call[0] === 'event' && (call[1] === 'Telefon_Aramalari' || call[1] === 'Whatsapp_Yazanlar'),
  )
}

async function stubOutbound(page: Page, context: BrowserContext): Promise<Record<string, unknown>[]> {
  const intents: Record<string, unknown>[] = []
  // GA etiketi yalnız üretimde yüklenir (app/layout.tsx); geliştirme sunucusunda aynı biçimli gtag burada kurulur.
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

test.describe('herkese açık telefon ve WhatsApp bağlantıları', () => {
  test('ana sayfa üst bölümünde telefon ve WhatsApp tıklanabilir ve ölçülür', async ({ page, context }) => {
    const intents = await stubOutbound(page, context)
    await page.goto('/')

    const contact = page.getByTestId('home-contact')
    const phone = contact.getByRole('link', { name: '0 543 518 69 88' })
    const whatsapp = contact.getByRole('link', { name: "WhatsApp'tan yazın" })
    await expect(phone).toBeVisible()
    await expect(phone).toHaveAttribute('href', TEL)
    await expect(whatsapp).toBeVisible()
    await expect(whatsapp).toHaveAttribute('href', WA)
    await expect(whatsapp).toHaveAttribute('target', '_blank')

    const popupPromise = page.waitForEvent('popup')
    await whatsapp.click()
    await (await popupPromise).close()
    await phone.dispatchEvent('click')

    await expect.poll(() => intents.length).toBe(1)
    expect(intents[0]).toMatchObject({ source: 'anasayfa_hero', page: '/' })
    const events = await contactEvents(page)
    expect(events.map((call) => [call[1], call[2].source])).toEqual([
      ['Whatsapp_Yazanlar', 'anasayfa_hero'],
      ['Telefon_Aramalari', 'anasayfa_hero'],
    ])
  })

  test('iletişim sayfasında telefon ve WhatsApp kartları tıklanabilir ve ölçülür', async ({ page, context }) => {
    const intents = await stubOutbound(page, context)
    await page.goto('/iletisim')

    const cards = page.getByRole('region', { name: 'Telefon ve WhatsApp' })
    const number = cards.getByRole('link', { name: '0 543 518 69 88' })
    const call = cards.getByRole('link', { name: 'Hemen Ara' })
    const whatsapp = cards.getByRole('link', { name: 'Yazışmayı Başlat' })
    await expect(number).toHaveAttribute('href', TEL)
    await expect(call).toHaveAttribute('href', TEL)
    await expect(whatsapp).toHaveAttribute('href', WA)
    await expect(cards.getByText('Pzt–Cmt 08:00–18:00')).toBeVisible()
    await expect(page.getByText('teklif kaydı tamamlandığında')).toHaveCount(0)

    const popupPromise = page.waitForEvent('popup')
    await whatsapp.click()
    await (await popupPromise).close()
    await call.dispatchEvent('click')

    await expect.poll(() => intents.length).toBe(1)
    expect(intents[0]).toMatchObject({ source: 'iletisim_card', page: '/iletisim' })
    const events = await contactEvents(page)
    expect(events.map((entry) => [entry[1], entry[2].source])).toEqual([
      ['Whatsapp_Yazanlar', 'iletisim_card'],
      ['Telefon_Aramalari', 'iletisim_phone'],
    ])
  })
})

// İlk kez gelen ziyaretçi (kayıtlı niyet yok): iletişim sayfası doğrudan telefon ve WhatsApp sunduğu için
// "Proje ölçekli satış" penceresi burada açılmaz; pencere kartların üstünü örtüp bağlantıları tıklanamaz bırakıyordu.
test.describe('ilk ziyarette iletişim sayfası', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('niyet penceresi açılmaz; telefon ve WhatsApp doğrudan tıklanabilir', async ({ page }) => {
    await page.goto('/iletisim')
    await page.waitForTimeout(300)

    await expect(page.getByRole('dialog', { name: /Proje ölçekli satış/i })).toHaveCount(0)
    const cards = page.getByRole('region', { name: 'Telefon ve WhatsApp' })
    await cards.getByRole('link', { name: 'Hemen Ara' }).click({ trial: true })
    await cards.getByRole('link', { name: 'Yazışmayı Başlat' }).click({ trial: true })
  })
})

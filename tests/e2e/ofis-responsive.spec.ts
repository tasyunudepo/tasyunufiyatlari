import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, test, type Browser, type Page } from '@playwright/test'

// Audit E1/V1 (docs/verification/OFIS-AUDIT-2026-07-26.md):
//   .nx-sidebar sabit 240px + AdminShell'de inline marginLeft:240px, hiçbir
//   medya sorgusu yoktu. 375px'te içeriğe 135px kalıyordu — panel mobilde
//   kullanılamıyordu.
//
// Kabul kriteri AC-03: 375/768/1440'ta yatay kaydırma yok ve gezinme erişilebilir.

const envPath = resolve(process.cwd(), '.env.local')

function readLocalEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(envPath, 'utf8')
        .split('\n')
        .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
        .map((line) => {
          const i = line.indexOf('=')
          return [
            line.slice(0, i).trim(),
            line.slice(i + 1).trim().replace(/^["']|["']$/g, ''),
          ]
        }),
    )
  } catch {
    return {}
  }
}

const env = readLocalEnv()
const ADMIN_USER = env.ADMIN_USER || 'admin'
const ADMIN_PASSWORD = env.ADMIN_PASSWORD

async function openOfis(browser: Browser, width: number, height: number): Promise<Page> {
  const context = await browser.newContext({
    httpCredentials: { username: ADMIN_USER, password: ADMIN_PASSWORD! },
    viewport: { width, height },
  })
  const page = await context.newPage()
  await page.goto('/ofis')
  await expect(page.getByRole('button', { name: 'Yenile' }).or(page.getByText('Talep Akışı').first()))
    .toBeVisible({ timeout: 30_000 })
  return page
}

test.describe('ofis düzeni — kırılma noktaları', () => {
  test.skip(!ADMIN_PASSWORD, '.env.local içinde ADMIN_PASSWORD tanımlı olmalı')

  for (const [width, height, label] of [
    [375, 812, 'mobil'],
    [768, 1024, 'tablet'],
    [1440, 900, 'masaüstü'],
  ] as const) {
    test(`AC-03: ${label} (${width}px) yatay kaydırma üretmez`, async ({ browser }) => {
      const page = await openOfis(browser, width, height)

      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }))
      expect(scrollW).toBeLessThanOrEqual(clientW + 1)

      await page.context().close()
    })
  }

  test('AC-03: dar ekranda içerik kenar çubuğunun altında sıkışmaz', async ({ browser }) => {
    const page = await openOfis(browser, 375, 812)

    // Ana içerik sütunu neredeyse tam genişlik olmalı — eski hâlinde
    // marginLeft:240px yüzünden 135px'e düşüyordu.
    const mainWidth = await page.locator('main').evaluate((el) => el.getBoundingClientRect().width)
    expect(mainWidth).toBeGreaterThan(320)

    await page.context().close()
  })

  test('AC-03: dar ekranda gezinme çekmece ile erişilebilir', async ({ browser }) => {
    const page = await openOfis(browser, 375, 812)

    const toggle = page.getByTestId('admin-drawer-toggle')
    await expect(toggle).toBeVisible()

    // Kapalıyken menü öğesi tıklanabilir konumda değil.
    const nav = page.getByRole('navigation', { name: 'Ofis navigasyonu' })
    expect((await nav.boundingBox())!.x).toBeLessThan(0)

    await toggle.click()
    // 200ms'lik transform geçişi var; konumu yoklayarak bekle.
    await expect.poll(async () => (await nav.boundingBox())!.x).toBeGreaterThanOrEqual(0)

    // Sekme seçilince çekmece kapanır ve gezinme gerçekleşir.
    await nav.getByRole('button', { name: 'Teklifler' }).click()
    await expect(page.getByText('Teklif Komuta Merkezi')).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => (await nav.boundingBox())!.x).toBeLessThan(0)

    await page.context().close()
  })

  test('AC-03: masaüstünde çekmece düğmesi görünmez', async ({ browser }) => {
    const page = await openOfis(browser, 1440, 900)

    await expect(page.getByTestId('admin-drawer-toggle')).toBeHidden()
    const nav = page.getByRole('navigation', { name: 'Ofis navigasyonu' })
    expect((await nav.boundingBox())!.x).toBe(0)

    await page.context().close()
  })
})

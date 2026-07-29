import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, test, type Browser, type Page } from '@playwright/test'

// Audit B1/B2 (docs/verification/OFIS-AUDIT-2026-07-26.md):
//   - patron salt-okunur hesabı 23 silme butonu ve 23 durum menüsü görüyordu
//   - tıklayınca PATCH 403 dönüyor, ekranda HİÇBİR açıklama çıkmıyordu
//   - menü sessizce eski değerine dönüyor, kullanıcı ne olduğunu anlamıyordu
//
// Bu spec o davranışı kilitler. Kabul kriterleri: AC-01 (patron mutasyon
// kontrolü görmez) ve AC-02 (başarısız mutasyon ekranda görünür).

// Playwright specleri CJS'e derlenir; import.meta kullanılamaz.
// Testler proje kökünden koşulduğu için cwd güvenilir.
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
const PATRON_PASSWORD = env.PATRON_PASSWORD

async function openOfis(
  browser: Browser,
  credentials: { username: string; password: string },
): Promise<Page> {
  const context = await browser.newContext({ httpCredentials: credentials })
  const page = await context.newPage()
  await page.goto('/ofis')
  await page.getByRole('button', { name: 'Teklifler' }).first().click()
  // Teklif listesi yüklenene kadar bekle (yükleniyor metni kaybolur).
  await expect(page.getByText('Teklif Masası')).toBeVisible({ timeout: 30_000 })
  return page
}

test.describe('ofis rol ayrımı', () => {
  test.skip(
    !ADMIN_PASSWORD || !PATRON_PASSWORD,
    '.env.local içinde ADMIN_PASSWORD ve PATRON_PASSWORD tanımlı olmalı',
  )

  test('AC-01: patron hesabı mutasyon kontrollerini görmez', async ({ browser }) => {
    const page = await openOfis(browser, {
      username: 'patron',
      password: PATRON_PASSWORD!,
    })

    // Salt-okunur olduğu ekranda açıkça yazıyor.
    await expect(page.getByTestId('quotes-read-only-note')).toBeVisible()

    // Değiştirme kontrollerinin hiçbiri render edilmemiş.
    await expect(page.getByRole('button', { name: 'Teklifi sil' })).toHaveCount(0)
    await expect(page.locator('select[aria-label*="teklif durumu"]')).toHaveCount(0)
    await expect(page.locator('select[aria-label*="teklif önceliği"]')).toHaveCount(0)

    await page.context().close()
  })

  test('AC-01: admin hesabı aynı kontrolleri görür', async ({ browser }) => {
    const page = await openOfis(browser, {
      username: ADMIN_USER,
      password: ADMIN_PASSWORD!,
    })

    await expect(page.getByTestId('quotes-read-only-note')).toHaveCount(0)
    // En az bir teklif varsa kontroller görünür olmalı.
    const statusSelects = page.locator('select[aria-label*="teklif durumu"]')
    expect(await statusSelects.count()).toBeGreaterThan(0)
    expect(await page.getByRole('button', { name: 'Teklifi sil' }).count()).toBeGreaterThan(0)

    await page.context().close()
  })

  test('AC-02: başarısız mutasyon ekranda görünür hata üretir', async ({ browser }) => {
    // Admin arayüzüyle giriyoruz (kontroller görünür), ama PATCH isteğini
    // 403'e çeviriyoruz — sunucunun patron için ürettiği yanıtın aynısı.
    // Böylece "sessiz yutma" davranışı doğrudan test edilir.
    const context = await browser.newContext({
      httpCredentials: { username: ADMIN_USER, password: ADMIN_PASSWORD! },
    })
    const page = await context.newPage()

    await page.route('**/api/admin/quotes/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: 'Bu hesap veri değiştirme yetkisine sahip değil.',
          }),
        })
        return
      }
      await route.fallback()
    })

    await page.goto('/ofis')
    await page.getByRole('button', { name: 'Teklifler' }).first().click()
    await expect(page.getByText('Teklif Masası')).toBeVisible({ timeout: 30_000 })

    const statusSelect = page.locator('select[aria-label*="teklif durumu"]').first()
    const before = await statusSelect.inputValue()
    await statusSelect.selectOption(before === 'approved' ? 'pending' : 'approved')

    // Sessizce yutulmaz: kullanıcıya neden olduğu söylenir.
    const alert = page.getByTestId('quote-action-error')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('yetki')

    await context.close()
  })
})

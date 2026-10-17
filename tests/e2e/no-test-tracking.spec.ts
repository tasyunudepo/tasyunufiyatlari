import { expect, test } from '@playwright/test'

// 17 Ekim 2026: yerelde (127.0.0.1) koşan testler gerçek GA4 etiketini yüklüyor, düğme tıklamaları Google'da ziyaretçi
// ve temas olarak sayılıyordu. Etiket yalnız gerçek alan adında yüklenir; burada Google'a hiç istek gitmemeli.
test('yerel test ortamında Google Analytics yüklenmez, olaylar ağa gitmez', async ({ page }) => {
  const googleRequests: string[] = []
  page.on('request', (req) => {
    if (/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/.test(req.url())) googleRequests.push(req.url())
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(await page.evaluate(() => (window as unknown as { __gaSkippedHost?: string }).__gaSkippedHost)).toBe('127.0.0.1')
  // gtag tanımlı kalır (uygulama olayları dataLayer'a düşer)
  expect(await page.evaluate(() => typeof (window as unknown as { gtag?: unknown }).gtag)).toBe('function')
  await page.goto('/iletisim')
  await page.waitForLoadState('networkidle')
  expect(googleRequests).toEqual([])
})
